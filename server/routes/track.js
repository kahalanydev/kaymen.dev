/* ============================================================================
   kaymen.dev — tracking ingest

   Rewritten 2026-08-17 alongside tracker.js. Four endpoints, and the split
   between them is the whole design:

     POST /visit       one row per session. INSERT.
     POST /pageview    one row per page within it. INSERT.
     POST /engagement  scroll, dwell and active time. UPDATE — never INSERT.
     POST /event       clicks and section views. INSERT, low volume.

   /engagement is the load-bearing one. It used to be `/event` with
   `type: heartbeat`, which meant a row every thirty seconds per open tab,
   accumulating in a database that is held in memory and rewritten to disk in
   full on every save (db.js). An open tab overnight was ~1,000 rows describing
   one visit. It is now an UPDATE against the visit and its current pageview, so
   that same tab is two rows no matter how long it stays open.

   These are PUBLIC endpoints — anyone can POST to them — so they are rate
   limited per IP and every string is length-capped on the way in. The old ones
   were neither, and a single script could have grown the database without
   limit.
   ============================================================================ */

const express = require('express');
const UAParser = require('ua-parser-js');
const { getDb } = require('../db');
const { classifyUserAgent, checkSuspicious } = require('../utils/detection');
const { rateLimit } = require('../middleware/auth');
const { clientIp } = require('../middleware/shield');

const router = express.Router();

// A real visitor generates a handful of these a minute. 240 leaves enormous
// headroom for a fast reader with several tabs open and still stops a script.
router.use(rateLimit(240, 60000));

// Every free-text field that reaches a column gets clipped here rather than at
// the database, because sql.js will happily store a 2MB "path".
const cap = (v, n) => (v === null || v === undefined ? null : String(v).slice(0, n));
const num = (v, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return max && n > max ? max : n;
};

// ===== GEO ==================================================================
//
// ip-api's free endpoint, unchanged in spirit but now asking for the three
// fields that were being left on the table: countryCode (for flags and for
// grouping that does not depend on spelling), org and `as` (the ASN — what
// tells a datacentre range apart from a phone), and the IP's own timezone.
//
// Free tier is 45 lookups/minute from one address. Concurrency is capped so a
// burst of new visitors cannot get the server rate-limited out of geo entirely,
// and every failure is silent: geo is decoration, never a reason to lose a hit.
const GEO_FIELDS = 'status,country,countryCode,regionName,city,lat,lon,isp,org,as,timezone';
let geoInFlight = 0;
const GEO_MAX_CONCURRENT = 4;

async function lookupGeo(ip) {
  const db = getDb();
  const cached = db.prepare('SELECT * FROM geo_cache WHERE ip = ?').get(ip);
  if (cached) return cached;

  if (!ip || ip === 'unknown') return null;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fe80:|fc00:|fd)/i.test(ip)) return null;
  if (geoInFlight >= GEO_MAX_CONCURRENT) return null;

  geoInFlight++;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${GEO_FIELDS}`,
      { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.status !== 'success' || !d.country) return null;

    db.prepare(`
      INSERT OR REPLACE INTO geo_cache
        (ip, country, country_code, city, region, lat, lon, isp, org, asn, timezone, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(ip, d.country, d.countryCode || null, d.city || null, d.regionName || null,
      d.lat || null, d.lon || null, d.isp || null, d.org || null, d.as || null, d.timezone || null);
    return { ...d, country_code: d.countryCode, region: d.regionName };
  } catch {
    return null; // best-effort, always
  } finally {
    geoInFlight--;
  }
}

// ===== POST /api/track/visit ================================================
router.post('/visit', (req, res) => {
  const db = getDb();
  const ip = req.clientIp || clientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const b = req.body || {};

  if (!b.sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId required' });
  }

  const ua = new UAParser(userAgent);
  const browser = ua.getBrowser();
  const os = ua.getOS();
  const device = ua.getDevice();
  const browserName = browser.name ? `${browser.name} ${browser.version || ''}`.trim() : 'Unknown';
  const osName = os.name ? `${os.name} ${os.version || ''}`.trim() : 'Unknown';

  // Classification, not a boolean. `is_bot` keeps its meaning for every query
  // written against it; `bot_kind` is what makes Googlebot and sqlmap
  // separable, which is the whole reason the threat engine returns a kind.
  const cls = classifyUserAgent(userAgent);
  const path = cap(b.path, 300) || '/';

  const result = db.prepare(`
    INSERT INTO visits (
      session_id, visitor_id, is_returning, ip, user_agent, referrer, path,
      device_type, browser, os, screen_width, screen_height,
      viewport_width, viewport_height, pixel_ratio, language, timezone,
      utm_source, utm_medium, utm_campaign, is_bot, bot_kind,
      pageview_count, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `).run(
    cap(b.sessionId, 64), cap(b.visitorId, 64), b.isReturning ? 1 : 0,
    ip, cap(userAgent, 500), cap(b.referrer, 500) || null, path,
    device.type || 'desktop', browserName, osName,
    num(b.screenWidth, 20000), num(b.screenHeight, 20000),
    num(b.viewportWidth, 20000), num(b.viewportHeight, 20000),
    Number(b.pixelRatio) > 0 && Number(b.pixelRatio) < 10 ? Number(b.pixelRatio) : null,
    cap(b.language, 20), cap(b.timezone, 60),
    cap(b.utmSource, 120), cap(b.utmMedium, 120), cap(b.utmCampaign, 120),
    cls.isBot ? 1 : 0, cls.isBot ? cls.kind : null
  );

  const visitId = result.lastInsertRowid;

  // The landing page is a pageview like any other. Recording it here rather
  // than waiting for the tracker to send one means a visitor who reads exactly
  // one page and leaves still appears in the pages report — which is most of
  // them.
  db.prepare(`
    INSERT INTO pageviews (visit_id, session_id, path, title, referrer)
    VALUES (?, ?, ?, ?, ?)
  `).run(visitId, cap(b.sessionId, 64), path, cap(b.title, 200), cap(b.referrer, 500) || null);

  checkSuspicious(ip, userAgent, path);

  lookupGeo(ip).then(geo => {
    if (!geo) return;
    db.prepare('UPDATE visits SET country = ?, country_code = ?, city = ?, region = ?, asn = ? WHERE id = ?')
      .run(geo.country, geo.country_code || geo.countryCode || null, geo.city,
        geo.region || geo.regionName, geo.asn || geo.as || null, visitId);
  }).catch(() => {});

  res.json({ success: true, data: { visitId } });
});

// ===== POST /api/track/pageview =============================================
router.post('/pageview', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.sessionId || !b.path) {
    return res.status(400).json({ success: false, error: 'sessionId and path required' });
  }

  db.prepare(`
    INSERT INTO pageviews (visit_id, session_id, path, title, referrer)
    VALUES (?, ?, ?, ?, ?)
  `).run(num(b.visitId) || null, cap(b.sessionId, 64), cap(b.path, 300),
    cap(b.title, 200), cap(b.referrer, 500) || null);

  if (b.visitId) {
    db.prepare(`
      UPDATE visits SET pageview_count = pageview_count + 1, last_seen_at = datetime('now')
      WHERE id = ?
    `).run(num(b.visitId));
  }

  res.json({ success: true });
});

// ===== POST /api/track/engagement ===========================================
//
// The one that must never INSERT. Scroll depth and dwell are properties OF a
// visit, so they belong on the visit row; keeping them in an event stream meant
// the figures were destroyed by exactly the pruning that makes long-run stats
// affordable (rollup.js).
//
// GREATEST() is not available in SQLite, so max_scroll uses a CASE — and it has
// to, because heartbeats arrive out of order often enough that a plain
// assignment would let a late 20% overwrite a real 90%.
router.post('/engagement', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const visitId = num(b.visitId);
  if (!visitId || !b.sessionId) {
    return res.status(400).json({ success: false, error: 'visitId and sessionId required' });
  }

  const scroll = num(b.scrollDepth, 100) || 0;
  // A day is the ceiling for a single visit: anything longer is a machine, a
  // clock change, or a forged payload, and averaging it in would wreck the
  // figure for everyone else.
  const dwell = num(b.timeOnPage, 86400) || 0;
  const active = Math.min(num(b.activeTime, 86400) || 0, dwell);

  db.prepare(`
    UPDATE visits SET
      duration_seconds = CASE WHEN ? > duration_seconds THEN ? ELSE duration_seconds END,
      active_seconds   = CASE WHEN ? > active_seconds   THEN ? ELSE active_seconds   END,
      max_scroll       = CASE WHEN ? > max_scroll       THEN ? ELSE max_scroll       END,
      last_seen_at     = datetime('now')
    WHERE id = ?
  `).run(dwell, dwell, active, active, scroll, scroll, visitId);

  // Attribute to the page that was actually open — the most recent pageview for
  // this session on this path.
  if (b.path) {
    const pv = db.prepare(
      'SELECT id FROM pageviews WHERE session_id = ? AND path = ? ORDER BY id DESC LIMIT 1'
    ).get(cap(b.sessionId, 64), cap(b.path, 300));
    if (pv) {
      db.prepare(`
        UPDATE pageviews SET
          duration_seconds = CASE WHEN ? > duration_seconds THEN ? ELSE duration_seconds END,
          active_seconds   = CASE WHEN ? > active_seconds   THEN ? ELSE active_seconds   END,
          max_scroll       = CASE WHEN ? > max_scroll       THEN ? ELSE max_scroll       END
        WHERE id = ?
      `).run(dwell, dwell, active, active, scroll, scroll, pv.id);
    }
  }

  res.json({ success: true });
});

// ===== POST /api/track/event ================================================
router.post('/event', (req, res) => {
  const db = getDb();
  const b = req.body || {};

  if (!b.sessionId || !b.type) {
    return res.status(400).json({ success: false, error: 'sessionId and type required' });
  }

  // Heartbeats are not events any more and must not be able to come back in
  // through this door — an old cached tracker.js in somebody's browser would
  // otherwise keep writing the rows this rewrite exists to stop.
  if (b.type === 'heartbeat' || b.type === 'leave') {
    return res.json({ success: true, data: { ignored: 'superseded by /engagement' } });
  }

  const ALLOWED = ['click', 'section_view', 'form_submit', 'download', 'outbound'];
  if (!ALLOWED.includes(b.type)) {
    return res.status(400).json({ success: false, error: 'Unknown event type' });
  }

  let metadata = null;
  if (b.metadata && typeof b.metadata === 'object') {
    const json = JSON.stringify(b.metadata);
    if (json.length <= 1000) metadata = json;
  }

  db.prepare(`
    INSERT INTO events (visit_id, session_id, event_type, target, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(num(b.visitId) || null, cap(b.sessionId, 64), cap(b.type, 40), cap(b.target, 200), metadata);

  res.json({ success: true });
});

module.exports = router;
