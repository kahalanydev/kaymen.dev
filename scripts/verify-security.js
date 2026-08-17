#!/usr/bin/env node
/**
 * verify-security.js — prove the security and tracking centre actually works.
 *
 *   node scripts/verify-security.js
 *
 * Boots server/index.js against a throwaway DATA_DIR (never data/), then drives
 * the whole pipeline over HTTP and asserts on what came out the other end.
 * Exits non-zero if anything fails.
 *
 * This exists because every claim in this feature is the kind that looks true
 * from the code and is false in practice:
 *
 *   · "heartbeats no longer create rows"  — one stale cached tracker.js and
 *     they do again, and nothing would ever tell you.
 *   · "exploit attempts are refused"      — a middleware registered in the
 *     wrong order silently inspects nothing.
 *   · "the admin cannot be locked out"    — the allow rule is the only thing
 *     standing between an auto-block and a 2am outage with no console.
 *   · "brute force is limited"            — the columns for it existed for
 *     months while nothing read them, which is exactly how that fails.
 *
 * ONE THING WORTH KNOWING: the shield ignores private addresses, so a test
 * running from localhost would engage none of it. Every hostile request below
 * carries an X-Forwarded-For of a TEST-NET-3 address (203.0.113.0/24, reserved
 * for documentation), which the server resolves through `trust proxy = 1`.
 * That also makes this an end-to-end test of the trust-proxy fix itself — under
 * the old `trust proxy: true` these headers would have been taken at face value
 * from any client, which is the vulnerability that setting introduced.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.VERIFY_PORT || 8098);
const DATA_DIR = path.join(ROOT, '.verify-data');
const BASE = `http://localhost:${PORT}`;

const ADMIN_EMAIL = 'ohavkahalany@gmail.com';
const ADMIN_PASSWORD = 'VerifyOnly!2026';

let server, stopping = false, token = null;
const results = [];

function cleanup() {
  if (stopping) return;
  stopping = true;
  if (server) server.kill();
}
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('exit', cleanup);

// ------------------------------------------------------------------ assertions
function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail });
  console.log(`  ${condition ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  return !!condition;
}

// ---------------------------------------------------------------- http helpers
async function req(method, url, { body, headers = {}, auth = false, raw = false } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}
const asAdmin = (url) => req('GET', url, { auth: true });

// An attacker's request: public source address, so the shield engages.
const ATTACKER = '203.0.113.77';
const OTHER_ATTACKER = '203.0.113.99';
const hostile = (url, ip = ATTACKER) =>
  req('GET', url, { headers: { 'X-Forwarded-For': ip, 'User-Agent': 'Mozilla/5.0' }, raw: true });

// ------------------------------------------------------------------------ boot
function boot() {
  return new Promise((resolve, reject) => {
    let log = '', password = null;
    server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
      cwd: ROOT,
      env: { ...process.env, DATA_DIR, PORT: String(PORT), NODE_ENV: 'development' },
    });
    server.stdout.on('data', (c) => {
      log += c;
      const m = log.match(/Password:\s+(\S+)/);
      if (m) password = m[1];
      if (/Server running on port/.test(log)) resolve(password);
    });
    server.stderr.on('data', (c) => process.stderr.write(c));
    server.on('exit', (code) => { if (!stopping) reject(new Error(`server exited (${code})\n${log}`)); });
    setTimeout(() => reject(new Error('server did not start in 20s\n' + log)), 20000);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ======================================================================= tests
async function testTracking() {
  console.log('\nTRACKING PIPELINE');

  const visit = await req('POST', '/api/track/visit', {
    body: {
      sessionId: 'verify-session-1', visitorId: 'verify-visitor-1', isReturning: false,
      path: '/work/torah-tracker', title: 'Torah Tracker', referrer: 'https://news.ycombinator.com/item?id=1',
      screenWidth: 1920, screenHeight: 1080, viewportWidth: 1440, viewportHeight: 900,
      pixelRatio: 2, language: 'en-US', timezone: 'America/New_York',
      utmSource: 'hn', utmMedium: 'social', utmCampaign: 'launch',
    },
  });
  check('visit recorded', visit.success && visit.data.visitId > 0, `id=${visit.data?.visitId}`);
  const visitId = visit.data.visitId;

  // The bug this whole feature started from: path was sent and never stored.
  const visitors = await asAdmin('/api/admin/traffic/visitors?period=1');
  const stored = visitors.data.visits.find(v => v.id === visitId);
  check('landing path is stored', stored && stored.path === '/work/torah-tracker', stored?.path);
  check('viewport + DPR stored', stored && stored.viewport_width === 1440 && stored.pixel_ratio === 2);
  check('UTM stored', stored && stored.utm_source === 'hn');
  check('timezone stored', stored && stored.timezone === 'America/New_York');

  await req('POST', '/api/track/pageview', {
    body: { sessionId: 'verify-session-1', visitId, path: '/work/pcg', title: 'PCG' },
  });
  await req('POST', '/api/track/engagement', {
    body: { sessionId: 'verify-session-1', visitId, path: '/work/pcg',
      scrollDepth: 82, timeOnPage: 240, activeTime: 96 },
  });
  // Out-of-order heartbeat: a late, smaller reading must not overwrite a real one.
  await req('POST', '/api/track/engagement', {
    body: { sessionId: 'verify-session-1', visitId, path: '/work/pcg',
      scrollDepth: 20, timeOnPage: 30, activeTime: 10 },
  });

  await req('POST', '/api/track/event', {
    body: { sessionId: 'verify-session-1', visitId, type: 'click', target: 'nav-contact' },
  });

  const legacy = await req('POST', '/api/track/event', {
    body: { sessionId: 'verify-session-1', visitId, type: 'heartbeat' },
  });
  check('legacy heartbeat event is refused, not stored',
    legacy.success && legacy.data && legacy.data.ignored, legacy.data?.ignored || '');

  const session = await asAdmin('/api/admin/traffic/session/verify-session-1');
  const v = session.data.visit;
  check('engagement kept the HIGH reading, not the last one',
    v.max_scroll === 82 && v.duration_seconds === 240, `scroll=${v.max_scroll} dwell=${v.duration_seconds}`);
  check('active time is separate from wall-clock time',
    v.active_seconds === 96 && v.active_seconds < v.duration_seconds, `active=${v.active_seconds}`);
  check('pageviews recorded (landing + SPA nav)', session.data.pages.length === 2,
    session.data.pages.map(p => p.path).join(' → '));
  check('engagement did NOT create event rows', session.data.events.length === 1,
    `${session.data.events.length} event row(s), expected 1 click`);
  check('timeline merges pages and events', session.data.timeline.length === 3);
}

async function testRollups() {
  console.log('\nROLLUPS + LONG-RUN STATS');

  const traffic = await asAdmin('/api/admin/traffic?period=30');
  const today = traffic.data.daily.find(d => d.date === new Date().toISOString().slice(0, 10));
  check('today is rolled up on demand', !!today, today ? `${today.visits} visit(s)` : 'missing');
  check('rollup counted the visit', today && today.visits >= 1);
  check('rollup counted pageviews', today && today.pageviews >= 2, `pageviews=${today?.pageviews}`);

  const tech = await asAdmin('/api/admin/traffic/tech?period=30');
  const browsers = tech.data.browsers.map(b => b.key);
  check('device breakdown from rollups', tech.data.devices.length > 0,
    tech.data.devices.map(d => `${d.key}:${d.count}`).join(' '));
  check('browser families are collapsed (no version numbers)',
    browsers.every(b => !/\d/.test(b)), browsers.join(' '));

  const geo = await asAdmin('/api/admin/traffic/geo?period=30');
  check('geo endpoint responds', geo.success);

  // The delimiter bug this was rewritten to avoid: a key containing a space
  // must survive the round trip through dimension_daily intact.
  const os = tech.data.operatingSystems.map(o => o.key);
  check('multi-word dimension keys survive storage',
    os.every(k => k && k.length > 1), os.join(' | '));

  const pages = await asAdmin('/api/admin/traffic/pages?period=30');
  check('per-page engagement is reported', pages.data.pages.length >= 2,
    pages.data.pages.map(p => `${p.path}(${p.views})`).join(' '));
}

async function testShield() {
  console.log('\nSHIELD — PAYLOAD INSPECTION AND BLOCKING');

  const ok = await hostile('/work/torah-tracker');
  check('an ordinary request passes', ok.status === 200, `status=${ok.status}`);

  // Below the block threshold: recorded, not refused. The point of a scored
  // engine rather than a blocklist of paths is that this distinction exists at
  // all — one mildly odd request is not an attack, and treating it as one is
  // how a shield starts refusing readers.
  const mild = await hostile('/server-status', OTHER_ATTACKER);
  check('a low-score probe is recorded but NOT blocked', mild.status === 404,
    `status=${mild.status}`);
  const stillIn = await hostile('/', OTHER_ATTACKER);
  check('...and that IP is still allowed through', stillIn.status === 200,
    `status=${stillIn.status}`);

  // Two signatures stacking (CMS probe + server-language probe) clears the
  // threshold that neither reaches alone. That is the scoring model working:
  // nothing had to anticipate this exact path.
  const cms = await hostile('/wp-admin/setup-config.php', OTHER_ATTACKER);
  check('a wp-admin PHP probe stacks to a block', cms.status === 403,
    `status=${cms.status}`);

  // Above it: refused on sight.
  const sqli = await hostile("/search?q=1'%20UNION%20SELECT%20password%20FROM%20users--");
  check('SQL injection is refused', sqli.status === 403, `status=${sqli.status}`);

  const traversal = await hostile('/static/../../../../etc/passwd');
  check('path traversal is refused', traversal.status === 403, `status=${traversal.status}`);

  // The IP is now auto-blocked, so even a harmless request from it is refused.
  const afterBlock = await hostile('/');
  check('the attacking IP is now blocked outright', afterBlock.status === 403,
    `status=${afterBlock.status}`);

  const rules = await asAdmin('/api/admin/security/rules');
  const autoRule = rules.data.rules.find(r => r.ip === ATTACKER && r.action === 'block');
  check('an auto-block rule was written', !!autoRule, autoRule?.reason);
  check('the auto-block expires (not permanent)', autoRule && autoRule.expires_at,
    autoRule?.expires_at || 'no expiry — would be permanent');

  const events = await asAdmin('/api/admin/security/events?period=1');
  const cats = new Set(events.data.events.map(e => e.category));
  check('findings are categorised for filtering', cats.size >= 2, [...cats].join(' '));
  check('blocked findings are marked as blocked',
    events.data.events.some(e => e.blocked === 1));

  const dossier = await asAdmin(`/api/admin/security/ip/${ATTACKER}`);
  check('IP dossier assembles the whole picture',
    dossier.data.threats.length > 0 && dossier.data.rule,
    `${dossier.data.threats.length} threat(s), score ${dossier.data.threatSummary.total_score}`);

  const overview = await asAdmin('/api/admin/security?period=1');
  check('posture is derived and reports the alert',
    overview.data.posture.level === 'alert', overview.data.posture.headline);
}

async function testAdminLockoutSafety() {
  console.log('\nTHE ADMIN MUST NOT BE ABLE TO LOCK HIMSELF OUT');

  const TRUSTED = '203.0.113.10';
  await req('POST', '/api/admin/security/rules', {
    auth: true,
    body: { ip: TRUSTED, action: 'allow', reason: 'Verification — simulated admin IP' },
  });

  const attack = await hostile('/index.php?cmd=;cat%20/etc/passwd', TRUSTED);
  check('an allow-listed IP is NOT blocked by an exploit attempt',
    attack.status !== 403, `status=${attack.status}`);

  const still = await hostile('/', TRUSTED);
  check('...and stays reachable afterwards', still.status === 200, `status=${still.status}`);

  const events = await asAdmin('/api/admin/security/events?period=1');
  check('...but the attempt is still recorded, not waved through silently',
    events.data.events.some(e => e.category === 'block_exempted'));

  const refuse = await req('POST', '/api/admin/security/rules', {
    auth: true,
    body: { ip: '127.0.0.1', action: 'block', reason: 'should be refused' },
  });
  check('blocking a loopback address is refused', refuse.status === 400, refuse.error);

  const noReason = await req('POST', '/api/admin/security/rules', {
    auth: true, body: { ip: '198.51.100.5', action: 'block' },
  });
  check('a block without a reason is refused', noReason.status === 400, noReason.error);
}

async function testBruteForce() {
  console.log('\nBRUTE-FORCE LOCKOUT');

  const email = 'lockout-test@example.com';
  // Create a user to lock out, so the run never risks the real admin account.
  await req('POST', '/api/auth/users', {
    auth: true, body: { email, name: 'Lockout Test', role: 'staff' },
  });

  let statuses = [];
  for (let i = 0; i < 5; i++) {
    const r = await req('POST', '/api/auth/login', {
      body: { email, password: 'definitely-wrong' },
      headers: { 'X-Forwarded-For': '198.51.100.42' },
    });
    statuses.push(r.status);
  }
  check('failed logins are rejected', statuses.every(s => s === 401), statuses.join(','));

  const authLog = await asAdmin('/api/admin/security/auth?period=1');
  const failed = authLog.data.events.filter(e => e.event === 'login_failed' && e.email === email);
  const lockout = authLog.data.events.filter(e => e.event === 'lockout' && e.email === email);
  check('every failed attempt is logged with its IP',
    failed.length >= 4 && failed.every(e => e.ip === '198.51.100.42'), `${failed.length} logged`);
  check('the fifth attempt triggers a lockout', lockout.length === 1);
  check('the locked account is surfaced to the panel',
    authLog.data.locked.some(u => u.email === email));

  const blocked = await req('POST', '/api/auth/login', {
    body: { email, password: 'definitely-wrong' },
  });
  check('a locked account is refused', blocked.status === 401);

  const enumeration = await req('POST', '/api/auth/login', {
    body: { email: 'nobody@example.com', password: 'x' },
  });
  check('an unknown address gets the SAME error as a wrong password',
    enumeration.error === blocked.error, `"${enumeration.error}"`);

  const log2 = await asAdmin('/api/admin/security/auth?period=1');
  check('attempts against non-existent accounts are logged too',
    log2.data.events.some(e => e.email === 'nobody@example.com'));
}

// ======================================================================== main
(async () => {
  if (fs.existsSync(DATA_DIR)) {
    try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
  }

  console.log(`Booting a throwaway server on :${PORT} (data in .verify-data/)`);
  const bootPassword = await boot();
  await sleep(400);

  const first = await req('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: bootPassword } });
  token = first.data.token;
  await req('POST', '/api/auth/change-password', {
    auth: true, body: { current_password: bootPassword, new_password: ADMIN_PASSWORD },
  });
  const again = await req('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  token = again.data.token;

  try {
    await testTracking();
    await testRollups();
    await testShield();
    await testAdminLockoutSafety();
    await testBruteForce();
  } catch (err) {
    console.error('\nRUN FAILED:', err.message);
    results.push({ name: 'run completed', pass: false, detail: err.message });
  }

  const failed = results.filter(r => !r.pass);
  console.log(`\n${'='.repeat(58)}`);
  console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log(`  FAILED:`);
    for (const f of failed) console.log(`    · ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  console.log(`${'='.repeat(58)}\n`);

  cleanup();
  process.exit(failed.length ? 1 : 0);
})();
