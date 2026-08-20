#!/usr/bin/env node
/* Checks the comparison grid in #price — the four package cards and the band
 * of universals above them.
 *
 *   node scripts/verify-ask.js [url]
 *
 * Rebuilt 2026-08-19 because Ariel could not tell the four packages apart. The
 * cause was never the layout, and the three faults that caused it are all
 * invisible to a screenshot — the page looks fine with every one of them in
 * place. So they are asserted here instead:
 *
 * 1. THE HEADING MUST BE `product`, NOT `chip`. A chip names the PROBLEM, which
 *    is right in the pill row and inverts above a price: the card headed "Tools
 *    that do not talk · from $6,500" read as paying $6,500 FOR tools that do not
 *    talk. Nothing about that renders as broken.
 *
 * 2. THE AXES MUST BE PARALLEL. Same labels, same order, every card. The old
 *    grid had twelve freely-chosen attributes across four cards, so there was
 *    nothing to read across. A future edit that adds one useful row to one card
 *    quietly puts that back, and this fails on it.
 *
 * 3. NOTHING UNIVERSAL MAY SIT INSIDE A CARD. This is the one that did the real
 *    damage: listing "backups verified" on card one made the other three look
 *    like they had none, and "no per-seat fee" appeared on two cards as though
 *    it distinguished them. Every UNIVERSAL string is checked against every
 *    card's text.
 *
 * Plus the two things that were true before and must stay true: money is the
 * LAST line of a card and never the heading (promote it and the section becomes
 * the SaaS tier table the rest of the page argues against), and the cards are a
 * third way into the same askSel state rather than a second pricing surface.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const P = require('../content/pricing');
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-ask-'));
  const port = 9427;
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
  const logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push(m.params.entry.text);
    else if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  /* Close the socket before exiting — see verify-proof.js: process.exit() on a
     live websocket handle makes libuv assert on Windows and the run dies AFTER
     every check has passed. */
  const finish = (code) => { try { ws.close(); } catch (e) { /* gone */ }
    chrome.kill(); setTimeout(() => process.exit(code), 60); };
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'page threw');
    return r.result?.result?.value;
  };
  const go = async (w) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 950, deviceScaleFactor: 1, mobile: w < 700 });
    await send('Page.navigate', { url: URL_ });
    for (let i = 0; i < 80; i++) {
      if (await evalJs('document.readyState') === 'complete') break;
      await sleep(200);
    }
    await sleep(900);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  console.log(`\ncomparison grid — ${URL_}\n`);

  const RUNGS = P.routes().filter((r) => r.axes);
  await go(1400);

  /* ---------- the band of universals ---------- */
  const uni = await evalJs(`(function(){
    var b = document.querySelector('.ask-uni');
    if (!b) return null;
    return { label: b.querySelector('b').textContent.trim(),
             items: Array.prototype.map.call(b.querySelectorAll('li'), function(li){ return li.textContent.trim(); }) };
  })()`);
  check('the universals band renders', !!uni);
  check('band carries every UNIVERSAL line',
    uni && JSON.stringify(uni.items) === JSON.stringify(P.UNIVERSAL),
    uni ? JSON.stringify(uni.items) : 'no band');
  check('band sits ABOVE the cards',
    await evalJs("(function(){var u=document.querySelector('.ask-uni'),g=document.querySelector('.ask-grid');"
      + "return !!u && !!g && u.compareDocumentPosition(g) === Node.DOCUMENT_POSITION_FOLLOWING;})()"));
  /* --accent-soft is the SELECTED-card treatment. A teal band directly above
     four cards reads as a fifth, already-chosen one. */
  const bandBg = await evalJs("getComputedStyle(document.querySelector('.ask-uni')).backgroundColor");
  check('band is not painted in the selected-card accent', !/rgba?\(43, ?188, ?179/.test(String(bandBg)), String(bandBg));

  /* ---------- the cards ---------- */
  const cards = await evalJs(`(function(){
    return Array.prototype.map.call(document.querySelectorAll('.ask-card'), function(c){
      return {
        id: c.dataset.id,
        head: c.querySelector('b').textContent.trim(),
        labels: Array.prototype.map.call(c.querySelectorAll('li em'), function(e){ return e.textContent.trim(); }),
        values: Array.prototype.map.call(c.querySelectorAll('li'), function(li){
          var em = li.querySelector('em');
          return li.textContent.replace(em ? em.textContent : '', '').trim();
        }),
        text: c.textContent,
        lastLine: c.lastElementChild.className,
        money: c.querySelector('.mn') ? c.querySelector('.mn').textContent.trim() : null,
      };
    });
  })()`);
  check('four cards, one per rung', cards.length === RUNGS.length, 'got ' + cards.length);

  RUNGS.forEach((r, i) => {
    const c = cards[i];
    if (!c) return;
    check(`${r.id}: heading is the product name`, c.head === r.product, `"${c.head}"`);
    check(`${r.id}: heading is NOT the chip`, c.head !== r.chip, `"${c.head}"`);
    check(`${r.id}: axis labels match AXES in order`,
      JSON.stringify(c.labels) === JSON.stringify(P.AXES), JSON.stringify(c.labels));
    check(`${r.id}: answers match content/pricing.js`,
      JSON.stringify(c.values) === JSON.stringify(r.axes.map((a) => a[1])), JSON.stringify(c.values));
    check(`${r.id}: money is the last line, not the heading`,
      /\bmn\b/.test(c.lastLine) && c.money === r.money && !c.head.includes('$'), `${c.lastLine} / ${c.money}`);
  });

  /* Fault 3, the expensive one. */
  const leaked = [];
  P.UNIVERSAL.forEach((u) => {
    /* Compare on the distinctive half — the cards would never repeat a whole
       sentence verbatim, but "no per-seat fee" inside one card is exactly the
       failure this exists to catch. */
    const needle = u.split(/[—,]/)[0].trim().toLowerCase();
    cards.forEach((c) => {
      if (needle.length > 12 && c.text.toLowerCase().includes(needle)) leaked.push(`${c.id}: "${needle}"`);
    });
  });
  check('no universal claim is repeated inside a card', leaked.length === 0, leaked.join('; '));

  /* Parallel axes are only worth having if the ANSWERS differ. A row where
     every card says the same thing is a universal wearing a label. */
  P.AXES.forEach((label, ax) => {
    const vals = cards.map((c) => c.values[ax]);
    check(`axis "${label}" is not the same on every card`, new Set(vals).size > 1, vals.join(' | '));
  });

  /* ---------- still one state, three ways in ---------- */
  const wired = await evalJs(`(function(){
    var cards = document.querySelectorAll('.ask-card');
    var last = cards[cards.length - 1];
    last.click();
    var chip = document.querySelector('.ask-chip[data-id="' + last.dataset.id + '"]');
    return [last.classList.contains('on'),
            last.getAttribute('aria-pressed'),
            chip.classList.contains('on'),
            document.getElementById('askBuild').textContent.indexOf('$15,000') === 0].join(',');
  })()`);
  check('clicking a card moves the pill row and the estimate', wired === 'true,true,true,true', String(wired));

  /* Ariel, 2026-08-20: "every time u click one the scroll goes up". Comparing
     the four cards means clicking all four, and .ask-out sits ABOVE them, so the
     old scrollIntoView yanked the cards off screen on every click. Smooth
     scrolling is async, hence the wait — asserting immediately would pass
     against the very bug this is here to catch. */
  const moved = await evalJs(`(function(){
    var cards = document.querySelectorAll('.ask-card');
    cards[cards.length - 1].scrollIntoView({block:'center'});
    /* Let the SETUP scroll land before taking the baseline. Reading scrollY on
       the next line returns 0 — scrollIntoView has not applied yet — so the
       check would then blame the click for the 1,189px it caused itself, and
       fail against a page that is behaving. */
    return new Promise(function(res){
      setTimeout(function(){
        var before = window.scrollY;
        cards[0].click();
        setTimeout(function(){ res(Math.abs(window.scrollY - before)); }, 900);
      }, 1200);
    });
  })()`);
  check('clicking a card does not scroll the page', moved === 0, 'moved ' + moved + 'px');

  /* ---------- widths ---------- */
  const outDir = path.resolve('.shots');
  fs.mkdirSync(outDir, { recursive: true });
  /* One bound per LAYOUT, not one bound overall: .ask-grid is four columns above
     1000px, two between 560 and 1000, and a horizontal swipe below 560. Two
     columns is legitimately about twice as tall, and a single number would fail
     on the correct rendering. These are ceilings the current build clears with
     room, so they catch a regression rather than pinning the design. */
  const CEILING = { 1400: 620, 940: 900, 470: 700 };
  for (const w of [1400, 940, 470]) {
    await go(w);
    const box = await evalJs(`(function(){
      /* .rv starts at opacity 0 and is revealed by an IntersectionObserver, so a
         shot taken mid-reveal comes out faded and unreadable. */
      Array.prototype.forEach.call(document.querySelectorAll('.rv'), function(e){ e.classList.add('in'); });
      var s = document.getElementById('askAll');
      s.scrollIntoView({block:'start'});
      var b = s.getBoundingClientRect();
      return JSON.stringify({t: Math.round(b.top + window.scrollY), h: Math.round(b.height)});
    })()`);
    const { t, h } = JSON.parse(box);
    await sleep(700);
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: Math.max(0, t - 20), width: w, height: h + 40, scale: 1 },
    });
    fs.writeFileSync(path.join(outDir, `ask-${w}.png`), Buffer.from(shot.result.data, 'base64'));
    check(`${w}px: section fits its layout's ceiling (${CEILING[w]}px)`, h < CEILING[w], h + 'px');

    /* THE SECOND JUMP — a reflow, not a scroll, which is why removing the
       scrollIntoView did not fix it and why it was invisible on a desktop. The
       sentence, the note and the pilot's estimate caption are all different
       lengths per rung and all sit ABOVE the cards, so picking a pill changed
       the height of the block above the pills and the pill row moved out from
       under the thumb that had just tapped it. Measured on the live page before
       the fix, at 390px: -79px, -47px, +73px. At 1400px: 0px.

       MEASURED IN THE VIEWPORT, NOT THE DOCUMENT. askAnchor() fixes this by
       giving back the scroll difference rather than by reserving space, so the
       document position of the cards legitimately DOES move — asserting on
       rect.top + scrollY would fail against a page that is behaving perfectly.
       What the user sees is rect.top alone.

       And it waits: styles.css sets html{scroll-behavior:smooth}, so a
       correction issued without behavior:'instant' animates. Reading straight
       after the click measures mid-animation and passes a page that visibly
       slides. Both mistakes were made here before this comment existed. */
    const travel = await evalJs(`(function(){
      var chips = document.getElementById('askChips'), grid = document.getElementById('askAll');
      chips.scrollIntoView({block:'center'});
      var vp = function(el){ return Math.round(el.getBoundingClientRect().top); };
      return new Promise(function(done){
        setTimeout(function(){
          var c0 = vp(chips), g0 = vp(grid), worst = 0;
          var all = Array.prototype.slice.call(document.querySelectorAll('.ask-chip'));
          var step = function(i){
            if (i >= all.length) return done(worst);
            all[i].click();
            setTimeout(function(){
              worst = Math.max(worst, Math.abs(vp(chips) - c0), Math.abs(vp(grid) - g0));
              step(i + 1);
            }, 550);
          };
          step(0);
        }, 700);
      });
    })()`);
    /* 1px of tolerance for sub-pixel rounding, and no more — 2px would let a
       real regression through at the widths where the travel used to be 23px. */
    check(`${w}px: picking any rung moves nothing on screen`, travel <= 1, 'moved ' + travel + 'px');
  }

  check('no console errors', logs.length === 0, logs.join(' | '));

  console.log(`\n${pass} passed, ${fails.length} failed   → .shots/ask-{1400,940,470}.png`);
  finish(fails.length ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
