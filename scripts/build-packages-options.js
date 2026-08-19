#!/usr/bin/env node
/**
 * Builds mockup/packages-options.html — three ways to make the four rungs
 * actually comparable.
 *
 *   node scripts/build-packages-options.js
 *
 * ARIEL, 2026-08-19: "i dont see the difference in packages here honestly...
 * needs to be much more clear", pointing at ShipStation's pricing matrix.
 *
 * HE IS RIGHT, AND THE CAUSE IS STRUCTURAL. Dumping the current ticks side by
 * side shows it immediately:
 *
 *   tier 2  "Logins for everyone who needs one, no per-seat fee"
 *   tier 3  "No per-seat licence, add who you like"          <- same claim
 *
 *   tier 2  "Yours, on your infrastructure and in your accounts"
 *   tier 3  "Yours to take elsewhere at any time"            <- near-identical
 *
 *   tier 1  "Backups verified" / "Patches" / "Someone answers"
 *                                                            <- true of ALL of
 *           them, listed on one card, so the others look like they lack it
 *
 * The cards list UNIVERSAL properties as if they were differentiators, and each
 * card picks different universals. Only tier 4 carries a real one (ten hours of
 * development a month). So there is nothing to compare, and no amount of
 * restyling fixes that — the content has to be split into what every plan
 * includes and what actually differs.
 *
 * WHY NOT SIMPLY COPY SHIPSTATION. Their matrix works because their tiers are
 * FEATURE-GATED: pay more, unlock features. These tiers are not. Every rung has
 * unlimited people, ownership, no lock-in, backups, patching and a human who
 * answers. A feature matrix would be almost entirely ticked in every column,
 * which looks absurd AND undersells — it implies the cheap rung is missing
 * things it is not. The honest axis is SCOPE, not features.
 *
 * The recorded decision this has to answer to is in index.html and the ladder
 * doc: "deliberately NOT a tier table... promote the price to the card heading
 * and this becomes the rental frame the whole page argues against, with $15,000
 * on screen before anyone has read what it is for." Direction B tests exactly
 * that trade rather than pretending the decision was not made.
 */
const fs = require('fs');
const path = require('path');
const P = require('../content/pricing');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const money = P.money;

const RUNGS = P.BASES.map((b) => ({
  id: b.id, chip: b.chip, name: b.name, note: b.note,
  build: b.from, mo: b.mo,
}));

/* True of every rung. Said ONCE, above the comparison, instead of three of them
   being scattered across four cards as though they were differences. */
const UNIVERSAL = [
  'You own the code, the data and the servers',
  'Logins for everyone who needs one — no per-seat fee, ever',
  'Backups verified, not assumed',
  'Patches and dependency updates',
  'Monitored, and a person answers when it breaks',
  'Yours to take elsewhere at any time, no exit fee',
];

/* The axes on which the rungs ACTUALLY differ. Same rows, different values —
   which is what makes it a comparison rather than four lists. */
const AXES = [
  { label: 'What it covers', values: [
    'A system you already have',
    'One part of the business',
    'Work spread across several tools',
    'Several systems and several teams',
  ] },
  { label: 'Replaces', values: ['—', '1 tool or spreadsheet', '3–6 tools', 'A whole stack'] },
  { label: 'Reporting across teams', values: ['—', '—', 'One source of truth', 'Across every team'] },
  { label: 'Development included', values: ['Small changes', 'Small changes', 'Small changes', '10 hours a month, rolls over'] },
  { label: 'Build', values: RUNGS.map((r) => (r.build ? 'from ' + money(r.build) : 'no build fee')) },
  { label: 'Monthly', values: RUNGS.map((r) => money(r.mo)) },
];

const CSS = `
.pk{max-width:var(--w-page);margin:0 auto;padding:40px 22px 60px}
.pk h2.sec{margin-bottom:12px}
.pk .sec-sub{font-size:16.5px;color:var(--muted);max-width:62ch;margin-bottom:26px}

/* the universals, said once */
.pk-all{border:1px solid rgba(43,188,179,.3);background:var(--accent-soft);border-radius:14px;padding:18px 22px;margin-bottom:26px}
.pk-all b{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-dark);margin-bottom:10px}
.pk-all ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:6px 22px}
.pk-all li{font-size:13.5px;color:var(--ink);display:flex;gap:8px;align-items:flex-start}
.pk-all li::before{content:"✓";color:var(--accent-dark);font-weight:700;flex:none}
@media (max-width:760px){.pk-all ul{grid-template-columns:1fr}}

/* A — compact matrix */
.mx{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.mx th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:0 12px 12px 0;vertical-align:bottom}
.mx thead th.col{font-family:var(--display);font-size:14px;font-weight:600;letter-spacing:-.01em;color:var(--ink);text-transform:none}
.mx td{padding:11px 12px 11px 0;border-top:1px solid var(--line);font-size:13.5px;color:var(--muted);vertical-align:top}
.mx tr.money td{font-family:var(--display);font-size:15px;font-weight:600;color:var(--ink);letter-spacing:-.02em}
.mx th.rowlab{font-weight:600;color:var(--ink);text-transform:none;letter-spacing:0;font-size:13px;padding-right:22px;border-top:1px solid var(--line);padding-top:11px}
.mx .on{background:var(--accent-soft)}
.mx td.dash{color:#c2c7ce}

/* B — the ShipStation shape */
.gate{width:100%;border-collapse:collapse}
.gate th{font-family:var(--display);font-size:14px;font-weight:600;padding:0 10px 14px 0;text-align:center}
.gate th:first-child{text-align:left}
.gate th .price{display:block;font-family:var(--body);font-size:12px;font-weight:500;color:var(--muted);margin-top:3px}
.gate td{padding:10px;border-top:1px solid var(--line);text-align:center;font-size:13.5px;color:var(--muted)}
.gate td:first-child{text-align:left;color:var(--ink);font-size:13px}
.gate .yes{color:var(--accent-dark);font-weight:700}
.gate .no{color:#c2c7ce}

/* C — one at a time with an explicit delta */
.step{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.step button{font:inherit;font-size:13px;font-weight:500;border:1px solid var(--line);background:#fff;color:var(--muted);padding:9px 15px;border-radius:22px;cursor:pointer}
.step button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-dark);font-weight:600}
.rung{border:1px solid var(--line);border-radius:16px;padding:24px 26px;background:#fff;max-width:720px}
.rung h3{font-family:var(--display);font-size:21px;font-weight:600;letter-spacing:-.02em}
.rung .note{font-size:14.5px;color:var(--muted);margin-top:8px;line-height:1.65}
.rung .adds{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
.rung .adds b{display:block;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--accent-dark);margin-bottom:8px}
.rung .adds li{list-style:none;font-size:13.5px;color:var(--ink);display:flex;gap:8px;margin-bottom:5px}
.rung .adds li::before{content:"+";color:var(--accent-dark);font-weight:700}
.rung .cost{display:flex;gap:26px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)}
.rung .cost div b{display:block;font-family:var(--display);font-size:20px;font-weight:600;letter-spacing:-.02em}
.rung .cost div span{font-size:12px;color:var(--muted)}
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
.note .pane{display:none}.note .pane.on{display:block}
.note h2{font-family:var(--display);font-size:21px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
.note p{font-size:14.5px;color:var(--muted);max-width:84ch;margin:0}
.note p b{color:var(--ink);font-weight:600}
.note .risk{margin-top:8px;font-size:13.5px;border-left:2px solid var(--rent);padding-left:12px}
.note .risk b{color:var(--rent-dark);font-weight:600}
.stagewrap{overflow-x:auto;padding:18px 0 70px}
.stage{margin:0 auto;background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 40px -22px rgba(0,0,0,.18);transition:width .28s var(--ease)}
.stage.w-desk{width:1160px}.stage.w-tab{width:860px}.stage.w-phone{width:390px}
.dir{display:none}.dir.on{display:block}
`;

const head = `
      <p class="eyebrow">What each one is</p>
      <h2 class="sec">Four situations, one ladder.</h2>
      <p class="sec-sub">They are not feature tiers — nothing is locked behind a bigger number. What changes is how much of the business the system covers.</p>
      <div class="pk-all">
        <b>Every one of them includes</b>
        <ul>${UNIVERSAL.map((u) => `<li>${u}</li>`).join('')}</ul>
      </div>`;

const dirA = `<div class="pk">${head}
  <table class="mx">
    <thead><tr><th></th>${RUNGS.map((r, i) => `<th class="col${i === 1 ? ' on' : ''}">${r.chip}</th>`).join('')}</tr></thead>
    <tbody>
      ${AXES.map((a) => `<tr class="${/Build|Monthly/.test(a.label) ? 'money' : ''}">
        <th class="rowlab">${a.label}</th>
        ${a.values.map((v, i) => `<td class="${v === '—' ? 'dash ' : ''}${i === 1 ? 'on' : ''}">${v}</td>`).join('')}
      </tr>`).join('\n      ')}
    </tbody>
  </table>
</div>`;

const GATE_ROWS = [
  ['Everything you own — code, data, servers', [1, 1, 1, 1]],
  ['Unlimited logins, no per-seat fee', [1, 1, 1, 1]],
  ['Backups, patching, monitoring', [1, 1, 1, 1]],
  ['A person answers when it breaks', [1, 1, 1, 1]],
  ['Take it elsewhere any time', [1, 1, 1, 1]],
  ['Replaces a tool or spreadsheet', [0, 1, 1, 1]],
  ['One source of truth across tools', [0, 0, 1, 1]],
  ['Reporting across every team', [0, 0, 0, 1]],
  ['Ten hours of development a month', [0, 0, 0, 1]],
];

const dirB = `<div class="pk">${head}
  <table class="gate">
    <thead><tr><th></th>${RUNGS.map((r) => `<th>${r.chip}<span class="price">${r.build ? 'from ' + money(r.build) : 'no build fee'} · ${money(r.mo)}/mo</span></th>`).join('')}</tr></thead>
    <tbody>${GATE_ROWS.map(([label, cells]) => `<tr><td>${label}</td>${cells.map((c) => `<td class="${c ? 'yes' : 'no'}">${c ? '✓' : '—'}</td>`).join('')}</tr>`).join('\n    ')}</tbody>
  </table>
  <p class="fine" style="margin-top:18px">Five of the nine rows are ticked in every column, which is the honest picture and also the problem with drawing it this way.</p>
</div>`;

const ADDS = [
  [],
  ['A real database instead of a spreadsheet', 'One part of the business, properly'],
  ['Several tools replaced by one system', 'One source of truth instead of six exports'],
  ['Reporting that crosses every team', 'Ten hours of development a month, rolling over'],
];

const dirC = `<div class="pk">${head}
  <div class="step" id="stepseg">${RUNGS.map((r, i) => `<button data-i="${i}" aria-pressed="${i === 1}">${r.chip}</button>`).join('')}</div>
  <div class="rung" id="rungbox"></div>
  <script id="rungdata" type="application/json">${JSON.stringify(RUNGS.map((r, i) => ({
    chip: r.chip, name: r.name, note: r.note, adds: ADDS[i],
    build: r.build ? 'from ' + money(r.build) : 'No build fee',
    mo: money(r.mo) + '/mo',
  })))}</script>
</div>`;

const NOTES = {
  A: { h: 'A — same rows, different values', p: 'The universals are stated <b>once</b>, above the table. Below it, six rows that every rung answers differently: what it covers, how many tools it replaces, reporting, development included, build, monthly. That is a comparison — you read across a row and see the difference.', r: '<b>Risk:</b> it is a table, and the recorded decision was "deliberately not a tier table" because a table promotes the price. This keeps price as the last two rows rather than the heading, which is the compromise — but it is still closer to a pricing table than what is there now.' },
  B: { h: 'B — the ShipStation shape', p: 'A literal feature matrix, ticks and all, exactly what Ariel pointed at. Nine rows, four columns, every cell answered.', r: '<b>Risk, and it is fatal:</b> <b>five of the nine rows are ticked in every column</b>, because these tiers are not feature-gated — everyone gets ownership, unlimited logins, backups, patching and a human. ShipStation\'s matrix works because paying more unlocks things. Ours would advertise that the cheapest rung is missing almost nothing, and put $15,000 in a column heading on the page that argues against rental pricing.' },
  C: { h: 'C — one at a time, with the delta named', p: 'Closest to what is there now, but each rung explicitly says <b>what it adds over the one before</b>. The comparison is sequential rather than side by side: no table, no price in a heading, and the ladder reads as a ladder.', r: '<b>Risk:</b> it still needs a click to compare, which is the complaint Ariel actually made. It fixes "I cannot tell them apart" but not "show me everything at once".' },
};

const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kaymen.dev — telling the packages apart, three ways</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${read('styles.css')}
${CSS}
${CHROME}</style>
</head>
<body>
<div class="mk"><div class="mk-in">
  <h1>Telling the packages apart <span>— Ariel's note, three answers</span></h1>
  <div class="seg" id="dseg" role="group" aria-label="Direction">
    <button data-d="A" aria-pressed="true">A · Same rows</button>
    <button data-d="B" aria-pressed="false">B · ShipStation shape</button>
    <button data-d="C" aria-pressed="false">C · One at a time</button>
  </div>
  <div class="sp"></div>
  <div class="seg" id="wseg" role="group" aria-label="Width">
    <button data-w="w-desk" aria-pressed="true">1160</button>
    <button data-w="w-tab" aria-pressed="false">860</button>
    <button data-w="w-phone" aria-pressed="false">390</button>
  </div>
</div></div>
<div class="note">${Object.keys(NOTES).map((k, i) => `<div class="pane${i === 0 ? ' on' : ''}" data-p="${k}"><h2>${NOTES[k].h}</h2><p>${NOTES[k].p}</p><p class="risk">${NOTES[k].r}</p></div>`).join('')}</div>
<div class="stagewrap"><div class="stage w-desk" id="stage">
  <div class="dir on" data-dir="A">${dirA}</div>
  <div class="dir" data-dir="B">${dirB}</div>
  <div class="dir" data-dir="C">${dirC}</div>
</div></div>
<script>
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var RD = JSON.parse(document.getElementById('rungdata').textContent);
function paintRung(i) {
  var r = RD[i];
  document.getElementById('rungbox').innerHTML =
    '<h3>' + r.name + '</h3><p class="note">' + r.note + '</p>' +
    (r.adds.length ? '<div class="adds"><b>What this adds over the one before</b><ul>' +
      r.adds.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ul></div>' : '') +
    '<div class="cost"><div><b>' + r.build + '</b><span>to build, once</span></div>' +
    '<div><b>' + r.mo + '</b><span>after that, flat</span></div></div>';
  $$('#stepseg button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.i === i)); });
}
$$('#stepseg button').forEach(function (b) { b.addEventListener('click', function () { paintRung(+b.dataset.i); }); });
paintRung(1);
$$('#dseg button').forEach(function (b) { b.addEventListener('click', function () {
  $$('#dseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
  $$('.dir').forEach(function (d) { d.classList.toggle('on', d.dataset.dir === b.dataset.d); });
  $$('.note .pane').forEach(function (p) { p.classList.toggle('on', p.dataset.p === b.dataset.d); });
}); });
$$('#wseg button').forEach(function (b) { b.addEventListener('click', function () {
  $$('#wseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
  document.getElementById('stage').className = 'stage ' + b.dataset.w;
}); });
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'mockup', 'packages-options.html'), doc);
console.log('wrote mockup/packages-options.html  ' + Math.round(doc.length / 1024) + 'KB');
