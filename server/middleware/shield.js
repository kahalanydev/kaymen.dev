/* ============================================================================
   kaymen.dev — request shield

   New 2026-08-17. Before this, exactly two code paths ever looked at a request
   for anything security-related: the 404 handler, and `/api/track/visit`. So an
   exploit attempt against a route that EXISTS — every /api/* route, every
   static asset, the login form — was invisible, and nothing in the system could
   refuse a request no matter what it contained.

   The shield runs on every request, in front of everything. It:

     1. normalises the client IP (see §1 — this was spoofable),
     2. honours allow rules, then block rules,
     3. asks the threat engine what the request contains,
     4. decides, on score, whether to record it or refuse it,
     5. escalates repeat offenders into time-limited auto-blocks.

   Three rules it will not break, because the failure they prevent is worse than
   anything they let through:

     · It never blocks a private or loopback address. The container talks to
       itself, and a health check that gets a 403 takes the site down.
     · It never blocks an IP carrying an allow rule, and a successful admin or
       staff login writes one. An auto-block that locks Ohav out of production
       at 2am is a self-inflicted outage, and there is no console to undo it
       from.
     · It can be switched off entirely with SHIELD_DISABLED=1 without a deploy.

   All three are in `decide()` where they can be read in one place.
   ============================================================================ */

const { getDb } = require('../db');
const {
  inspectRequest, recordFindings, worstSeverity,
  trackRequest, accumulate, currentScore, clearScore,
} = require('../utils/detection');

// ===== 1. CLIENT IP =========================================================
//
// `app.set('trust proxy', true)` trusts EVERY hop, which makes req.ip the
// leftmost X-Forwarded-For entry — a header the client itself supplies. Under
// that setting anyone could have attributed their traffic to any IP they liked,
// and a blocklist keyed on a value the attacker controls is decoration.
//
// server/index.js now sets `trust proxy` to 1 — exactly the one hop Traefik
// occupies — so req.ip is the address Traefik observed. This function is the
// single place that opinion is expressed, and it normalises the IPv4-mapped
// IPv6 form so `::ffff:1.2.3.4` and `1.2.3.4` are never two different rows.
function clientIp(req) {
  let ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fe80:|fc00:|fd)/i;
function isPrivate(ip) {
  return !ip || ip === 'unknown' || PRIVATE_IP.test(ip);
}

// ===== 2. THRESHOLDS ========================================================
//
// Calibrated against the signature scores in detection.js §2. Changing one of
// these without reading that table is how a shield starts blocking readers.
const BLOCK_ON_REQUEST_SCORE = 60;   // one unambiguous exploit attempt
const BLOCK_ON_WINDOW_SCORE = 150;   // patient scanning over ten minutes
const BLOCK_ON_RATE = 300;           // requests/min — a flood, whatever it contains
const RECORD_FLOOR = 20;             // below this, not worth a row

// Auto-blocks escalate. A first offence is short because IPs are shared and
// reassigned — a CGNAT address that ran one bad request should not carry a
// month-long ban for whoever gets it next.
const BLOCK_DURATIONS_MIN = [60, 360, 1440, 10080]; // 1h, 6h, 24h, 7d

// ===== 3. RULE CACHE ========================================================
//
// Every request consults the rules, and this database is a WASM SQLite held in
// memory whose every write rewrites the whole file to disk (db.js). Querying it
// per request would be wasteful; writing a hit counter per request would be
// actively harmful. So rules are cached, and hits are batched.
let rules = new Map(); // ip -> rule row
let rulesLoadedAt = 0;
const RULES_TTL_MS = 30000;
const pendingHits = new Map(); // ip -> count

function loadRules(force = false) {
  if (!force && Date.now() - rulesLoadedAt < RULES_TTL_MS) return rules;
  try {
    const rows = getDb().prepare(
      "SELECT * FROM ip_rules WHERE expires_at IS NULL OR expires_at > datetime('now')"
    ).all();
    rules = new Map(rows.map(r => [r.ip, r]));
    rulesLoadedAt = Date.now();
  } catch (e) {
    // A failed reload keeps the previous map rather than opening the door.
    console.error('[shield] rule reload failed:', e.message);
  }
  return rules;
}

function ruleFor(ip) {
  const r = loadRules().get(ip);
  if (!r) return null;
  if (r.expires_at && new Date(r.expires_at + 'Z') < new Date()) {
    rules.delete(ip);
    return null;
  }
  return r;
}

// Flushed on a timer, not per request: a sustained attack would otherwise mean
// one full database serialisation per second, for the entire attack.
function flushHits() {
  if (!pendingHits.size) return;
  const db = getDb();
  for (const [ip, n] of pendingHits) {
    try {
      db.prepare("UPDATE ip_rules SET hits = hits + ?, last_hit_at = datetime('now') WHERE ip = ?").run(n, ip);
    } catch { /* the rule was deleted mid-flush; the count goes with it */ }
  }
  pendingHits.clear();
}
setInterval(flushHits, 30000).unref?.();

// ===== 4. RULE MANAGEMENT (used by the security API) ========================

function blockIp({ ip, reason, source = 'manual', severity = 'high', minutes = null, userId = null }) {
  if (isPrivate(ip)) throw new Error('Refusing to block a private or loopback address');
  const db = getDb();
  const existing = db.prepare('SELECT * FROM ip_rules WHERE ip = ?').get(ip);
  if (existing && existing.action === 'allow' && source === 'auto') {
    return null; // an allow rule outranks every automatic decision
  }
  const expires = minutes ? `datetime('now', '+${parseInt(minutes, 10)} minutes')` : 'NULL';
  db.prepare(`
    INSERT INTO ip_rules (ip, action, reason, source, severity, created_by, expires_at)
    VALUES (?, 'block', ?, ?, ?, ?, ${expires})
    ON CONFLICT(ip) DO UPDATE SET
      action='block', reason=excluded.reason, source=excluded.source,
      severity=excluded.severity, expires_at=${expires}, created_at=datetime('now')
  `).run(ip, reason, source, severity, userId);
  loadRules(true);
  return db.prepare('SELECT * FROM ip_rules WHERE ip = ?').get(ip);
}

function allowIp({ ip, reason, source = 'manual', userId = null, minutes = null }) {
  if (isPrivate(ip)) return null;
  const db = getDb();
  const expires = minutes ? `datetime('now', '+${parseInt(minutes, 10)} minutes')` : 'NULL';
  db.prepare(`
    INSERT INTO ip_rules (ip, action, reason, source, severity, created_by, expires_at)
    VALUES (?, 'allow', ?, ?, 'low', ?, ${expires})
    ON CONFLICT(ip) DO UPDATE SET
      action='allow', reason=excluded.reason, source=excluded.source,
      expires_at=${expires}, created_at=datetime('now')
  `).run(ip, reason, source, userId);
  clearScore(ip); // a trusted IP does not carry the score it arrived with
  loadRules(true);
  return db.prepare('SELECT * FROM ip_rules WHERE ip = ?').get(ip);
}

function removeRule(ip) {
  getDb().prepare('DELETE FROM ip_rules WHERE ip = ?').run(ip);
  clearScore(ip);
  loadRules(true);
}

/* How many times this IP has been auto-blocked before, which is what makes the
   next block longer. Read from the event log rather than a counter column so it
   survives an unblock — forgiving a block should not forget the history. */
function priorBlocks(ip) {
  try {
    return getDb().prepare(
      "SELECT COUNT(*) as c FROM suspicious_activity WHERE ip = ? AND blocked = 1 AND category = 'auto_block'"
    ).get(ip).c;
  } catch { return 0; }
}

function autoBlock(ip, reason, severity, ctx) {
  const tier = Math.min(priorBlocks(ip), BLOCK_DURATIONS_MIN.length - 1);
  const minutes = BLOCK_DURATIONS_MIN[tier];
  try {
    blockIp({ ip, reason, source: 'auto', severity, minutes });
    recordFindings(
      [{ id: 'auto_block', score: 100, severity,
         label: `Auto-blocked for ${minutes >= 1440 ? `${minutes / 1440}d` : `${minutes / 60}h`}`,
         detail: reason }],
      { ...ctx, blocked: true }
    );
    console.warn(`[shield] auto-blocked ${ip} for ${minutes}m — ${reason}`);
  } catch (e) {
    console.error('[shield] auto-block failed:', e.message);
  }
}

// ===== 5. THE MIDDLEWARE ====================================================

// Assets are requested by the dozen per page and cannot carry an exploit in a
// path that reached them — express.static only serves what exists. Skipping the
// scan here is a real saving on the common case, not a security hole: a request
// for a path that does NOT exist falls through to the 404 handler, which scans.
const STATIC_RE = /\.(css|js|mjs|svg|png|jpe?g|gif|ico|woff2?|ttf|webp|avif|webmanifest|map)$/i;

function shield(req, res, next) {
  if (process.env.SHIELD_DISABLED === '1') return next();

  const ip = clientIp(req);
  req.clientIp = ip; // everything downstream should use this, not req.ip

  if (isPrivate(ip)) return next();

  const rate = trackRequest(ip);
  const rule = ruleFor(ip);

  // An allow rule exempts an IP from being BLOCKED. It does not exempt it from
  // being watched — those are different powers and conflating them is how a
  // trusted address becomes an unmonitored one. Ohav's own IP carries a rolling
  // allow rule (auth.js writes it on login), and if something starts probing
  // from his network he needs to see it in the feed, not have it silently
  // waved through.
  const trusted = !!(rule && rule.action === 'allow');

  if (rule && rule.action === 'block') {
    pendingHits.set(ip, (pendingHits.get(ip) || 0) + 1);
    return refuse(res);
  }

  if (STATIC_RE.test(req.path)) return next();

  const ctx = {
    ip,
    path: req.originalUrl || req.path,
    method: req.method,
    userAgent: req.headers['user-agent'] || '',
  };

  const { findings, score } = inspectRequest({
    method: req.method,
    path: req.originalUrl || req.path,
    query: req.query,
    userAgent: ctx.userAgent,
    body: req.body,
    referrer: req.headers.referer || req.headers.referrer,
  });

  const windowScore = accumulate(ip, score);
  const decision = decide({ score, windowScore, rate, findings });

  if (decision.block && !trusted) {
    recordFindings(findings, { ...ctx, blocked: true });
    autoBlock(ip, decision.reason, decision.severity, ctx);
    return refuse(res);
  }

  if (decision.block && trusted) {
    // Recorded loudly, and deliberately as its own category: an exemption that
    // fires is worth reading, because it is either Ohav testing something or
    // the trusted-IP rule doing exactly the damage it was designed to risk.
    recordFindings(
      [...findings, { id: 'block_exempted', score: 0, severity: 'high',
        label: 'Block skipped — IP is allow-listed', detail: decision.reason }],
      { ...ctx, blocked: false }
    );
    return next();
  }

  if (score >= RECORD_FLOOR) {
    recordFindings(findings, { ...ctx, blocked: false });
  }

  next();
}

/* Every reason a request gets refused, in one function so the policy can be
   read without reading the middleware around it. */
function decide({ score, windowScore, rate, findings }) {
  if (score >= BLOCK_ON_REQUEST_SCORE) {
    return { block: true, severity: worstSeverity(findings),
      reason: findings.map(f => f.label).slice(0, 3).join(', ') || 'Exploit attempt' };
  }
  if (windowScore >= BLOCK_ON_WINDOW_SCORE) {
    return { block: true, severity: 'high',
      reason: `Sustained probing — ${windowScore} threat score in 10 minutes` };
  }
  if (rate >= BLOCK_ON_RATE) {
    return { block: true, severity: 'high', reason: `Request flood — ${rate}/min` };
  }
  return { block: false };
}

/* Deliberately terse and deliberately not a 429. A refused attacker learns
   nothing from this response: no rule, no threshold, no expiry, no hint about
   which of their requests was the one that did it. */
function refuse(res) {
  res.status(403)
    .set('Content-Type', 'text/plain; charset=utf-8')
    .set('Cache-Control', 'no-store')
    .send('Forbidden');
}

module.exports = {
  shield, clientIp, isPrivate,
  blockIp, allowIp, removeRule, loadRules, ruleFor, flushHits,
  currentScore,
};
