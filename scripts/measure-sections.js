#!/usr/bin/env node
/* Measures the rendered height of each homepage section on the LIVE site, so
   "the case study section is too long" can be a number instead of a feeling.

     node scripts/measure-sections.js [url] [width]

   Same CDP approach as shoot-app.js and check-mockup.js — no new dependency.
*/
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL_ = process.argv[2] || 'https://kaymen.dev/';
const WIDTH = Number(process.argv[3] || 1440);

const EXPR = "(function(){var o=[];['#start','#price','#running','#work','#terms','#talk'].forEach(function(s){var e=document.querySelector(s);o.push(s+' '+(e?Math.round(e.getBoundingClientRect().height)+'px':'MISSING'));});var w=document.querySelector('#work');var r=document.querySelector('#running');o.push('cards '+(w?w.querySelectorAll('.case').length:0));o.push('shots '+(r?r.querySelectorAll('.shot').length:0));o.push('total '+Math.round(document.body.scrollHeight)+'px');return o.join('|');})()";

(async () => {
  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome or Edge found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-measure-'));
  const port = 9358;
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
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 1400, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  for (let i = 0; i < 80; i++) {
    const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (r.result?.result?.value === 'complete') break;
    await sleep(250);
  }
  /* The sections animate in on scroll (.rv), so measure after they have
     settled or every one of them reports its collapsed height. */
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await sleep(1500);
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
  await sleep(900);

  const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
  const val = r.result?.result?.value;
  if (!val) { console.log(JSON.stringify(r).slice(0, 500)); chrome.kill(); process.exit(1); }
  console.log(`${URL_}  at ${WIDTH}px\n`);
  val.split('|').forEach((line) => console.log('  ' + line));
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
