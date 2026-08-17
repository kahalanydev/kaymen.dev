/* ============================================================================
   kaymen.dev — traffic API   (mounted at /api/admin/traffic)

   New 2026-08-17. Supersedes `GET /api/admin/analytics` in routes/admin.js,
   which queried the raw `visits` and `events` tables for everything.

   THE IMPORTANT DIFFERENCE: every breakdown here is read from the permanent
   rollups (`traffic_daily`, `dimension_daily`), not from raw rows. That is what
   makes "long run statistics" a real claim rather than an aspiration — the raw
   tables are pruned on a retention window (utils/rollup.js), and anything
   answered from them would quietly start returning less history every month
   until it silently covered only the last few weeks.

   The raw tables are still used, but only where recency is the point: who is on
   the site right now, and what one particular session did.

   `ensureFresh()` re-rolls today if the last roll is more than two minutes old,
   so reading from rollups costs nothing in freshness. Without it this page
   would show figures frozen at the top of the hour and read as broken.
   ============================================================================ */

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ensureFresh, RETENTION_DAYS } = require('../utils/rollup');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin', 'staff'));

// Rollups are cheap to refresh and expensive to be wrong about. Every endpoint
// under here reads them, so freshness is enforced once, at the door.
router.use((req, res, next) => {
  try { ensureFresh(120); } catch { /* stale figures beat a 500 */ }
  next();
});

const periodDays = (q, fallback = 30) => {
  const n = parseInt(q, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 3650); // ten years: the rollups genuinely go back forever
};
const since = (days) => `-${days} days`;

/* Read one axis out of dimension_daily for a period. `kind` is never taken from
   the caller without passing through this whitelist — it lands in a WHERE and
   an unbounded value would let the query be steered. */
const KINDS = ['device', 'browser', 'os', 'country', 'language', 'referrer', 'viewport', 'page', 'bot'];

function dimension(db, kind, days, limit = 20) {
  if (!KINDS.includes(kind)) return [];
  return db.prepare(`
    SELECT key, SUM(visits) as count
    FROM dimension_daily
    WHERE kind = ? AND date >= date('now', ?)
    GROUP BY key ORDER BY count DESC LIMIT ?
  `).all(kind, since(days), limit);
}

// ===== GET /api/admin/traffic ===============================================
router.get('/', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 30);

  const daily = db.prepare(`
    SELECT * FROM traffic_daily WHERE date >= date('now', ?) ORDER BY date
  `).all(since(days));

  const totals = db.prepare(`
    SELECT
      SUM(visits) as visits, SUM(visitors) as visitors, SUM(new_visitors) as new_visitors,
      SUM(pageviews) as pageviews, SUM(bot_visits) as bot_visits, SUM(bounces) as bounces,
      SUM(threats) as threats, SUM(blocked) as blocked
    FROM traffic_daily WHERE date >= date('now', ?)
  `).get(since(days));

  // Averages have to be weighted by the day's traffic — a day with two visits
  // and a day with two hundred are not equal terms in a mean, and averaging the
  // stored daily averages would let a quiet Sunday drag the figure around.
  const weighted = db.prepare(`
    SELECT
      SUM(avg_scroll * visits) as scroll_sum,
      SUM(avg_duration * visits) as duration_sum,
      SUM(visits) as v
    FROM traffic_daily WHERE date >= date('now', ?) AND visits > 0
  `).get(since(days));

  const avgScroll = weighted.v ? Math.round(weighted.scroll_sum / weighted.v) : 0;
  const avgDuration = weighted.v ? Math.round(weighted.duration_sum / weighted.v) : 0;

  // The previous equal-length window, so the panel can say "up 12%" rather than
  // showing a number with nothing to compare it to.
  const previous = db.prepare(`
    SELECT SUM(visits) as visits, SUM(visitors) as visitors, SUM(pageviews) as pageviews
    FROM traffic_daily WHERE date >= date('now', ?) AND date < date('now', ?)
  `).get(since(days * 2), since(days));

  // UNIQUE VISITORS CANNOT BE SUMMED, and this is the trap every rollup-based
  // analytics system falls into. `traffic_daily.visitors` is correct for its
  // own day, but somebody who visits on Monday and again on Thursday is one
  // visitor and two daily uniques — so SUM() over ninety days reports a number
  // that is not a count of anything. On the seeded fixture it read 987 people
  // out of 990 visits, which is only plausible because it is wrong.
  //
  // So the period figure is counted from raw. That is exact within the raw
  // retention window (utils/rollup.js) and necessarily partial beyond it, and
  // the response says which rather than quietly presenting one as the other.
  const unique = db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(visitor_id, session_id)) as c
    FROM visits WHERE created_at >= datetime('now', ?) AND is_bot = 0
  `).get(since(days)).c;

  // Exact whenever the window sits inside the raw retention period, because
  // that is the only thing that can remove rows from underneath this count.
  //
  // The first version of this compared the window start against the OLDEST raw
  // row, which is a different question and gets a new site backwards: a site
  // that started collecting yesterday has complete data for every window, and
  // that check called all of them partial.
  const exact = days <= RETENTION_DAYS.visits;

  const hourly = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', ?) AND is_bot = 0
    GROUP BY hour ORDER BY hour
  `).all(since(Math.min(days, 90)));

  res.json({
    success: true,
    data: {
      period: days, daily, totals, previous, hourly,
      avgScroll, avgDuration,
      uniqueVisitors: unique,
      // False once the window reaches past the retained raw rows — at which
      // point the figure counts only the part still held in detail, and the UI
      // has to say "at least" rather than a bare number.
      uniqueVisitorsExact: exact,
      bounceRate: totals.visits ? Math.round((totals.bounces / totals.visits) * 100) : 0,
      devices: dimension(db, 'device', days, 8),
      referrers: dimension(db, 'referrer', days, 12),
      pages: dimension(db, 'page', days, 12),
      countries: dimension(db, 'country', days, 12),
    }
  });
});

// ===== GET /api/admin/traffic/pages =========================================
router.get('/pages', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 30);

  // Long-run view counts from the rollups...
  const views = dimension(db, 'page', days, 60);

  // ...and engagement from the raw pageviews that still exist. These two cover
  // different spans on purpose, and the response says so rather than implying
  // one number describes both.
  const engagement = db.prepare(`
    SELECT path,
           COUNT(*) as views,
           ROUND(AVG(NULLIF(duration_seconds, 0))) as avg_seconds,
           ROUND(AVG(NULLIF(active_seconds, 0))) as avg_active,
           ROUND(AVG(NULLIF(max_scroll, 0))) as avg_scroll
    FROM pageviews
    WHERE created_at >= datetime('now', ?)
    GROUP BY path ORDER BY views DESC LIMIT 60
  `).all(since(days));

  const engagementByPath = Object.fromEntries(engagement.map(e => [e.path, e]));
  const pages = views.map(v => ({
    path: v.key,
    views: v.count,
    ...(engagementByPath[v.key] || {}),
  }));

  const entries = db.prepare(`
    SELECT path, COUNT(*) as count FROM visits
    WHERE created_at >= datetime('now', ?) AND is_bot = 0 AND path IS NOT NULL
    GROUP BY path ORDER BY count DESC LIMIT 20
  `).all(since(days));

  res.json({ success: true, data: { pages, entries, period: days, engagementWindow: days } });
});

// ===== GET /api/admin/traffic/tech ==========================================
//
// The devices question, which is the one Ohav asked for by name: what are
// people actually reading this on, over the long run.
router.get('/tech', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 90);

  // Device mix per month, so a shift from desktop to phone over a year is
  // visible as a shape rather than as one number that happens to be current.
  const deviceTrend = db.prepare(`
    SELECT substr(date, 1, 7) as month, key as device, SUM(visits) as count
    FROM dimension_daily
    WHERE kind = 'device' AND date >= date('now', ?)
    GROUP BY month, key ORDER BY month, count DESC
  `).all(since(days));

  const screens = db.prepare(`
    SELECT screen_width, screen_height, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', ?) AND is_bot = 0 AND screen_width IS NOT NULL
    GROUP BY screen_width, screen_height ORDER BY count DESC LIMIT 15
  `).all(since(days));

  res.json({
    success: true,
    data: {
      period: days,
      devices: dimension(db, 'device', days, 8),
      browsers: dimension(db, 'browser', days, 15),
      operatingSystems: dimension(db, 'os', days, 15),
      viewports: dimension(db, 'viewport', days, 10),
      languages: dimension(db, 'language', days, 12),
      bots: dimension(db, 'bot', days, 12),
      deviceTrend, screens,
    }
  });
});

// ===== GET /api/admin/traffic/geo ===========================================
router.get('/geo', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 90);

  const countries = dimension(db, 'country', days, 60);

  const cities = db.prepare(`
    SELECT city, country, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', ?) AND is_bot = 0 AND city IS NOT NULL
    GROUP BY city, country ORDER BY count DESC LIMIT 30
  `).all(since(days));

  // Country codes come from the raw window rather than the rollup, which keys
  // on the country NAME — the code is only needed for flags, and a flag missing
  // on a row older than the retention window is not worth a second rollup axis.
  const codes = db.prepare(`
    SELECT country, country_code, COUNT(*) as c FROM visits
    WHERE country IS NOT NULL AND country_code IS NOT NULL
    GROUP BY country, country_code ORDER BY c DESC
  `).all();
  const codeByCountry = Object.fromEntries(codes.map(r => [r.country, r.country_code]));

  const networks = db.prepare(`
    SELECT g.isp, g.asn, COUNT(*) as count,
           SUM(CASE WHEN v.is_bot = 1 THEN 1 ELSE 0 END) as bot_visits
    FROM visits v JOIN geo_cache g ON v.ip = g.ip
    WHERE v.created_at >= datetime('now', ?) AND g.isp IS NOT NULL
    GROUP BY g.isp ORDER BY count DESC LIMIT 25
  `).all(since(days));

  res.json({
    success: true,
    data: {
      period: days,
      countries: countries.map(c => ({ ...c, code: codeByCountry[c.key] || null })),
      cities, networks,
    }
  });
});

// ===== GET /api/admin/traffic/live ==========================================
//
// Raw by necessity — "right now" is the one question a daily rollup cannot
// answer. `last_seen_at` is maintained by the engagement heartbeat, so someone
// reading quietly for ten minutes still counts as present.
router.get('/live', (req, res) => {
  const db = getDb();
  const minutes = Math.min(Math.max(parseInt(req.query.minutes, 10) || 5, 1), 60);

  const active = db.prepare(`
    SELECT v.id, v.session_id, v.ip, v.path, v.device_type, v.browser, v.os,
           v.country, v.city, v.country_code, v.is_bot, v.bot_kind,
           v.referrer, v.duration_seconds, v.active_seconds, v.max_scroll,
           v.pageview_count, v.created_at,
           COALESCE(v.last_seen_at, v.created_at) as last_seen
    FROM visits v
    WHERE COALESCE(v.last_seen_at, v.created_at) >= datetime('now', ?)
    ORDER BY last_seen DESC LIMIT 60
  `).all(`-${minutes} minutes`);

  // The page each of them is on now, rather than the one they landed on.
  const currentPages = db.prepare(`
    SELECT session_id, path, MAX(created_at) as at
    FROM pageviews WHERE created_at >= datetime('now', ?)
    GROUP BY session_id
  `).all(`-${minutes} minutes`);
  const pageBySession = Object.fromEntries(currentPages.map(p => [p.session_id, p.path]));

  const visitors = active.map(v => ({ ...v, current_path: pageBySession[v.session_id] || v.path }));

  const today = db.prepare(`
    SELECT COUNT(*) as visits, COUNT(DISTINCT COALESCE(visitor_id, session_id)) as visitors
    FROM visits WHERE date(created_at) = date('now') AND is_bot = 0
  `).get();

  res.json({
    success: true,
    data: {
      minutes,
      visitors,
      humans: visitors.filter(v => !v.is_bot).length,
      bots: visitors.filter(v => v.is_bot).length,
      today,
    }
  });
});

// ===== GET /api/admin/traffic/visitors ======================================
router.get('/visitors', (req, res) => {
  const db = getDb();
  const days = periodDays(req.query.period, 7);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const where = ["v.created_at >= datetime('now', ?)"];
  const params = [since(days)];
  if (req.query.bots !== '1') where.push('v.is_bot = 0');
  if (req.query.country) { where.push('v.country = ?'); params.push(req.query.country); }
  if (req.query.device) { where.push('v.device_type = ?'); params.push(req.query.device); }

  const visits = db.prepare(`
    SELECT v.*, g.isp, g.asn
    FROM visits v LEFT JOIN geo_cache g ON v.ip = g.ip
    WHERE ${where.join(' AND ')}
    ORDER BY v.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(
    `SELECT COUNT(*) as c FROM visits v WHERE ${where.join(' AND ')}`
  ).get(...params).c;

  res.json({ success: true, data: { visits, total, limit, offset, period: days } });
});

// ===== GET /api/admin/traffic/session/:sessionId ============================
//
// One visit, as a timeline. This is what the old panel could never do: it had
// the events but no way to line them up against the pages they happened on.
router.get('/session/:sessionId', (req, res) => {
  const db = getDb();
  const sid = req.params.sessionId;

  const visit = db.prepare(`
    SELECT v.*, g.isp, g.asn, g.org
    FROM visits v LEFT JOIN geo_cache g ON v.ip = g.ip
    WHERE v.session_id = ? ORDER BY v.id DESC LIMIT 1
  `).get(sid);
  if (!visit) return res.status(404).json({ success: false, error: 'Session not found' });

  const pages = db.prepare(
    'SELECT * FROM pageviews WHERE session_id = ? ORDER BY id'
  ).all(sid);

  const events = db.prepare(
    'SELECT * FROM events WHERE session_id = ? ORDER BY id'
  ).all(sid);

  // Merged and sorted so the panel renders one list rather than interleaving
  // two in the browser — the ordering rule belongs next to the data.
  const timeline = [
    ...pages.map(p => ({ kind: 'pageview', at: p.created_at, label: p.path,
      detail: p.title, seconds: p.duration_seconds, active: p.active_seconds, scroll: p.max_scroll })),
    ...events.map(e => ({ kind: e.event_type, at: e.created_at, label: e.target,
      detail: e.metadata ? safeParse(e.metadata) : null })),
  ].sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const otherVisits = db.prepare(`
    SELECT id, session_id, path, created_at, duration_seconds
    FROM visits WHERE ip = ? AND session_id != ? ORDER BY id DESC LIMIT 20
  `).all(visit.ip, sid);

  res.json({ success: true, data: { visit, pages, events, timeline, otherVisits } });
});

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

module.exports = router;
