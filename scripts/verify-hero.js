#!/usr/bin/env node
/* The hero headline must be TWO LINES at every width. It carries a hard <br>,
 * so the only failure mode is a line wrapping further — which is exactly what
 * happened at 1280 before the panel came out, and is why a font-size override
 * existed for that band. The panel and the override are both gone now, so this
 * asserts the requirement instead of trusting it.
 *
 *   node scripts/verify-hero.js [url]
 *
 * HANDOFF-FRONTEND-2026-08-16.md §2: "Two lines is a hard requirement."
 * Verified at eleven widths, 390 to 2560.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const URL_ = process.argv[2] || 'http://127.0.0.1:8080/';
const WIDTHS = [390, 480, 600, 768, 900, 1040, 1280, 1400, 1440, 1920, 2560];
const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome or Edge found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-hero-'));
  const port = 9401;
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
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  console.log(`\nhero headline — ${URL_}\n`);
  let fails = 0;
  for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 900 });
    await send('Page.navigate', { url: URL_ });
    for (let i = 0; i < 80; i++) {
      if (await evalJs('document.readyState') === 'complete') break;
      await sleep(200);
    }
    await sleep(700);
    const r = await evalJs(`(function(){
      var h = document.querySelector('.hero h1');
      var cs = getComputedStyle(h);
      var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.05;
      var lines = Math.round(h.getBoundingClientRect().height / lh);
      var panel = !!document.querySelector('.hero .stack');
      return [lines, Math.round(parseFloat(cs.fontSize)), Math.round(h.getBoundingClientRect().width), panel].join('|');
    })()`);
    const [lines, size, width, panel] = String(r).split('|');
    const ok = Number(lines) === 2;
    if (!ok) fails++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${String(w).padStart(4)}px   ${lines} lines   ${String(size).padStart(2)}px type   column ${String(width).padStart(4)}px${panel === 'true' ? '   (panel present)' : ''}`);
  }

  chrome.kill();
  console.log(fails ? `\n${fails} width(s) failed` : '\ntwo lines at every width.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
