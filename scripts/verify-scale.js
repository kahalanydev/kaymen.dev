#!/usr/bin/env node
/* End-to-end check for the scale comparison on the homepage.
 *
 *   node scripts/verify-scale.js [url]
 *
 * Why this exists: the chart is SERVER-RENDERED, so a completely dead slider
 * still screenshots perfectly. Every assertion below is about behaviour after
 * the page is live — that the numbers move, that they move to the values
 * content/pricing.js says they should, that the aside changes side when the
 * numbers do, and that the hero's rent panel (which used to share a class name
 * with these rows) is still intact.
 *
 * Same CDP approach as shoot-app.js — no new dependency.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PRICING = require('../content/pricing');
const URL_ = process.argv[2] || 'http://127.0.0.1:8080/';
const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
const fails = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

(async () => {
  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome or Edge found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-scale-'));
  const port = 9371;
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
  const events = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  });
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    const d = r.result && r.result.exceptionDetails;
    if (d) throw new Error('page threw: ' + ((d.exception && d.exception.description) || d.text));
    return r.result && r.result.result && r.result.result.value;
  };

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  for (let i = 0; i < 80; i++) {
    if (await evalJs('document.readyState') === 'complete') break;
    await sleep(250);
  }
  await sleep(1200);

  console.log('\nscale comparison — ' + URL_ + '\n');

  /* --- it is in the HTML at all (the placeholder can silently vanish) --- */
  const rows = await evalJs("document.querySelectorAll('#scaleChart .sc-row').length");
  check('chart is server-rendered', rows === PRICING.CRMS.length + 2,
    'got ' + rows + ' rows, expected ' + (PRICING.CRMS.length + 2));

  /* --- the .srow collision guard ---------------------------------------
     The hero rent panel owns .srow; the chart's rows are sc-*. Applying the
     chart's six-column grid to that panel would silently wreck it, which is
     what nearly happened.

     The panel was removed from the hero on 2026-08-18, so it is normally
     absent now — but rentPanel() is still exported and the slot is expected to
     be refilled, so this guard stays and simply skips when there is no panel.
     Deleting it would mean the collision could come back unnoticed the day the
     panel does. */
  const rent = await evalJs("document.querySelectorAll('.stack .srow').length");
  if (rent === 0) {
    console.log('  --   hero rent panel absent (removed 2026-08-18) — collision guard skipped');
  } else {
    check('hero rent panel intact', rent === PRICING.RENT_STACK.rows.length,
      'got ' + rent + ' rows, expected ' + PRICING.RENT_STACK.rows.length);
    const rentGrid = await evalJs("getComputedStyle(document.querySelector('.stack .srow')).gridTemplateColumns");
    check('hero rent panel not caught by the chart grid', !/(\d+px\s+){4,}/.test(String(rentGrid)), String(rentGrid));
  }

  /* --- default state matches content/pricing.js exactly --- */
  const want = PRICING.scaleRows(PRICING.SCALE_DEFAULT_SEATS);
  const got = await evalJs(
    "Array.prototype.map.call(document.querySelectorAll('#scaleChart .sc-row .sc-total'),function(e){return e.textContent;}).join('|')");
  check('default figures match pricing.js',
    got === want.rows.map((r) => PRICING.money(r.total)).join('|'), got);

  /* --- THE POINT OF THIS FILE: the slider actually does something --- */
  const drag = async (n) => {
    await evalJs("(function(){var s=document.getElementById('scaleSeats');s.value=" + n +
      ";s.dispatchEvent(new Event('input'));})()");
    await sleep(120);
  };
  for (const n of [3, 5, 20, 40]) {
    await drag(n);
    const expect = PRICING.scaleRows(n).rows.map((r) => PRICING.money(r.total)).join('|');
    const actual = await evalJs(
      "Array.prototype.map.call(document.querySelectorAll('#scaleChart .sc-row .sc-total'),function(e){return e.textContent;}).join('|')");
    check('slider repaints correctly at ' + n + ' people', actual === expect, actual);
    const label = await evalJs("document.getElementById('scaleSeatsV').textContent");
    check('headcount label follows at ' + n, String(label) === String(n), String(label));
  }

  /* --- the aside concedes below the crossover and stops conceding above it --- */
  await drag(5);
  const low = await evalJs("document.getElementById('scaleAsideT').textContent");
  check('aside concedes at 5 people', /cheap rows win/i.test(String(low)), String(low));
  await drag(20);
  const high = await evalJs("document.getElementById('scaleAsideT').textContent");
  check('aside stops conceding at 20 people', /year one/i.test(String(high)), String(high));

  /* --- bars stay sorted; an unsorted bar chart lies about rank --- */
  await drag(10);
  const widths = await evalJs(
    "Array.prototype.map.call(document.querySelectorAll('#scaleChart .sc-row:not(.glue):not(.ours)'),function(r){" +
    "return Array.prototype.reduce.call(r.querySelectorAll('.sc-bar b'),function(a,b){return a+parseFloat(b.style.width);},0);})");
  check('vendor bars descend', widths.every((w, i) => i === 0 || widths[i - 1] >= w - 0.01), JSON.stringify(widths.map((w) => Math.round(w))));

  /* --- phone: one line per row, year columns dropped rather than squeezed --- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  const phoneRowH = await evalJs("Math.round(document.querySelector('#scaleChart .sc-row').getBoundingClientRect().height)");
  check('phone row is one line', phoneRowH < 56, phoneRowH + 'px');
  const yrHidden = await evalJs("getComputedStyle(document.querySelector('#scaleChart .sc-row .sc-yr')).display");
  check('phone drops the year columns', yrHidden === 'none', String(yrHidden));
  const phoneChart = await evalJs("Math.round(document.getElementById('scaleChart').getBoundingClientRect().height)");
  check('phone chart under 500px', phoneChart < 500, phoneChart + 'px');

  /* --- nothing threw --- */
  const errs = events
    .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map((e) => e.params.entry.text)
    .concat(events.filter((e) => e.method === 'Runtime.exceptionThrown')
      .map((e) => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text));
  check('no console errors', errs.length === 0, errs.join(' | '));

  console.log('\n' + pass + ' passed, ' + fails.length + ' failed');
  chrome.kill();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
