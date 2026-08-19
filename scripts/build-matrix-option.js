#!/usr/bin/env node
/**
 * Builds mockup/matrix-option.html — the ShipStation shape, wired into the
 * site's own design and its existing highlight mechanism.
 *
 *   node scripts/build-matrix-option.js
 *
 * THE THREE THINGS THIS HAD TO SOLVE
 *
 * 1. THE ALL-TICKED PROBLEM. A literal feature matrix ticks five of nine rows
 *    in every column, because these rungs are not feature-gated — everyone gets
 *    ownership, unlimited logins, backups, patching and a person who answers.
 *    Drawn that way it advertises that the cheapest rung lacks almost nothing.
 *    FIX: lift the universals OUT of the matrix into a band above it, so the
 *    matrix contains only rows that actually differ. Same shape Ariel asked
 *    for; none of the rows are dead.
 *
 * 2. THE HIGHLIGHT. The site already has one: `askSel` drives `.on` across the
 *    sentence, the pills and the cards — "three ways into one state, and the
 *    rule that none of them owns the state is what stops them drifting"
 *    (script.js). The matrix becomes a FOURTH way in, not a second pricing
 *    surface: clicking a column sets askSel, and every cell in that column
 *    takes .on. CSS cannot select a column, so each cell carries data-col and
 *    the toggle is one querySelectorAll — simpler than :has() and it works
 *    everywhere.
 *
 * 3. MOBILE. Four columns do not fit at 390px. The site already answers this:
 *    .ask-grid and .shots both become a horizontal swipe below their
 *    breakpoint. The matrix does the same, with the row-label column pinned so
 *    you always know which row you are reading — which is the one thing a
 *    swiped table gets wrong if you let the labels scroll away.
 *
 * THE PRICE-IN-HEADER TOGGLE is deliberate. index.html and the ladder doc
 * record: "deliberately NOT a tier table... promote the price to the card
 * heading and this becomes the rental frame the whole page argues against, with
 * $15,000 on screen before anyone has read what it is for." ShipStation puts
 * price in the header. Rather than quietly overturn a recorded decision or
 * quietly ignore Ariel, the mockup does both so the trade is visible.
 */
const fs = require('fs');
const path = require('path');
const P = require('../content/pricing');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const money = P.money;
const RUNGS = P.BASES;

const UNIVERSAL = [
  'You own the code, the data and the servers',
  'Logins for everyone who needs one — no per-seat fee, ever',
  'Backups verified, not assumed',
  'Patches and dependency updates',
  'Monitored, and a person answers when it breaks',
  'Yours to take elsewhere at any time, no exit fee',
];

/* Only rows that DIFFER. A row where every column says the same thing belongs
   in the band above, not in the matrix. */
const ROWS = [
  { label: 'What it covers', v: ['A system you already have', 'One part of the business', 'Work spread across several tools', 'Several systems, several teams'] },
  { label: 'Tools it replaces', v: ['—', 'One tool or spreadsheet', 'Three to six tools', 'A whole stack'] },
  { label: 'One source of truth', v: ['—', 'For that one part', 'Across the business', 'Across every team'] },
  { label: 'Reporting across teams', v: ['—', '—', '—', '✓'] },
  { label: 'Development included', v: ['Small changes', 'Small changes', 'Small changes', '10 hours a month, rolls over'] },
  { label: 'Unused hours roll over', v: ['—', '—', '—', '✓ one month'] },
];

const PRICE_ROWS = [
  { label: 'To build, once', v: RUNGS.map((r) => (r.from ? 'from ' + money(r.from) : 'No build fee')) },
  { label: 'Monthly, flat', v: RUNGS.map((r) => money(r.mo) + '/mo') },
];

const cell = (v, i) => {
  const dash = v === '—';
  const tick = v.startsWith('✓');
  return `<td class="mx-c${dash ? ' dash' : ''}${tick ? ' tick' : ''}" data-col="${i}">${v}</td>`;
};

const CSS = `
/* --- the ShipStation shape, in this site's clothes ------------------------ */
.mxwrap{margin-top:14px}
.mx-all{border:1px solid rgba(43,188,179,.3);background:var(--accent-soft);border-radius:14px;padding:16px 20px;margin-bottom:18px}
.mx-all b{display:block;font-size:10.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--accent-dark);margin-bottom:9px}
.mx-all ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:5px 22px}
.mx-all li{font-size:13px;color:var(--ink);display:flex;gap:8px}
.mx-all li::before{content:"✓";color:var(--accent-dark);font-weight:700;flex:none}
@media (max-width:760px){.mx-all ul{grid-template-columns:1fr}}

.mx-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.mx-scroll::-webkit-scrollbar{height:0}
table.mx{width:100%;border-collapse:collapse;min-width:560px}

/* The column head is a button, because it is a control: it sets askSel exactly
   like a pill or a card does. */
th.mx-h{padding:0 6px 12px;vertical-align:bottom;text-align:left}
th.mx-h button{
  width:100%;font:inherit;text-align:left;cursor:pointer;background:#fff;
  border:1px solid var(--line);border-radius:12px;padding:12px 14px;
  transition:border-color .2s var(--ease),background .2s var(--ease);
}
th.mx-h button:hover{border-color:#d0d3d9}
th.mx-h button.on{border-color:rgba(43,188,179,.55);background:var(--accent-soft)}
th.mx-h .pname{display:block;font-family:var(--display);font-size:13.5px;font-weight:600;letter-spacing:-.015em;line-height:1.3;color:var(--ink)}
th.mx-h .pprice{display:block;font-size:11.5px;color:var(--muted);margin-top:4px;font-variant-numeric:tabular-nums}
th.mx-h button.on .pprice{color:var(--accent-dark)}
body.no-header-price th.mx-h .pprice{display:none}

th.mx-r{
  text-align:left;font-size:12.5px;font-weight:600;color:var(--ink);
  padding:11px 18px 11px 0;border-top:1px solid var(--line);vertical-align:top;
  white-space:nowrap;position:sticky;left:0;background:#fff;z-index:1;
}
td.mx-c{
  padding:11px 6px;border-top:1px solid var(--line);font-size:13px;
  color:var(--muted);vertical-align:top;transition:background .2s var(--ease);
}
td.mx-c.dash{color:#c8ccd2}
td.mx-c.tick{color:var(--accent-dark);font-weight:600}
/* THE HIGHLIGHT. CSS cannot select a column, so every cell carries data-col and
   .on is toggled across the whole column at once. */
td.mx-c.on{background:var(--accent-soft)}
tr.mx-money th.mx-r,tr.mx-money td.mx-c{border-top:1px solid var(--line);padding-top:13px}
tr.mx-money td.mx-c{font-family:var(--display);font-size:14.5px;font-weight:600;color:var(--ink);letter-spacing:-.02em}
tr.mx-money td.mx-c.on{color:var(--accent-dark)}
body.no-header-price tr.mx-money{display:table-row}
body:not(.no-header-price) tr.mx-money.dup{display:none}

/* Mobile: swipe, with the row labels pinned. A swiped table whose labels
   scroll away is unreadable by the third column. */
@media (max-width:720px){
  table.mx{min-width:640px}
  th.mx-r{font-size:12px;padding-right:12px;box-shadow:1px 0 0 var(--line)}
  .mx-hint{display:block}
}
.mx-hint{display:none;font-size:11.5px;color:var(--muted);margin-top:10px}
`;

const CHROME = `
body{margin:0;background:var(--bg-alt)}
.mk{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.mk-in{max-width:1240px;margin:0 auto;padding:11px 22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.mk h1{font-family:var(--display);font-size:13.5px;font-weight:600;margin:0}
.mk h1 span{color:var(--muted);font-weight:400}
.seg{display:flex;gap:2px;background:var(--bg-alt);padding:3px;border-radius:9px;border:1px solid var(--line)}
.seg button{font:inherit;font-size:12.5px;font-weight:500;border:0;background:transparent;color:var(--muted);padding:6px 12px;border-radius:6px;cursor:pointer;white-space:nowrap}
.seg button[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.mk .sp{flex:1}
.note{max-width:1240px;margin:0 auto;padding:20px 22px 0}
.note h2{font-family:var(--display);font-size:21px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
.note p{font-size:14.5px;color:var(--muted);max-width:84ch;margin:0 0 8px}
.note p b{color:var(--ink);font-weight:600}
.note .risk{font-size:13.5px;border-left:2px solid var(--rent);padding-left:12px}
.note .risk b{color:var(--rent-dark);font-weight:600}
.stagewrap{overflow-x:auto;padding:18px 0 70px}
.stage{margin:0 auto;background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 40px -22px rgba(0,0,0,.18);transition:width .28s var(--ease)}
.stage.w-desk{width:1160px}.stage.w-tab{width:860px}.stage.w-phone{width:390px}
.stage .wrap{padding:36px 30px}
`;

const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kaymen.dev — the matrix, in the site's own design</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${read('styles.css')}
${CSS}
${CHROME}</style>
</head>
<body class="no-header-price">
<div class="mk"><div class="mk-in">
  <h1>The matrix <span>— ShipStation shape, this site's design and highlight</span></h1>
  <div class="seg" id="pseg" role="group" aria-label="Where the price goes">
    <button data-p="rows" aria-pressed="true">Price in rows</button>
    <button data-p="head" aria-pressed="false">Price in header</button>
  </div>
  <div class="sp"></div>
  <div class="seg" id="wseg" role="group" aria-label="Width">
    <button data-w="w-desk" aria-pressed="true">1160</button>
    <button data-w="w-tab" aria-pressed="false">860</button>
    <button data-w="w-phone" aria-pressed="false">390</button>
  </div>
</div></div>

<div class="note">
  <h2>The shape Ariel asked for, without the thing that breaks it</h2>
  <p>Universals lifted <b>out</b> of the matrix into the band above, so every row left in it actually differs — no column of ticks that says nothing. Column headers are <b>controls</b>: clicking one sets the same <code>askSel</code> the pills and the sentence use, and the whole column highlights. It is a fourth way into one state, not a second pricing surface.</p>
  <p class="risk"><b>The toggle up there is the real decision.</b> ShipStation puts price in the column header. The recorded rule here is the opposite — "promote the price to the card heading and this becomes the rental frame the whole page argues against, with $15,000 on screen before anyone has read what it is for." Flip it and judge which you can live with.</p>
</div>

<div class="stagewrap"><div class="stage w-desk" id="stage">
  <div class="wrap">
    <p class="eyebrow">What each one includes</p>
    <h2 class="sec" style="margin-bottom:12px">Four situations, one ladder.</h2>
    <p class="sec-sub" style="max-width:60ch;margin-bottom:22px">Nothing is locked behind a bigger number. What changes is how much of the business the system covers.</p>

    <div class="mxwrap">
      <div class="mx-all">
        <b>Every one of them includes</b>
        <ul>${UNIVERSAL.map((u) => `<li>${u}</li>`).join('')}</ul>
      </div>

      <div class="mx-scroll">
        <table class="mx">
          <thead><tr><th class="mx-r" style="border-top:0"></th>
            ${RUNGS.map((r, i) => `<th class="mx-h">
              <button type="button" data-col="${i}" data-id="${r.id}" aria-pressed="${i === 1}" class="${i === 1 ? 'on' : ''}">
                <span class="pname">${r.product}</span>
                <span class="pprice">${r.from ? 'from ' + money(r.from) : 'no build fee'} · ${money(r.mo)}/mo</span>
              </button></th>`).join('')}
          </tr></thead>
          <tbody>
            ${ROWS.map((row) => `<tr><th class="mx-r">${row.label}</th>${row.v.map(cell).join('')}</tr>`).join('\n            ')}
            ${PRICE_ROWS.map((row) => `<tr class="mx-money dup"><th class="mx-r">${row.label}</th>${row.v.map(cell).join('')}</tr>`).join('\n            ')}
          </tbody>
        </table>
      </div>
      <p class="mx-hint">Swipe the table sideways to compare — the row names stay put.</p>
    </div>
  </div>
</div></div>

<script>
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* The same contract as script.js: nothing owns the state, everything reads it.
   Here that means the header button and every cell in its column. */
function select(col) {
  $$('th.mx-h button').forEach(function (b) {
    var on = +b.dataset.col === col;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $$('td.mx-c').forEach(function (c) { c.classList.toggle('on', +c.dataset.col === col); });
}
$$('th.mx-h button').forEach(function (b) {
  b.addEventListener('click', function () { select(+b.dataset.col); });
});
select(1);

$$('#pseg button').forEach(function (b) { b.addEventListener('click', function () {
  $$('#pseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
  document.body.classList.toggle('no-header-price', b.dataset.p === 'rows');
}); });
$$('#wseg button').forEach(function (b) { b.addEventListener('click', function () {
  $$('#wseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
  document.getElementById('stage').className = 'stage ' + b.dataset.w;
}); });
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'mockup', 'matrix-option.html'), doc);
console.log('wrote mockup/matrix-option.html  ' + Math.round(doc.length / 1024) + 'KB');
console.log('  ' + ROWS.length + ' differing rows in the matrix, ' + UNIVERSAL.length + ' universals lifted out');
