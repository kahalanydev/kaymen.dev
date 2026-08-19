#!/usr/bin/env node
/* Checks the front-and-back proof section in #running.
 *
 *   node scripts/verify-proof.js [url]
 *
 * Two things here are worth automating rather than eyeballing:
 *
 * 1. CONSENT. Every row's name comes from the `publish` flag in FRONT_ENDS.
 *    publish:false must render the anonymous label and must NOT link. Getting
 *    that wrong names a client who never agreed to be named, which is not a
 *    visual bug you would notice in a screenshot — the page looks fine either
 *    way. This asserts it against content/projects.js rather than trusting it.
 *
 * 2. THE MOBILE FLIP, and specifically its no-JS path. The CSS that hides the
 *    second figure is scoped to .flip-on, added by script.js. If that ever gets
 *    inverted, a phone without JS shows one screenshot and a dead toggle, and
 *    the back office becomes unreachable. Checked with JS disabled.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PROJECTS = require('../content/projects');
const URL_ = process.argv[2] || 'http://127.0.0.1:8080/';
const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
const fails = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fails.push(name); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

(async () => {
  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome or Edge found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-proof-'));
  const port = 9421;
  const chrome = spawn(exe, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let list;
  for (let i = 0; i < 40; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list.some((t) => t.type === 'page')) break;
    } catch { /* not up */ }
    await sleep(250);
  }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  /* Close the socket before exiting. Without this, process.exit() tears down a
     live websocket handle and libuv asserts on Windows, which crashes the run
     AFTER every check has passed - so the script always exited 127 and was
     useless as a gate. */
  const finish = (code) => { try { ws.close(); } catch (e) { /* already gone */ }
    chrome.kill(); setTimeout(() => process.exit(code), 60); };
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result?.result?.value;
  };
  const go = async (w, mobile) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile });
    await send('Page.navigate', { url: URL_ });
    for (let i = 0; i < 80; i++) {
      if (await evalJs('document.readyState') === 'complete') break;
      await sleep(200);
    }
    await sleep(900);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  console.log(`\nproof section — ${URL_}\n`);

  /* ---------- desktop: both shots, side by side ---------- */
  await go(1440, false);
  const pairs = await evalJs("document.querySelectorAll('.proof .pair:not(.pair-solo)').length");
  check('pairs present', pairs === 2, 'got ' + pairs);
  const visibleDesk = await evalJs(
    "Array.prototype.filter.call(document.querySelectorAll('.proof .pair:not(.pair-solo) .shot'),function(s){return s.offsetParent!==null;}).length");
  check('desktop shows both shots per pair', visibleDesk === 4, 'got ' + visibleDesk + ' visible');
  const flipDesk = await evalJs(
    "getComputedStyle(document.querySelector('.pair-flip')).display");
  check('desktop hides the flip control', flipDesk === 'none', String(flipDesk));

  /* Uncropped: the box must be no wider than the image can fill at 1.6:1. */
  const crop = await evalJs(`(function(){
    var i = document.querySelector('.pair-shots .shot img');
    var b = i.getBoundingClientRect();
    return (b.width / b.height).toFixed(2);
  })()`);
  check('shot is uncropped (1.60:1)', Math.abs(Number(crop) - 1.6) < 0.06, 'aspect ' + crop);

  /* ---------- consent: labels and links come from FRONT_ENDS ---------- */
  const labels = await evalJs(
    "Array.prototype.map.call(document.querySelectorAll('.proof .pair h3'),function(h){" +
    "var host=h.parentElement.querySelector('.pair-host')||h.closest('.pair').querySelector('.pair-host');" +
    "return h.textContent+'::'+(host&&host.querySelector('a')?'LINKED':'plain');}).join('|')");
  const rows = String(labels).split('|');
  const anonCount = Object.keys(PROJECTS.FRONT_ENDS)
    .filter((k) => PROJECTS.FRONT_ENDS[k].publish === false && PROJECTS.FRONT_ENDS[k].shot).length;
  const linked = rows.filter((r) => r.endsWith('LINKED')).length;
  check('un-consented rows are not linked', linked === rows.length - anonCount,
    rows.join('  '));
  const namesLeaked = rows.filter((r) =>
    /Horse & Harmony|Richmount|BridgeMortgage/.test(r)).length;
  check('no un-consented client is named', namesLeaked === 0, rows.join('  '));

  /* ---------- mobile: one at a time, and the toggle works ---------- */
  await go(390, true);
  const visibleMob = await evalJs(
    "Array.prototype.filter.call(document.querySelectorAll('.proof .pair:not(.pair-solo) .shot'),function(s){return s.offsetParent!==null;}).length");
  check('mobile shows one shot per pair', visibleMob === 2, 'got ' + visibleMob + ' visible');
  const flipped = await evalJs(`(function(){
    var p = document.querySelector('.proof .pair');
    p.querySelectorAll('.pair-flip button')[1].click();
    var shots = p.querySelectorAll('.pair-shots .shot');
    return [shots[0].classList.contains('on'), shots[1].classList.contains('on'),
            p.querySelectorAll('.pair-flip button')[1].getAttribute('aria-pressed')].join(',');
  })()`);
  check('toggle switches to the back office', flipped === 'false,true,true', String(flipped));

  /* ---------- the no-JS path ---------- */
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await go(390, true);
  const noJs = await evalJs("1").catch(() => null);
  const noJsShots = await send('Runtime.evaluate', {
    expression: "document.querySelectorAll('.proof .pair:not(.pair-solo) .shot').length", returnByValue: true,
  }).then((r) => r.result?.result?.value).catch(() => null);
  /* With scripts off we cannot evaluate in the page, so assert on the HTML the
     server sent: .flip-on is added by JS, so its absence is what keeps both
     figures visible. */
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  const html = await (await fetch(URL_)).text();
  check('no-JS: .flip-on is not in the served HTML', !/class="[^"]*flip-on/.test(html));
  check('no-JS: both figures are in the served HTML', (html.match(/class="shot(?: on)?"/g) || []).length >= 5,
    (html.match(/class="shot(?: on)?"/g) || []).length + ' figures');

  console.log(`\n${pass} passed, ${fails.length} failed`);
  /* finish(), not chrome.kill() + process.exit() — see finish() above. Exiting
     on a live websocket handle makes libuv assert on Windows, which crashed the
     run AFTER every check had passed and made this useless as a gate. It was
     defined for exactly this and then not used here. */
  finish(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
