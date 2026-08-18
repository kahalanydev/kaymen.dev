#!/usr/bin/env node
/* Renders a mockup in real Chrome, fails on any console error or page
   exception, exercises the controls, and shoots every direction at every
   width. Same CDP approach as shoot-app.js — no new dependency.

     node scripts/check-mockup.js mockup/seat-calculator.html

   Why this exists: a mockup that throws on the second slider drag looks
   perfect in a screenshot. The handoff's own lesson — test rendered pixels and
   real interaction, not element rects.
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

const target = process.argv[2] || 'mockup/seat-calculator.html';
const abs = path.resolve(target);
if (!fs.existsSync(abs)) throw new Error(`no such file: ${abs}`);
const outDir = path.resolve('.shots');
fs.mkdirSync(outDir, { recursive: true });

async function cdp(port) {
  let list;
  for (let i = 0; i < 40; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list.some((t) => t.type === 'page')) break;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  const page = (list || []).find((t) => t.type === 'page');
  if (!page) throw new Error('Chrome started but never exposed a page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  });
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send, events, close: () => ws.close() };
}

(async () => {
  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome or Edge found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-check-'));
  const port = 9351;
  const chrome = spawn(exe, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  const conn = await cdp(port);
  await conn.send('Page.enable');
  await conn.send('Runtime.enable');
  await conn.send('Log.enable');

  const evalJs = async (expression) => {
    const r = await conn.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    const d = r.result?.exceptionDetails;
    if (d) throw new Error('page threw: ' + (d.exception?.description || d.text));
    return r.result?.result?.value;
  };

  await conn.send('Page.navigate', { url: 'file:///' + abs.replace(/\\/g, '/') });
  for (let i = 0; i < 80; i++) {
    const s = await evalJs('document.readyState').catch(() => null);
    if (s === 'complete') break;
    await sleep(200);
  }
  await sleep(1000); /* webfonts */

  const WIDTHS = [
    { n: 'desk',  w: 1400, h: 1400, btn: 'w-desk' },
    { n: 'tab',   w: 940,  h: 1500, btn: 'w-tab' },
    { n: 'phone', w: 470,  h: 1700, btn: 'w-phone' },
  ];
  const DIRS = (process.env.KD_DIRS || 'T,A,B,C,D').split(',');
  let shots = 0;

  for (const wd of WIDTHS) {
    await conn.send('Emulation.setDeviceMetricsOverride', { width: wd.w, height: wd.h, deviceScaleFactor: 1, mobile: false });
    await evalJs(`document.querySelector('#wseg button[data-w="${wd.btn}"]').click()`);
    await sleep(560);
    for (const d of DIRS) {
      await evalJs(`document.querySelector('#dirseg button[data-dir="${d}"], #dseg button[data-d="${d}"]').click()`);
      await sleep(430);
      const shot = await conn.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(outDir, `${path.basename(abs).replace(/\.html$/, '')}-${d}-${wd.n}.png`), Buffer.from(shot.result.data, 'base64'));
      shots++;
    }
  }

  /* Exercise the controls. The maths only runs on input, so a throw in there
     is invisible to a screenshot and shows up the moment somebody drags. */
  /* Back to a desktop viewport before probing — heights measured at 470px are
     phone heights, and quoting them as desktop is how a note ends up claiming
     a number nobody checked. */
  await conn.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1400, deviceScaleFactor: 1, mobile: false });
  await evalJs(`document.querySelector('#wseg button[data-w="w-desk"]').click()`);
  await sleep(500);
  const hasCalc = await evalJs(`!!document.querySelector('#dirseg')`);
  if (!hasCalc) {
    /* Generic pass for any other mockup: click every direction and every
       filter, so a render that throws on a click cannot hide behind a shot. */
    const generic = await evalJs(`(function(){
      var out = [];
      Array.prototype.slice.call(document.querySelectorAll('#dseg button')).forEach(function(b){
        b.click();
        var pane = document.querySelector('.pane.on');
        var fs = Array.prototype.slice.call(pane.querySelectorAll('.filters button'));
        fs.forEach(function(f){ f.click(); });
        if (fs.length) fs[0].click();
        out.push(b.textContent.trim().padEnd(24) +
          ' items=' + pane.querySelectorAll('.tile, .plist a, .plist span, .strip a, .strip span, .rowtable tbody tr').length +
          '  quotes=' + pane.querySelectorAll('.quote').length +
          '  placeholders=' + pane.querySelectorAll('.quote.ph').length +
          '  height=' + Math.round(pane.getBoundingClientRect().height) + 'px');
      });
      document.querySelector('#dseg button').click();
      return out.join('\\n');
    })()`);
    const gerrs = conn.events
      .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
      .map((e) => e.params.entry.text)
      .concat(conn.events.filter((e) => e.method === 'Runtime.exceptionThrown')
        .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text));
    console.log(generic);
    console.log(`\nshots written: ${shots}  ->  .shots/`);
    chrome.kill();
    if (gerrs.length) { console.log('\nCONSOLE ERRORS:'); gerrs.forEach((e) => console.log('  ' + e)); process.exit(1); }
    console.log('no console errors, no exceptions.');
    process.exit(0);
  }
  await evalJs(`document.querySelector('#dirseg button[data-dir="A"]').click()`);
  await sleep(320);
  const probe = await evalJs(`(function(){
    var out = [], s = document.querySelector('#A-seats');
    function pickStack(label){
      var hit = Array.prototype.slice.call(document.querySelectorAll('#A-chips .chip'))
        .filter(function(c){ return c.textContent.indexOf(label) === 0; })[0];
      if (!hit) throw new Error('no stack chip: ' + label);
      hit.click();
    }
    function at(seats){
      s.value = seats; s.dispatchEvent(new Event('input'));
      return String(seats).padStart(2) + 'p  ' +
        document.querySelector('#A-chips .chip[aria-pressed=true]').textContent.trim() +
        '  ->  ' + document.querySelector('#A-verdict .vk').textContent +
        '   | next hire ' + document.querySelector('#A-hire b').textContent;
    }
    ['Starter tiers','Pro tiers','Pro + Salesforce'].forEach(function(lbl){
      pickStack(lbl);
      [3,5,6,10,20].forEach(function(n){ out.push(at(n)); });
      out.push('');
    });
    pickStack('Pro tiers');
    document.querySelector('#A-lab').checked = true;
    document.querySelector('#A-lab').dispatchEvent(new Event('change'));
    out.push('+ reconciliation person: ' + at(5));
    document.querySelector('#A-lab').checked = false;
    document.querySelector('#A-lab').dispatchEvent(new Event('change'));
    at(5);
    document.querySelector('#A-viewseg button[data-view="time"]').click();
    out.push('time view: ' + document.querySelector('#A-plotdesc').textContent);
    out.push('A plot paths=' + document.querySelectorAll('#A-plot path').length +
             ' texts=' + document.querySelectorAll('#A-plot text').length);
    document.querySelector('#dirseg button[data-dir="C"]').click();
    out.push('C bill at 5 on Pro = ' + document.querySelector('#C-tot').textContent +
             '  rows=' + document.querySelectorAll('#C-rows .row').length +
             '  capped rows lit=' + document.querySelectorAll('#C-rows .row.bump').length);
    var cs = document.querySelector('#C-seats'); cs.value = 6; cs.dispatchEvent(new Event('input'));
    out.push('C bill at 6 on Pro = ' + document.querySelector('#C-tot').textContent +
             '  capped rows lit=' + document.querySelectorAll('#C-rows .row.bump').length);
    document.querySelector('#dirseg button[data-dir="D"]').click();
    out.push('D cards=' + document.querySelectorAll('#D-grid .dcard').length);
    out.push('');
    document.querySelector('#dirseg button[data-dir="T"]').click();
    var ts = document.querySelector('#T-seats');
    [3,5,10,15,16,20,40].forEach(function(n){
      ts.value = n; ts.dispatchEvent(new Event('input'));
      var cells = Array.prototype.slice.call(document.querySelectorAll('#T-chart .crow')).map(function(row){
        var who = row.querySelector('.cn').childNodes[0].nodeValue
          .replace('Salesforce Sales Cloud','SF').replace('Microsoft Dynamics 365 Sales','Dynamics')
          .replace('HubSpot Sales Hub','HubSpot').replace('monday CRM','monday')
          .replace('Zapier, to glue them together','GLUE').replace('Your own system','OURS');
        return who + ' ' + row.querySelector('.cv').textContent;
      });
      out.push('T ' + String(n).padStart(2) + 'p  ' + cells.join(' | '));
    });
    /* Bars must always be sorted descending or the chart lies about rank. */
    var w = Array.prototype.slice.call(document.querySelectorAll('#T-chart .crow:not(.glue):not(.ours) .bar b'))
      .map(function(b){ return parseFloat(b.style.width); });
    var sorted = w.every(function(v,i){ return i === 0 || w[i-1] >= v; });
    out.push('vendor bars descending: ' + sorted + '  widths=' + w.map(function(v){return Math.round(v)+'%';}).join(','));
    [5,10,20].forEach(function(k){
      ts.value = k; ts.dispatchEvent(new Event('input'));
      out.push('aside@' + k + ': ' + document.querySelector('#T-aside h3').textContent + ' — ' +
        document.querySelector('#T-aside p').textContent.slice(0, 110));
    });
    ts.value = 10; ts.dispatchEvent(new Event('input'));
    out.push('default seats = ' + document.querySelector('#T-seats').value +
      '  aside width = ' + Math.round(document.querySelector('#T-aside').getBoundingClientRect().width) + 'px');
    out.push('word count in T pane: ' + document.querySelector('[data-pane=T]').innerText.split(/\\s+/).filter(Boolean).length);
    var pane = document.querySelector('[data-pane=T]');
    out.push('T section at 1120 stage: ' + Math.round(pane.getBoundingClientRect().height) + 'px' +
      '  (head ' + Math.round(pane.querySelector('.thead').getBoundingClientRect().height) + 'px' +
      ' + chart ' + Math.round(pane.querySelector('.chart').getBoundingClientRect().height) + 'px)');
    document.querySelector('#wseg button[data-w="w-phone"]').click();
    out.push('T section at 390 stage:  ' + Math.round(pane.getBoundingClientRect().height) + 'px' +
      '  (chart ' + Math.round(pane.querySelector('.chart').getBoundingClientRect().height) + 'px)');
    document.querySelector('#wseg button[data-w="w-desk"]').click();
    return out.join('\\n');
  })()`);

  const errs = conn.events
    .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map((e) => e.params.entry.text);
  const exc = conn.events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);

  console.log(probe);
  console.log(`\nshots written: ${shots}  ->  .shots/`);
  chrome.kill();
  if (errs.length || exc.length) {
    console.log('\nCONSOLE ERRORS / EXCEPTIONS:');
    errs.concat(exc).forEach((e) => console.log('  ' + e));
    process.exit(1);
  }
  console.log('no console errors, no exceptions.');
  process.exit(0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
