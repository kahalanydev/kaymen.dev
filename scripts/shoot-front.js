#!/usr/bin/env node
/**
 * Photographs a PUBLIC front end at both the strip size and a phone crop.
 *
 *   node scripts/shoot-front.js <name> <url> [--scroll=PX] [--settle=MS]
 *   node scripts/shoot-front.js --all
 *
 * Writes assets/shots/<name>-front.jpg   900x562   (the desktop strip contract)
 *        assets/shots/<name>-front-m.jpg 390x620   (the mobile crop, @2x)
 *
 * WHY THIS IS DIFFERENT FROM shoot-app.js, and it is the whole point:
 * shoot-app.js photographs a BACK OFFICE, which is why every one of those shots
 * must come from a local instance on a freshly seeded database — those systems
 * hold borrowers, riders and students. These are PUBLIC pages the client has
 * already published themselves, so production is the correct source and there
 * is no seeding to do.
 *
 * That does NOT make them consequence-free. A public page can still show real
 * people the client chose to publish — Horse & Harmony's hero is a photograph
 * of two children on horseback. Republishing that in our portfolio is our
 * decision, not theirs, and it belongs in the consent conversation rather than
 * in a script. Check every shot before it ships.
 *
 * The desktop size matches the strip's hard-coded width/height in
 * server/render.js. Nothing downstream would catch a wrong one, so it asserts.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const OUT_W = 900, OUT_H = 562;
const M_W = 390, M_H = 620;

/* The public front ends, and what sits behind each. Kept here rather than in
   content/projects.js because this is a build tool: projects.js records what is
   TRUE about a project, this records how to photograph it. */
const FRONTS = [
  { name: 'bridgemtg',    url: 'http://bridgemtg.com/',          settle: 2600 },
  { name: 'horseharmony', url: 'https://horseandharmonyil.com/', settle: 3000 },
  { name: 'olami',        url: 'https://olamiherzliya.org/',     settle: 3000 },
  { name: 'richmount',    url: 'https://richmountcapital.com/',  settle: 2600 },
  { name: 'davenen',      url: 'https://davenen.org/',           settle: 2600 },
  { name: 'kartov',       url: 'https://kartov.app/',            settle: 2600 },
];

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.join(__dirname, '..');

async function cdp(port) {
  let list;
  for (let i = 0; i < 40; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list.some((t) => t.type === 'page')) break;
    } catch { /* not up */ }
    await sleep(250);
  }
  const page = (list || []).find((t) => t.type === 'page');
  if (!page) throw new Error('Chrome started but never exposed a page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send };
}

(async () => {
  const args = process.argv.slice(2);
  let jobs;
  if (args[0] === '--all') jobs = FRONTS;
  else if (args.length >= 2) jobs = [{ name: args[0], url: args[1], settle: 2600 }];
  else {
    console.error('usage: node scripts/shoot-front.js <name> <url>   |   --all');
    process.exit(1);
  }

  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome or Edge found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-front-'));
  const port = 9391;
  const chrome = spawn(exe, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  const { send } = await cdp(port);
  await send('Page.enable');
  await send('Runtime.enable');

  const shoot = async (url, w, h, mobile, settle, file) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile,
    });
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) {
      const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      if (r.result?.result?.value === 'complete') break;
      await sleep(250);
    }
    /* Scroll to the bottom and back: lazy-loaded hero images and fade-in
       reveals are the norm on these sites, and a shot taken before they fire
       is a blank box that looks like a broken build. */
    await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
    await sleep(900);
    await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
    await sleep(settle);
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    const buf = Buffer.from(shot.result.data, 'base64');
    fs.writeFileSync(file, buf);
    return buf.length;
  };

  for (const j of jobs) {
    const d = path.join(ROOT, 'assets', 'shots', j.name + '-front.jpg');
    const m = path.join(ROOT, 'assets', 'shots', j.name + '-front-m.jpg');
    const dn = await shoot(j.url, OUT_W, OUT_H, false, j.settle, d);
    const mn = await shoot(j.url, M_W, M_H, true, j.settle, m);
    console.log(`  ${j.name.padEnd(14)} ${String(Math.round(dn / 1024)).padStart(4)}KB desktop  ${String(Math.round(mn / 1024)).padStart(4)}KB mobile   ${j.url}`);
  }

  /* The strip hard-codes width=900 height=562, so a wrong desktop size would
     ship silently. Assert it rather than trust it. */
  const png = fs.readFileSync(path.join(ROOT, 'assets', 'shots', jobs[0].name + '-front.jpg'));
  if (png.length < 4000) throw new Error('desktop shot suspiciously small — did the page render?');

  chrome.kill();
  console.log('\ndone. CHECK EVERY SHOT before it ships — public does not mean nobody is in it.');
  process.exit(0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
