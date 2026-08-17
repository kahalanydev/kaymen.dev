/* ============================================================================
   kaymen.dev — security API   (mounted at /api/admin/security)

   New 2026-08-17. Replaces the single `GET /api/admin/security` handler that
   used to live in routes/admin.js, which returned five arrays and no opinion:
   a list of suspicious rows, a list of IPs, and two counts. You could read it
   and still not know whether anything had actually happened.

   What is different here:

     · POSTURE IS DERIVED, never stored. `/` returns a sentence computed from
       the data on every request, the same way the client portal's status
       sentence is (portal/app.js `statusSentence`). A stored summary goes stale
       and starts lying; a derived one cannot.
     · Events are FILTERABLE, because `suspicious_activity` now carries a
       machine-readable category rather than only a human sentence.
     · There is a DOSSIER endpoint. "This IP looks wrong" is the actual question,
       and answering it used to mean reading three tables by eye.
     · Blocking is a real, reversible action with an audit trail.

   Mounted before routes/admin.js in server/index.js — both are under
   /api/admin and Express matches in registration order.
   ============================================================================ */

const express = require('express');
const { getDb, logAuthEvent } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { blockIp, allowIp, removeRule, currentScore, isPrivate } = require('../middleware/shield');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin', 'staff'));

// Period comes from a query string, so it is clamped rather than trusted —
// `?period=99999` is a full table scan on a database held in memory.
const periodDays = (q, fallback = 7) => {
  const n = parseInt(q, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 365);
};
const since = (days) => `-${days} days`;
const limitOf = (q, fallback = 100, max = 500) => {
  const n = parseInt(q, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
};

// ===== GET /api/admin/security ==============================================
router.get('/', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 7);
  const window = since(days);

  const counts = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN severity IN ('high','critical') THEN 1 ELSE 0 END) as severe,
      SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked,
      COUNT(DISTINCT ip) as ips
    FROM suspicious_activity WHERE created_at >= datetime('now', ?)
  `).get(window);

  const visitors = db.prepare(`
    SELECT
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as humans,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bots,
      COUNT(DISTINCT ip) as unique_ips
    FROM visits WHERE created_at >= datetime('now', ?)
  `).get(window);

  const auth = db.prepare(`
    SELECT
      SUM(CASE WHEN event = 'login_failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN event = 'lockout' THEN 1 ELSE 0 END) as lockouts,
      SUM(CASE WHEN event = 'login_success' THEN 1 ELSE 0 END) as succeeded
    FROM auth_events WHERE created_at >= datetime('now', ?)
  `).get(window);

  const activeRules = db.prepare(`
    SELECT
      SUM(CASE WHEN action = 'block' THEN 1 ELSE 0 END) as blocks,
      SUM(CASE WHEN action = 'allow' THEN 1 ELSE 0 END) as allows
    FROM ip_rules WHERE expires_at IS NULL OR expires_at > datetime('now')
  `).get();

  // The threat feed itself — most recent first, capped for the overview.
  const recent = db.prepare(`
    SELECT s.*, g.country, g.city, g.asn
    FROM suspicious_activity s
    LEFT JOIN geo_cache g ON s.ip = g.ip
    WHERE s.created_at >= datetime('now', ?)
    ORDER BY s.id DESC LIMIT 40
  `).all(window);

  // Who, ranked by what they did rather than how often they did it: an IP with
  // one critical finding outranks one with forty low ones.
  const offenders = db.prepare(`
    SELECT s.ip,
           COUNT(*) as incidents,
           SUM(s.score) as total_score,
           SUM(CASE WHEN s.blocked = 1 THEN 1 ELSE 0 END) as blocked_count,
           MAX(s.created_at) as last_seen,
           GROUP_CONCAT(DISTINCT s.category) as categories,
           g.country, g.city, g.isp, g.asn
    FROM suspicious_activity s
    LEFT JOIN geo_cache g ON s.ip = g.ip
    WHERE s.created_at >= datetime('now', ?)
    GROUP BY s.ip
    ORDER BY total_score DESC
    LIMIT 20
  `).all(window);

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count, MAX(severity) as severity
    FROM suspicious_activity
    WHERE created_at >= datetime('now', ?) AND category IS NOT NULL
    GROUP BY category ORDER BY count DESC LIMIT 15
  `).all(window);

  // Daily shape, so the panel can draw the trend rather than only the total.
  const daily = db.prepare(`
    SELECT date(created_at) as date,
           COUNT(*) as events,
           SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked
    FROM suspicious_activity
    WHERE created_at >= datetime('now', ?)
    GROUP BY date(created_at) ORDER BY date
  `).all(window);

  res.json({
    success: true,
    data: {
      period: days,
      posture: posture({ counts, auth, activeRules, days }),
      counts, visitors, auth, rules: activeRules,
      recent, offenders, byCategory, daily,
    }
  });
});

/* The sentence at the top of the page.

   Derived on every request from the same numbers rendered underneath it, so it
   cannot contradict them. Ordered by severity, and it deliberately has a
   good-news branch: a security page that only ever speaks up when something is
   wrong trains you to assume the quiet version is broken. */
function posture({ counts, auth, activeRules, days }) {
  const span = days === 1 ? 'today' : `in the last ${days} days`;

  if (counts.severe > 0) {
    return {
      level: 'alert',
      headline: counts.blocked > 0
        ? `${counts.blocked} request${counts.blocked === 1 ? '' : 's'} refused, ${counts.severe} serious`
        : `${counts.severe} serious probe${counts.severe === 1 ? '' : 's'} ${span}`,
      detail: `${counts.total} flagged event${counts.total === 1 ? '' : 's'} from ${counts.ips} address${counts.ips === 1 ? '' : 'es'} ${span}.`
        + (activeRules.blocks ? ` ${activeRules.blocks} address${activeRules.blocks === 1 ? ' is' : 'es are'} currently blocked.` : ''),
    };
  }
  if (auth.lockouts > 0) {
    return {
      level: 'warn',
      headline: `${auth.lockouts} account lockout${auth.lockouts === 1 ? '' : 's'} ${span}`,
      detail: `${auth.failed} failed sign-in${auth.failed === 1 ? '' : 's'} ${span}. No exploit attempts reached the application.`,
    };
  }
  if (counts.total > 0) {
    return {
      level: 'warn',
      headline: `${counts.total} low-level probe${counts.total === 1 ? '' : 's'} ${span}`,
      detail: `Routine background scanning from ${counts.ips} address${counts.ips === 1 ? '' : 'es'}. Nothing was serious enough to refuse.`,
    };
  }
  return {
    level: 'ok',
    headline: `Nothing flagged ${span}`,
    detail: `No probes, no lockouts, no refused requests.`
      + (activeRules.blocks ? ` ${activeRules.blocks} address${activeRules.blocks === 1 ? '' : 'es'} still on the blocklist.` : ''),
  };
}

// ===== GET /api/admin/security/events =======================================
router.get('/events', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 7);
  const limit = limitOf(req.query.limit, 100);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  // Filters are appended as bound parameters, never interpolated — this is an
  // admin endpoint but "authenticated" is not a reason to build SQL by
  // concatenation, and the whole page is about not doing that.
  const where = ["s.created_at >= datetime('now', ?)"];
  const params = [since(days)];

  if (req.query.category) { where.push('s.category = ?'); params.push(req.query.category); }
  if (req.query.severity) { where.push('s.severity = ?'); params.push(req.query.severity); }
  if (req.query.ip) { where.push('s.ip = ?'); params.push(req.query.ip); }
  if (req.query.blocked === '1') where.push('s.blocked = 1');

  const rows = db.prepare(`
    SELECT s.*, g.country, g.city, g.isp, g.asn
    FROM suspicious_activity s
    LEFT JOIN geo_cache g ON s.ip = g.ip
    WHERE ${where.join(' AND ')}
    ORDER BY s.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(
    `SELECT COUNT(*) as c FROM suspicious_activity s WHERE ${where.join(' AND ')}`
  ).get(...params).c;

  res.json({ success: true, data: { events: rows, total, limit, offset } });
});

// ===== GET /api/admin/security/ip/:ip =======================================
//
// The dossier. Everything the system knows about one address, in one call,
// because the question "should I block this" needs all of it at once.
router.get('/ip/:ip', (req, res) => {
  const db = getDb();
  const ip = req.params.ip;
  const days = periodDays(req.query.period, 90);
  const window = since(days);

  const geo = db.prepare('SELECT * FROM geo_cache WHERE ip = ?').get(ip) || null;
  const rule = db.prepare('SELECT * FROM ip_rules WHERE ip = ?').get(ip) || null;

  const summary = db.prepare(`
    SELECT COUNT(*) as visits,
           SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_visits,
           COUNT(DISTINCT session_id) as sessions,
           MIN(created_at) as first_seen,
           MAX(created_at) as last_seen
    FROM visits WHERE ip = ? AND created_at >= datetime('now', ?)
  `).get(ip, window);

  const threats = db.prepare(`
    SELECT * FROM suspicious_activity
    WHERE ip = ? AND created_at >= datetime('now', ?)
    ORDER BY id DESC LIMIT 100
  `).all(ip, window);

  const threatSummary = db.prepare(`
    SELECT COUNT(*) as incidents, SUM(score) as total_score,
           SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked
    FROM suspicious_activity WHERE ip = ? AND created_at >= datetime('now', ?)
  `).get(ip, window);

  const authAttempts = db.prepare(`
    SELECT * FROM auth_events WHERE ip = ? AND created_at >= datetime('now', ?)
    ORDER BY id DESC LIMIT 50
  `).all(ip, window);

  const sessions = db.prepare(`
    SELECT id, session_id, path, browser, os, device_type, is_bot, bot_kind,
           user_agent, duration_seconds, max_scroll, pageview_count, created_at
    FROM visits WHERE ip = ? AND created_at >= datetime('now', ?)
    ORDER BY id DESC LIMIT 50
  `).all(ip, window);

  const pages = db.prepare(`
    SELECT p.path, COUNT(*) as views, MAX(p.created_at) as last_view
    FROM pageviews p
    JOIN visits v ON p.visit_id = v.id
    WHERE v.ip = ? AND p.created_at >= datetime('now', ?)
    GROUP BY p.path ORDER BY views DESC LIMIT 25
  `).all(ip, window);

  res.json({
    success: true,
    data: {
      ip, geo, rule, summary, threats, threatSummary, authAttempts, sessions, pages,
      // Live in-memory figure from the threat engine's rolling window — what the
      // shield would decide on right now, which no table records.
      liveScore: currentScore(ip),
      isPrivate: isPrivate(ip),
      period: days,
    }
  });
});

// ===== RULES ================================================================

router.get('/rules', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.*, u.email as created_by_email, g.country, g.city, g.isp
    FROM ip_rules r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN geo_cache g ON r.ip = g.ip
    ORDER BY
      CASE WHEN r.expires_at IS NOT NULL AND r.expires_at <= datetime('now') THEN 1 ELSE 0 END,
      r.created_at DESC
  `).all();
  res.json({ success: true, data: { rules: rows } });
});

router.post('/rules', requireRole('admin'), (req, res) => {
  const { ip, action, reason, minutes } = req.body || {};
  if (!ip || !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) {
    return res.status(400).json({ success: false, error: 'A valid IP address is required' });
  }
  if (!['block', 'allow'].includes(action)) {
    return res.status(400).json({ success: false, error: 'action must be block or allow' });
  }
  if (!reason || !String(reason).trim()) {
    // A blocklist without reasons becomes unmaintainable within a month — you
    // are left with addresses nobody dares remove because nobody knows why.
    return res.status(400).json({ success: false, error: 'A reason is required' });
  }

  const mins = minutes ? parseInt(minutes, 10) : null;
  try {
    const rule = action === 'block'
      ? blockIp({ ip, reason: String(reason).slice(0, 200), source: 'manual', minutes: mins, userId: req.user.id })
      : allowIp({ ip, reason: String(reason).slice(0, 200), source: 'manual', minutes: mins, userId: req.user.id });

    logAuthEvent(getDb(), {
      userId: req.user.id, email: req.user.email, event: `ip_${action}ed`,
      ip: req.clientIp || req.ip, userAgent: req.headers['user-agent'],
      detail: `${ip} — ${reason}`
    });
    res.json({ success: true, data: { rule } });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete('/rules/:ip', requireRole('admin'), (req, res) => {
  removeRule(req.params.ip);
  logAuthEvent(getDb(), {
    userId: req.user.id, email: req.user.email, event: 'ip_rule_removed',
    ip: req.clientIp || req.ip, userAgent: req.headers['user-agent'],
    detail: req.params.ip
  });
  res.json({ success: true });
});

// ===== GET /api/admin/security/auth =========================================
router.get('/auth', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 30);
  const limit = limitOf(req.query.limit, 150);

  const where = ["a.created_at >= datetime('now', ?)"];
  const params = [since(days)];
  if (req.query.event) { where.push('a.event = ?'); params.push(req.query.event); }
  if (req.query.email) { where.push('a.email = ?'); params.push(req.query.email); }

  const events = db.prepare(`
    SELECT a.*, g.country, g.city
    FROM auth_events a
    LEFT JOIN geo_cache g ON a.ip = g.ip
    WHERE ${where.join(' AND ')}
    ORDER BY a.id DESC LIMIT ?
  `).all(...params, limit);

  const byEvent = db.prepare(`
    SELECT event, COUNT(*) as count FROM auth_events
    WHERE created_at >= datetime('now', ?) GROUP BY event ORDER BY count DESC
  `).all(since(days));

  // Accounts currently locked out, which is the one piece of auth state a
  // panel has to surface — the user cannot tell you, they cannot get in.
  const locked = db.prepare(`
    SELECT id, email, name, role, login_attempts, locked_until
    FROM users WHERE locked_until IS NOT NULL AND locked_until > datetime('now')
  `).all();

  res.json({ success: true, data: { events, byEvent, locked, period: days } });
});

module.exports = router;
