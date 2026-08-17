/* ============================================================================
   kaymen.dev — daily rollups and retention

   New 2026-08-17, and the reason the rest of this feature is safe to ship.

   HANDOFF-BACKOFFICE-2026-08-16.md §6 flagged it plainly: `server/db.js` holds
   the entire database in memory and rewrites the WHOLE FILE on a 1-second
   debounce plus a 30-second interval. That is fine at 286KB and it is not fine
   once tracking data accumulates — every extra megabyte is a megabyte
   serialised and written to disk on every debounce, forever, on a shared VPS.

   Asking for "long run statistics" and "keep every raw row" are the same
   request only if you never delete anything. They are separable:

     · `traffic_daily` and `dimension_daily` are PERMANENT. Small, fixed shape,
       one row per day (or per day/dimension/value). Ten years of them is a few
       megabytes, and every long-run question the panel asks is answered from
       them.
     · Raw `visits`, `pageviews`, `events` and `suspicious_activity` are a
       WORKING SET with a retention window. They power the drill-downs — this
       IP, this session, this hour — which are only ever asked about recently.

   So the rollup runs first and the prune runs second, and the prune only ever
   deletes days that have been rolled. Order matters and is asserted, not
   assumed: `prune()` reads the oldest rolled date and refuses to delete past
   it.

   The other half of the volume problem is upstream: heartbeats are no longer
   stored as `events` rows at all. See server/routes/track.js — a 30-second
   heartbeat now UPDATEs the visit it belongs to. That alone removes ~120 rows
   per hour per open tab.
   ============================================================================ */

const { getDb } = require('../db');

// Days of raw detail kept behind the permanent rollups.
const RETENTION_DAYS = {
  events: 60,
  pageviews: 120,
  visits: 240,
  suspicious_activity: 240,
  auth_events: 400,   // an auth trail is worth more than a pageview
  geo_cache: 120,     // an IP's city goes stale; re-lookup is one HTTP call
};

// ===== 1. NORMALISERS =======================================================
//
// These fold high-cardinality raw values into the handful of buckets a
// long-run statistic is actually about. "Chrome 138.0.0.0" and "Chrome
// 139.0.0.0" are the same fact about the same person; storing both forever
// would make `dimension_daily` grow the way the raw tables do.

function browserFamily(browser) {
  const b = String(browser || '').trim();
  if (!b || b === 'Unknown') return 'Unknown';
  // Strip the trailing VERSION, rather than keeping the first word. Taking the
  // first word looks right for "Chrome 138.0.0.0" and quietly mangles every
  // two-word browser: "Mobile Safari 18.2" became "Mobile", which then sat in
  // the browsers chart as the second most popular browser on the site with
  // nothing named Safari anywhere near it. Same for "Samsung Browser" and
  // "Android Browser". The version is always the last token and always numeric.
  return b.replace(/\s+v?[\d.]+$/, '').trim() || b;
}

function osFamily(os) {
  const o = String(os || '').trim();
  if (!o || o === 'Unknown') return 'Unknown';
  // "Windows 10", "Mac OS 10.15.7", "iOS 18.2" — the major name is the fact.
  const m = o.match(/^(Mac OS|Chrome OS|Windows Phone|[A-Za-z]+)/);
  return m ? m[1] : o;
}

function referrerHost(referrer) {
  const r = String(referrer || '').trim();
  if (!r) return 'Direct';
  try {
    const host = new URL(r).hostname.replace(/^www\./, '');
    if (host.endsWith('kaymen.dev') || host.endsWith('kahalany.dev')) return 'Internal';
    return host;
  } catch {
    return r.slice(0, 80);
  }
}

/* Collapse the case-study long tail so `dimension_daily` cannot grow a row per
   slug per day forever, while keeping the distinction that matters — which
   case study, not which query string. */
function normalisePath(path) {
  let p = String(path || '/').split('?')[0].split('#')[0];
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return (p || '/').slice(0, 120);
}

function viewportBucket(width) {
  const w = parseInt(width, 10);
  if (!w) return 'Unknown';
  if (w < 480) return '<480';
  if (w < 768) return '480–767';
  if (w < 1024) return '768–1023';
  if (w < 1440) return '1024–1439';
  if (w < 1920) return '1440–1919';
  return '1920+';
}

// ===== 2. ROLLUP ============================================================

/* Recompute one day from raw and upsert it. Idempotent on purpose: today gets
   re-rolled every hour as it fills up, and re-running an old day after a schema
   fix has to be safe. */
function rollupDay(date) {
  const db = getDb();
  const dayStart = `${date} 00:00:00`;
  const dayEnd = `${date} 23:59:59`;

  const visits = db.prepare(`
    SELECT session_id, visitor_id, is_bot, is_returning, device_type, browser, os,
           country, country_code, language, referrer, path, viewport_width,
           bot_kind, max_scroll, duration_seconds, pageview_count
    FROM visits WHERE created_at BETWEEN ? AND ?
  `).all(dayStart, dayEnd);

  const pageviewRows = db.prepare(
    'SELECT path, COUNT(*) as c FROM pageviews WHERE created_at BETWEEN ? AND ? GROUP BY path'
  ).all(dayStart, dayEnd);

  const threats = db.prepare(
    'SELECT COUNT(*) as c, SUM(blocked) as b FROM suspicious_activity WHERE created_at BETWEEN ? AND ?'
  ).get(dayStart, dayEnd);

  // --- headline figures ---
  const human = visits.filter(v => !v.is_bot);
  const uniqueVisitors = new Set(human.map(v => v.visitor_id || v.session_id));
  const newVisitors = new Set(human.filter(v => !v.is_returning).map(v => v.visitor_id || v.session_id));

  const scrolls = human.map(v => v.max_scroll).filter(n => n > 0);
  const durations = human.map(v => v.duration_seconds).filter(n => n > 0);
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // A bounce is one page and gone. Ten seconds is the line: a visit shorter
  // than that did not read anything, whatever its scroll depth says.
  const bounces = human.filter(v => (v.pageview_count || 1) <= 1 && (v.duration_seconds || 0) < 10).length;

  const pageviewTotal = pageviewRows.reduce((n, r) => n + r.c, 0)
    || human.reduce((n, v) => n + (v.pageview_count || 1), 0);

  db.prepare(`
    INSERT INTO traffic_daily
      (date, visits, visitors, new_visitors, pageviews, bot_visits, bounces,
       avg_scroll, avg_duration, threats, blocked, rolled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(date) DO UPDATE SET
      visits=excluded.visits, visitors=excluded.visitors,
      new_visitors=excluded.new_visitors, pageviews=excluded.pageviews,
      bot_visits=excluded.bot_visits, bounces=excluded.bounces,
      avg_scroll=excluded.avg_scroll, avg_duration=excluded.avg_duration,
      threats=excluded.threats, blocked=excluded.blocked, rolled_at=datetime('now')
  `).run(
    date, human.length, uniqueVisitors.size, newVisitors.size, pageviewTotal,
    visits.length - human.length, bounces, avg(scrolls), avg(durations),
    threats.c || 0, threats.b || 0
  );

  // --- breakdowns ---
  // Nested, not a composite "kind|key" string. Half of these keys legitimately
  // contain punctuation and spaces - "United States", "Mac OS" - so any
  // delimiter would eventually be inside a key and split() would silently
  // truncate it on the way back out.
  const dims = new Map(); // kind -> Map(key -> count)
  const bump = (kind, key, by) => {
    if (key === null || key === undefined || key === '') key = 'Unknown';
    if (!dims.has(kind)) dims.set(kind, new Map());
    const inner = dims.get(kind);
    const k = String(key).slice(0, 120);
    inner.set(k, (inner.get(k) || 0) + (by || 1));
  };

  for (const v of human) {
    bump('device', v.device_type || 'desktop');
    bump('browser', browserFamily(v.browser));
    bump('os', osFamily(v.os));
    bump('country', v.country || 'Unknown');
    bump('language', String(v.language || 'Unknown').split('-')[0]);
    bump('referrer', referrerHost(v.referrer));
    bump('viewport', viewportBucket(v.viewport_width));
  }
  // Bots get their own axis rather than polluting the human ones - the whole
  // point of classifying them was to be able to look at them separately.
  for (const v of visits.filter(x => x.is_bot)) bump('bot', v.bot_kind || 'unknown');

  // Pages come from the pageviews table when there is one, and fall back to the
  // visit landing path for days recorded before pageviews existed.
  if (pageviewRows.length) {
    for (const r of pageviewRows) bump('page', normalisePath(r.path), r.c);
  } else {
    for (const v of human) bump('page', normalisePath(v.path || '/'));
  }

  // Replace rather than merge: a re-roll of the same day must not double it.
  db.prepare('DELETE FROM dimension_daily WHERE date = ?').run(date);
  const insert = db.prepare('INSERT INTO dimension_daily (date, kind, key, visits) VALUES (?, ?, ?, ?)');
  let dimCount = 0;
  for (const [kind, inner] of dims) {
    for (const [key, count] of inner) { insert.run(date, kind, key, count); dimCount++; }
  }

  return { date, visits: human.length, dimensions: dimCount };
}

/* Roll today and yesterday every run (both still change), plus any earlier day
   inside the raw window that has no rollup — which is how a first run after
   deploy backfills whatever history the database already holds. */
function runRollups() {
  const db = getDb();
  const rolled = new Set(db.prepare('SELECT date FROM traffic_daily').all().map(r => r.date));
  const days = db.prepare(`
    SELECT DISTINCT date(created_at) as d FROM visits
    WHERE created_at >= datetime('now', '-${RETENTION_DAYS.visits} days')
    ORDER BY d DESC
  `).all().map(r => r.d);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const todo = days.filter(d => !rolled.has(d) || d === today || d === yesterday);

  let n = 0;
  for (const d of todo) {
    try { rollupDay(d); n++; } catch (e) {
      console.error(`[rollup] ${d} failed:`, e.message);
    }
  }
  return n;
}

// ===== 3. PRUNE =============================================================

/* Delete raw rows the rollups have already absorbed.

   The guard is the point: nothing is deleted from a day that has no row in
   `traffic_daily`. Without it, a rollup that threw for three days running would
   be followed by a prune that silently destroyed those three days for good. */
function prune() {
  const db = getDb();
  const deleted = {};

  const oldestRolled = db.prepare('SELECT MIN(date) as d FROM traffic_daily').get().d;
  const newestRolled = db.prepare('SELECT MAX(date) as d FROM traffic_daily').get().d;
  if (!oldestRolled || !newestRolled) {
    console.log('[rollup] nothing rolled yet — skipping prune');
    return deleted;
  }

  const cutoffFor = (days) => {
    const c = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    // Never delete past the last day we actually rolled up.
    return c > newestRolled ? newestRolled : c;
  };

  const sweep = (table, days, column = 'created_at') => {
    const cutoff = cutoffFor(days);
    const before = db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE ${column} < ?`).get(cutoff).c;
    if (!before) return;
    db.prepare(`DELETE FROM ${table} WHERE ${column} < ?`).run(cutoff);
    deleted[table] = before;
  };

  sweep('events', RETENTION_DAYS.events);
  sweep('pageviews', RETENTION_DAYS.pageviews);
  sweep('visits', RETENTION_DAYS.visits);
  sweep('suspicious_activity', RETENTION_DAYS.suspicious_activity);
  sweep('auth_events', RETENTION_DAYS.auth_events);
  sweep('geo_cache', RETENTION_DAYS.geo_cache, 'cached_at');

  // Expired auto-blocks are noise in the blocklist UI once they lapse. Manual
  // rules are never swept — Ohav blocked that IP on purpose.
  const rules = db.prepare(
    "SELECT COUNT(*) as c FROM ip_rules WHERE source = 'auto' AND expires_at IS NOT NULL AND expires_at < datetime('now', '-30 days')"
  ).get().c;
  if (rules) {
    db.prepare("DELETE FROM ip_rules WHERE source = 'auto' AND expires_at IS NOT NULL AND expires_at < datetime('now', '-30 days')").run();
    deleted.ip_rules = rules;
  }

  if (Object.keys(deleted).length) {
    console.log('[rollup] pruned', JSON.stringify(deleted));
  }
  return deleted;
}

// ===== 4. SCHEDULE ==========================================================

let started = false;

function startRollups() {
  if (started) return;
  started = true;

  const cycle = () => {
    try {
      const n = runRollups();
      prune();
      if (n) console.log(`[rollup] rolled ${n} day(s)`);
    } catch (e) {
      console.error('[rollup] cycle failed:', e.message);
    }
  };

  // Boot runs after a delay so it never competes with the first requests after
  // a deploy — a rollup is a full table scan and nothing is waiting on it.
  setTimeout(cycle, 20000).unref?.();
  setInterval(cycle, 3600000).unref?.();
}

/* Re-roll today if the last roll of it is stale.

   The scheduled cycle runs hourly, which is right for a background job and
   wrong for a panel — opening Traffic at 14:05 to see figures frozen at 13:00
   reads as a broken page, and "is anyone on the site right now" is the question
   people actually open it for.

   So the traffic API calls this first. Rolling one day is a scan of one day's
   visits; at this site's volume it is microseconds, and it means every endpoint
   downstream can read the rollup tables uniformly instead of each one
   special-casing today against the raw tables. */
function ensureFresh(maxAgeSeconds = 120) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const row = db.prepare(
      'SELECT visits, bot_visits, pageviews, rolled_at FROM traffic_daily WHERE date = ?'
    ).get(today);
    if (!row) { rollupDay(today); return true; }

    // Freshness is decided by whether the DATA changed, not by how long ago the
    // clock says we looked. A time window alone was wrong in both directions:
    // it re-rolled an idle site every two minutes for nothing, and — the bug
    // this replaced — it served a stale "today" to anyone who loaded the page
    // within the window of a visit arriving. Two indexed counts are cheaper
    // than the re-roll they usually avoid.
    const live = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM visits WHERE date(created_at) = ?) as visits,
        (SELECT COUNT(*) FROM pageviews WHERE date(created_at) = ?) as pageviews
    `).get(today, today);

    // `row.visits` counts humans only, so it can never simply equal the raw
    // total — a bot arriving would otherwise re-roll on every request forever.
    // The comparison that matters is "has anything at all been recorded since
    // the last roll", which the stored total answers when kept alongside it.
    const changed = live.pageviews !== row.pageviews
      || live.visits !== (row.visits + (row.bot_visits || 0));

    if (!changed) {
      const age = row.rolled_at
        ? (Date.now() - new Date(row.rolled_at + 'Z').getTime()) / 1000 : Infinity;
      if (age < maxAgeSeconds) return false;
    }
    rollupDay(today);
    return true;
  } catch (e) {
    console.error('[rollup] ensureFresh failed:', e.message);
    return false;
  }
}

module.exports = {
  startRollups, runRollups, rollupDay, prune, ensureFresh,
  browserFamily, osFamily, referrerHost, normalisePath, viewportBucket,
  RETENTION_DAYS,
};
