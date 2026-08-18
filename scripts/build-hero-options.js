#!/usr/bin/env node
/**
 * Builds mockup/hero-panel-options.html — four options for the hero's right-hand
 * slot, in one self-contained file.
 *
 *   node scripts/build-hero-options.js
 *
 * GENERATED, not hand-authored, for the same reason build-mockup.js is: the
 * hero markup is lifted out of index.html and the CSS is styles.css verbatim,
 * so what is being judged is the real thing with one block swapped — not an
 * impression of it. The mesh runs too, because script.js is inlined.
 *
 * There is ONE hero in the document and the switcher swaps only the panel slot.
 * Four copies of the hero would mean four #heroNet canvases sharing an id, and
 * the mesh measures the live layout, so it would have drawn into whichever one
 * it found first.
 *
 * The options:
 *   0  Current   the rent panel as it ships today
 *   A  Teaser    same dark shell, but the scale chart's real numbers + a link
 *   B  Fleet     fleetPanel(), still in render.js and kept for exactly this
 *   C  None      single column, hero copy takes the full measure
 */
const fs = require('fs');
const path = require('path');
const { rentPanel, fleetPanel } = require('../server/render');
const PRICING = require('../content/pricing');
const STATS = require('../content/stats');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* --- the real hero, lifted out of the real template ---------------------- */
const html = read('index.html');
const a = html.indexOf('<section class="hero" id="start">');
const b = html.indexOf('</section>', a);
if (a < 0 || b < 0) throw new Error('hero block not found in index.html');
let hero = html.slice(a, b + '</section>'.length);

hero = hero.split('<!--{{LIVE}}-->').join(String(STATS.LIVE.running));
/* the slot the switcher drives */
hero = hero.split('<!--{{RENT}}-->').join('<div id="heroSlot"></div>');

/* --- option A: the teaser -------------------------------------------------
   Same dark shell as the panel it replaces, because that metaphor is load-
   bearing: locked in is dark, owning it is the white block breaking out of it.
   The numbers are scaleRows() — the same function that feeds the chart in
   #price — so the hero and the chart can never disagree. */
function teaser() {
  const seats = PRICING.SCALE_DEFAULT_SEATS;
  const data = PRICING.scaleRows(seats);
  const worst = data.rows[0];
  const ours = data.rows[data.rows.length - 1];
  const pct = (v) => ((v / worst.total) * 100).toFixed(1);
  const m = PRICING.money;
  return `<aside class="stack rv ht" aria-label="What three years costs">
        <div class="sh"><span>Three years, ${seats} people</span><i>at list price</i></div>
        <div class="ht-row">
          <div class="ht-name">${worst.name}<i>${worst.tier}</i></div>
          <div class="ht-bar"><b style="width:${pct(worst.total)}%"></b></div>
          <div class="ht-v">${m(worst.total)}</div>
        </div>
        <div class="ht-row ht-mid">
          <div class="ht-name">${data.rows[4].name}<i>${data.rows[4].tier}</i></div>
          <div class="ht-bar"><b style="width:${pct(data.rows[4].total)}%"></b></div>
          <div class="ht-v">${m(data.rows[4].total)}</div>
        </div>
        <div class="sown">
          <div class="k">One system, yours</div>
          <div class="v">${m(ours.total)} <small>over the same three years</small></div>
          <div class="ht-obar"><b style="width:${pct(ours.total)}%"></b></div>
          <div class="n">Hire twenty more and it does not move. <b>Every CRM, at your own headcount →</b></div>
        </div>
      </aside>`;
}

const OPTIONS = {
  '0': { label: 'Current', html: rentPanel(), oneCol: false },
  A:   { label: 'A · Teaser', html: teaser(), oneCol: false },
  B:   { label: 'B · Fleet', html: fleetPanel(), oneCol: false },
  C:   { label: 'C · None', html: '', oneCol: true },
};

const NOTES = {
  '0': {
    h: 'Current — the rent panel',
    p: 'What ships today. Five subscription lines, a $290 total, the reconciliation-labour argument and the white "yours" block breaking the dark. It is the only place on the site that makes <b>Ariel\'s manpower point</b>, and that argument is genuinely good.',
    r: '<b>Why it is up for removal:</b> its numbers are now known to be wrong. "Invoicing &amp; books $70" is built on QuickBooks Essentials, which <b>caps at three users</b> — a team of five cannot legally be on it — and Essentials rose to $85 on 1 August. The per-seat figure works out at $34/head against the published <code>afterHires</code> of $39. It also argues the same thing the chart in #price now argues properly.',
  },
  A: {
    h: 'A — the teaser',
    p: 'Same dark shell, same white block breaking out of it, but the rows are the <b>real scale-chart numbers</b> from <code>scaleRows()</code> — the most expensive CRM, a mid one, and ours, over three years at ten people. Ends with a link into the full chart.',
    r: '<b>Risk:</b> it repeats a number the visitor will see again 2,000px later, and repetition can read as padding. It also drops the labour argument, which nothing else on the site makes. <b>Upside:</b> it cannot go stale — one source, and the hero and the chart move together.',
  },
  B: {
    h: 'B — the fleet panel',
    p: 'The graphic the hero carried until 2026-08-16. <code>fleetPanel()</code> is still in <code>render.js</code>, kept in the file with a comment saying it is the obvious thing to reach for if the hero ever wants the proof back. Every bar is measured active days from a real repository.',
    r: '<b>Risk:</b> the hero stops making a money argument at all. A visitor who lands cold sees evidence of activity before they know what is being sold — and the sparklines need a caption to mean anything, which is reading. <b>Upside:</b> zero new numbers to maintain, and it is the only option that is pure proof.',
  },
  C: {
    h: 'C — nothing, single column',
    p: 'The slot goes away and the hero copy takes the full measure. Headline, both leads and the six benefit blocks get the whole width; the six blocks go to three-up much earlier.',
    r: '<b>Risk:</b> the hero loses its anchor. The panel is what stops the fold being an all-text page, and the mesh alone will not carry it. Also the largest layout change of the three — the two-column rule at 1280 exists because of headline measurement, and this removes the reason for it. <b>Upside:</b> nothing to keep current, and the fastest fold on the site.',
  },
};

/* --- the extra CSS the teaser needs. Prefixed ht- because .srow already
       belongs to the rent panel and .sc-row to the chart in #price. -------- */
const TEASER_CSS = `
.ht-row{display:grid;grid-template-columns:1fr 64px auto;gap:12px;align-items:center;padding:11px 22px;border-bottom:1px solid rgba(255,255,255,.1)}
.ht-row.ht-mid{opacity:.72}
.ht-name{font-size:13px;color:rgba(255,255,255,.86);line-height:1.25;min-width:0}
.ht-name i{display:block;font-style:normal;font-size:11px;color:rgba(255,255,255,.45);margin-top:1px}
.ht-bar{height:7px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden}
.ht-bar b{display:block;height:100%;border-radius:5px;background:var(--rent)}
.ht-v{font-family:var(--display);font-size:15px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;text-align:right}
.ht-obar{height:7px;border-radius:5px;background:rgba(43,188,179,.16);overflow:hidden;margin:10px 0 2px}
.ht-obar b{display:block;height:100%;border-radius:5px;background:var(--accent)}
.stack.ht .sown .v small{display:block;margin-top:2px}
`;

/* --- single-column override for option C --------------------------------- */
const ONECOL_CSS = `
body.one-col .hero-grid{grid-template-columns:1fr !important}
body.one-col #heroSlot{display:none}
`;

const CHROME_CSS = `
body{margin:0}
.mk{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.mk-in{max-width:1240px;margin:0 auto;padding:11px 22px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.mk h1{font-family:var(--display);font-size:13.5px;font-weight:600;margin:0;white-space:nowrap}
.mk h1 span{color:var(--muted);font-weight:400}
.seg{display:flex;gap:2px;background:var(--bg-alt);padding:3px;border-radius:9px;border:1px solid var(--line)}
.seg button{font:inherit;font-size:12.5px;font-weight:500;border:0;background:transparent;color:var(--muted);padding:6px 12px;border-radius:6px;cursor:pointer;white-space:nowrap}
.seg button[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.mk .sp{flex:1}
.note{max-width:1240px;margin:0 auto;padding:22px 22px 0}
.note .pane{display:none}
.note .pane.on{display:block}
.note h2{font-family:var(--display);font-size:22px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
.note p{font-size:14.5px;color:var(--muted);max-width:80ch;margin:0}
.note p b{color:var(--ink);font-weight:600}
.note code{font-size:12.5px;background:var(--bg-alt);padding:1px 5px;border-radius:4px}
.note .risk{margin-top:9px;font-size:13.5px;border-left:2px solid var(--rent);padding-left:12px}
.note .risk b{color:var(--rent-dark);font-weight:600}
.stagewrap{overflow-x:auto;padding:20px 0 60px}
.stage{margin:0 auto;background:var(--bg);border:1px solid var(--line);border-radius:16px;transition:width .28s var(--ease);box-shadow:0 12px 40px -22px rgba(0,0,0,.18);overflow:hidden}
.stage.w-desk{width:1440px}
.stage.w-mid{width:1280px}
.stage.w-tab{width:900px}
.stage.w-phone{width:390px}
/* the stage stands in for the viewport, so the page padding the rail normally
   reserves has to come off - there is no rail in here. */
.stage .page{--page-pl:44px;--page-pr:44px}
.stage .rv{opacity:1;transform:none}
`;

const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kaymen.dev — the hero panel slot, four options</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ============================================================================
   GENERATED by scripts/build-hero-options.js — do not hand-edit.
   The CSS below is styles.css verbatim; the hero markup is lifted out of
   index.html. What is being judged is the real hero with one block swapped.
   ============================================================================ */
${read('styles.css')}
${TEASER_CSS}
${ONECOL_CSS}
${CHROME_CSS}
</style>
</head>
<body>

<div class="mk"><div class="mk-in">
  <h1>The hero panel slot <span>— four options</span></h1>
  <div class="seg" id="dseg" role="group" aria-label="Option">
    ${Object.keys(OPTIONS).map((k, i) =>
      `<button data-d="${k}" aria-pressed="${i === 0}">${OPTIONS[k].label}</button>`).join('\n    ')}
  </div>
  <div class="sp"></div>
  <div class="seg" id="wseg" role="group" aria-label="Width">
    <button data-w="w-desk" aria-pressed="true">1440</button>
    <button data-w="w-mid" aria-pressed="false">1280</button>
    <button data-w="w-tab" aria-pressed="false">900</button>
    <button data-w="w-phone" aria-pressed="false">390</button>
  </div>
</div></div>

<div class="note">
  ${Object.keys(NOTES).map((k, i) =>
    `<div class="pane${i === 0 ? ' on' : ''}" data-p="${k}">
    <h2>${NOTES[k].h}</h2><p>${NOTES[k].p}</p><p class="risk">${NOTES[k].r}</p>
  </div>`).join('\n  ')}
</div>

<div class="stagewrap"><div class="stage w-desk" id="stage">
  <main class="page">
    ${hero}
  </main>
</div></div>

<script>
var PANELS = ${JSON.stringify(Object.keys(OPTIONS).reduce((o, k) => {
  o[k] = { html: OPTIONS[k].html, oneCol: OPTIONS[k].oneCol };
  return o;
}, {})).replace(/</g, '\\u003c')};

function setOption(k) {
  document.getElementById('heroSlot').innerHTML = PANELS[k].html;
  document.body.classList.toggle('one-col', !!PANELS[k].oneCol);
  Array.prototype.forEach.call(document.querySelectorAll('#dseg button'), function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.d === k));
  });
  Array.prototype.forEach.call(document.querySelectorAll('.note .pane'), function (p) {
    p.classList.toggle('on', p.dataset.p === k);
  });
  window.dispatchEvent(new Event('resize'));
}
Array.prototype.forEach.call(document.querySelectorAll('#dseg button'), function (b) {
  b.addEventListener('click', function () { setOption(b.dataset.d); });
});
Array.prototype.forEach.call(document.querySelectorAll('#wseg button'), function (b) {
  b.addEventListener('click', function () {
    Array.prototype.forEach.call(document.querySelectorAll('#wseg button'), function (o) {
      o.setAttribute('aria-pressed', String(o === b));
    });
    document.getElementById('stage').className = 'stage ' + b.dataset.w;
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 320);
  });
});
setOption('0');
</script>
<script>
${read('script.js')}
</script>
</body>
</html>
`;

const out = path.join(ROOT, 'mockup', 'hero-panel-options.html');
fs.writeFileSync(out, doc);
console.log('wrote mockup/hero-panel-options.html  ' + Math.round(doc.length / 1024) + 'KB');
