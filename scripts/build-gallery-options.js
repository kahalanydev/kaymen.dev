#!/usr/bin/env node
/**
 * Builds mockup/gallery-options.html — three layouts for /work as a
 * front-and-back gallery of everything, in one self-contained file.
 *
 *   node scripts/build-gallery-options.js
 *
 * GENERATED, so it uses styles.css verbatim and the real project data. The
 * screenshots are base64-inlined: one tokenised file with no siblings, and the
 * un-consented client shots stay off any public URL until the asks land.
 *
 * TWO CONTROLS, and the second is the honest one:
 *   · layout    A grid / B rows / C list
 *   · coverage  TODAY (6 of 17 have any imagery) vs SHOT (all 17, using a
 *               placeholder so the layout can be judged at full strength)
 *
 * "Showcase ALL our projects" is currently a gallery of six. Eleven have no
 * screenshot at all, and the back-office ones each need a local instance stood
 * up on seeded data. Designing against the finished state and discovering that
 * later is how a layout gets approved that nobody can actually fill.
 */
const fs = require('fs');
const path = require('path');
const P = require('../content/projects');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const b64 = (name) => {
  if (!name) return null;
  const f = path.join(ROOT, 'assets', 'shots', name + '.jpg');
  return fs.existsSync(f) ? 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64') : null;
};

/* Which back-office shot belongs to which project. The file names predate the
   FRONT_ENDS work and do not all match a slug, so the mapping is explicit
   rather than guessed — a guessed mapping puts the wrong client's back office
   under the wrong client's name, which is the worst bug this page could have. */
const BACK_SHOT = {
  'bilingual-booking-platform': 'horseharmony',
  'multi-campus-engagement-platform': 'thrive',
  'mortgage-broker-client-portal': 'bridgemtg',
  Predictable: 'predictable',
  /* Davenen and Kartov are deliberately ABSENT. davenen.jpg and kartov.jpg are
     the retired strip shots of their PUBLIC apps, not back offices - mapping
     them here rendered the same screenshot twice, once captioned 'what they
     see' and once 'what you run'. Labelling one image as both halves of the
     argument is worse than showing one half. */
};

/* Ohav's shooting list, 2026-08-19. Recorded here so the gallery can show what
   is coming rather than only what exists. */
const QUEUED = [
  'Davenen', 'torah-tracker', 'Kartov', 'Predictable',
  'mortgage-broker-client-portal', 'community-lending-ledger', 'Temani Chacham',
  /* "the financial work check tool" — AMBIGUOUS. Could be the MSP
     time-and-compliance portal (billable hours leaking) or Predictable (stock
     curation against a live broker). Not guessed; ask. */
];

const AREA = { platforms: 'Platforms', integrations: 'Integrations', apps: 'Apps' };

function build() {
  const rows = [];

  P.CASE_STUDIES.forEach((c) => {
    const fe = P.FRONT_ENDS[c.slug];
    const named = fe && fe.publish === true;
    rows.push({
      key: c.slug,
      area: c.area,
      title: named && c.client && c.client.real ? c.client.real : c.tagline,
      sub: named && fe ? fe.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : (fe ? 'public site' : ''),
      broke: c.hardPart && c.hardPart.title,
      deep: true,
      front: fe && fe.kind !== 'not-ours' ? b64(fe.shot + '-front') : null,
      back: b64(BACK_SHOT[c.slug]),
      cms: fe && fe.cms === true,
      queued: QUEUED.includes(c.slug),
    });
  });

  P.MORE_WORK.forEach((m) => {
    const fe = P.FRONT_ENDS[m.name];
    const named = fe ? fe.publish === true : m.own === true;
    rows.push({
      key: m.name,
      area: m.area,
      title: named ? m.name : m.name,
      sub: m.note || '',
      broke: null,
      deep: false,
      front: fe && fe.publish !== false ? b64(fe.shot + '-front') : (fe ? b64(fe.shot + '-front') : null),
      back: b64(BACK_SHOT[m.name]),
      cms: false,
      queued: QUEUED.includes(m.name),
    });
  });

  return rows;
}

const ROWS = build();
const withArt = ROWS.filter((r) => r.front || r.back).length;
console.log(`  ${ROWS.length} projects · ${withArt} with imagery · ${ROWS.length - withArt} without`);

const PLACEHOLDER =
  'data:image/svg+xml;base64,' + Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 562">
      <rect width="900" height="562" fill="#f4f5f7"/>
      <text x="450" y="285" text-anchor="middle" font-family="Inter,sans-serif"
            font-size="26" fill="#a3a8b0">not shot yet</text>
    </svg>`).toString('base64');

const shot = (src, host, cap) => {
  if (!src) return '';
  return `<figure class="shot${src ? '' : ' shot-empty'}">
        <div class="shot-bar"><i></i><i></i><i></i><em>${host}</em></div>
        <img src="${src || PLACEHOLDER}" alt="" loading="lazy" width="900" height="562">
        <figcaption><b>${cap}</b></figcaption>
      </figure>`;
};

const card = (r) => {
  const hasAny = r.front || r.back;
  const badge = r.cms ? '<span class="g-badge">One system</span>'
    : (r.front && r.back) ? '<span class="g-badge">Front and back</span>'
    : r.front ? '<span class="g-badge alt">Website</span>'
    : r.back ? '<span class="g-badge alt">System</span>' : '';
  const pending = !r.front && !r.back
    ? `<p class="g-pending">${r.queued ? 'Screenshots queued' : 'No screenshots yet'}</p>` : '';

  return `<article class="g-card${hasAny ? '' : ' g-thin'}" data-area="${r.area}">
      <div class="g-head">
        <h3>${r.title}</h3>
        ${badge}
      </div>
      ${r.sub ? `<p class="g-sub">${r.sub}</p>` : ''}
      ${hasAny ? `<div class="g-shots">
        ${shot(r.front, r.sub || 'the public site', 'What they see')}
        ${shot(r.back, 'the back office', 'What you run')}
      </div>` : pending + `
      <div class="g-shots g-queued">
        ${shot(PLACEHOLDER, r.sub || 'the public site', 'What they see')}
        ${shot(PLACEHOLDER, 'the back office', 'What you run')}
      </div>`}
      ${r.broke ? `<p class="g-broke"><b>The hard part</b>${r.broke}</p>` : ''}
    </article>`;
};

const CSS = `
.gal{max-width:var(--w-page);margin:0 auto;padding:40px 22px 70px}
.gal-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:26px}
.gal-filters button{font:inherit;font-size:13px;font-weight:500;border:1px solid var(--line);background:#fff;color:var(--muted);padding:8px 14px;border-radius:22px;cursor:pointer}
.gal-filters button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-dark);font-weight:600}
.gal-filters button i{font-style:normal;opacity:.6;margin-left:4px}

.g-card{border:1px solid var(--line);border-radius:14px;background:#fff;padding:18px 20px;margin-bottom:16px}
.g-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.g-head h3{font-family:var(--display);font-size:16px;font-weight:600;letter-spacing:-.02em}
.g-badge{margin-left:auto;font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-dark);background:var(--accent-soft);border:1px solid rgba(43,188,179,.3);padding:3px 9px;border-radius:20px}
.g-badge.alt{color:var(--muted);background:var(--bg-alt);border-color:var(--line)}
.g-sub{font-size:12.5px;color:var(--muted);margin-top:3px}
.g-shots{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.g-shots .shot{margin:0}
.g-shots .shot img{height:auto}
.shot-empty img{opacity:.55}
.g-broke{font-size:12.5px;color:var(--muted);margin-top:12px;padding-top:11px;border-top:1px solid var(--line)}
.g-broke b{display:block;font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--rent-dark);margin-bottom:2px}
.g-pending{font-size:12.5px;color:var(--muted);margin-top:10px;font-style:italic}
.g-thin{background:var(--bg-alt);border-style:dashed}
/* the not-yet-shot preview only appears in the "once shot" view */
.g-queued{display:none}
.cov-shot .g-queued{display:grid}
.cov-shot .g-thin .g-pending{display:none}
.cov-shot .g-thin{background:#fff;border-style:solid}

/* A — grid of cards */
.lay-A .gal-body{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.lay-A .g-card{margin-bottom:0}
.lay-A .g-shots{grid-template-columns:1fr 1fr;gap:8px}

/* B — full-width rows */
.lay-B .g-card{padding:22px 24px}
.lay-B .g-shots{gap:16px}

/* C — compact list, images only on the ones that have them */
.lay-C .g-card{padding:12px 16px;margin-bottom:8px}
.lay-C .g-shots{grid-template-columns:1fr 1fr;gap:8px;max-width:520px}
.lay-C .g-broke{margin-top:9px;padding-top:8px}
.lay-C .g-head h3{font-size:14.5px}

@media (max-width:860px){
  .lay-A .gal-body{grid-template-columns:1fr}
  .g-shots{grid-template-columns:1fr}
  .lay-C .g-shots{max-width:none}
}
`;

const CHROME = `
body{margin:0;background:var(--bg-alt)}
.mk{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.mk-in{max-width:1240px;margin:0 auto;padding:11px 22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.mk h1{font-family:var(--display);font-size:13.5px;font-weight:600;margin:0;white-space:nowrap}
.mk h1 span{color:var(--muted);font-weight:400}
.seg{display:flex;gap:2px;background:var(--bg-alt);padding:3px;border-radius:9px;border:1px solid var(--line)}
.seg button{font:inherit;font-size:12.5px;font-weight:500;border:0;background:transparent;color:var(--muted);padding:6px 12px;border-radius:6px;cursor:pointer;white-space:nowrap}
.seg button[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.mk .sp{flex:1}
.mk .cov{font-size:11.5px;color:var(--rent-dark);font-weight:600}
.note{max-width:1240px;margin:0 auto;padding:20px 22px 0}
.note .pane{display:none}.note .pane.on{display:block}
.note h2{font-family:var(--display);font-size:21px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
.note p{font-size:14.5px;color:var(--muted);max-width:82ch;margin:0}
.note p b{color:var(--ink);font-weight:600}
.note .risk{margin-top:8px;font-size:13.5px;border-left:2px solid var(--rent);padding-left:12px}
.note .risk b{color:var(--rent-dark);font-weight:600}
.stagewrap{overflow-x:auto;padding:18px 0 70px}
.stage{margin:0 auto;background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 40px -22px rgba(0,0,0,.18);transition:width .28s var(--ease)}
.stage.w-desk{width:1200px}.stage.w-tab{width:860px}.stage.w-phone{width:390px}
.lay{display:none}.lay.on{display:block}
`;

const NOTES = {
  A: { h: 'A — grid of cards', p: 'Two cards across, each holding its own front/back pair at half width. Densest of the three: seventeen projects fit in about nine rows.', r: '<b>Risk:</b> at 1200px each screenshot ends up ~270px wide, which is page-shape only — you cannot read a nav or a column header. Fine for "this is real", useless for "look what it does".' },
  B: { h: 'B — full-width rows', p: 'One project per row, the pair at the width it gets on the homepage today. Screenshots stay legible and the page reads as a portfolio rather than a contact sheet.', r: '<b>Risk:</b> it is long. Seventeen of these is a lot of scrolling, and the eleven with no imagery become obvious gaps rather than quiet entries.' },
  C: { h: 'C — compact list', p: 'Every project is a tight row; the ones with imagery carry a small pair, the ones without are a line of text. Scannable in one screen, and it degrades gracefully — a project with no screenshot does not look broken, it looks brief.', r: '<b>Risk:</b> the least impressive of the three, and it undersells the pairs that are genuinely good. The Horse & Harmony pair deserves more than 260px.' },
};

const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kaymen.dev — /work as a gallery, three layouts</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* GENERATED by scripts/build-gallery-options.js — do not hand-edit. */
${read('styles.css')}
${CSS}
${CHROME}
</style>
</head>
<body>
<div class="mk"><div class="mk-in">
  <h1>/work as a gallery <span>— three layouts</span></h1>
  <div class="seg" id="dseg" role="group" aria-label="Layout">
    <button data-d="A" aria-pressed="true">A · Grid</button>
    <button data-d="B" aria-pressed="false">B · Rows</button>
    <button data-d="C" aria-pressed="false">C · List</button>
  </div>
  <div class="seg" id="cseg" role="group" aria-label="Coverage">
    <button data-c="today" aria-pressed="true">Today</button>
    <button data-c="shot" aria-pressed="false">Once shot</button>
  </div>
  <div class="sp"></div>
  <span class="cov" id="cov"></span>
  <div class="seg" id="wseg" role="group" aria-label="Width">
    <button data-w="w-desk" aria-pressed="true">1200</button>
    <button data-w="w-tab" aria-pressed="false">860</button>
    <button data-w="w-phone" aria-pressed="false">390</button>
  </div>
</div></div>

<div class="note">
  ${Object.keys(NOTES).map((k, i) => `<div class="pane${i === 0 ? ' on' : ''}" data-p="${k}">
    <h2>${NOTES[k].h}</h2><p>${NOTES[k].p}</p><p class="risk">${NOTES[k].r}</p>
  </div>`).join('\n  ')}
</div>

<div class="stagewrap"><div class="stage w-desk" id="stage">
  <!-- ONE body. The first pass rendered three layouts x two coverage states,
       which inlined every screenshot SIX times and produced an 8MB file. The
       layout is a class on the wrapper and coverage is a class on the cards;
       nothing is duplicated. -->
  <div class="lay lay-A on" id="lay">
    <div class="gal">
      <p class="eyebrow">Everything</p>
      <h1 class="sec" style="margin-bottom:12px">Seventeen things, and what each one looks like.</h1>
      <p class="sec-sub" style="max-width:60ch;margin-bottom:26px">The public site people use, and the system behind it. Six of these are written up in full.</p>
      <div class="gal-filters" data-filters></div>
      <div class="gal-body">${ROWS.map(card).join('\n')}</div>
    </div>
  </div>
</div></div>

<script>
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var AREAS = [['all','Everything'],['platforms','Platforms'],['integrations','Integrations'],['apps','Apps']];
var mode = 'today', area = 'all';

function counts() {
  var vis = $$('#lay .g-card').filter(function (c) { return c.style.display !== 'none'; });
  var withArt = vis.filter(function (c) { return c.querySelector('.g-shots'); }).length;
  document.getElementById('cov').textContent = mode === 'today'
    ? withArt + ' of ' + vis.length + ' have imagery'
    : 'preview: every project shot';
}
function apply() {
  document.getElementById('lay').classList.toggle('cov-shot', mode === 'shot');
  $$('.g-card').forEach(function (c) {
    c.style.display = (area === 'all' || c.dataset.area === area) ? '' : 'none';
  });
  counts();
}
[document.getElementById('lay')].forEach(function (l) {
  var host = l.querySelector('[data-filters]');
  AREAS.forEach(function (a) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(a[0] === 'all'));
    b.textContent = a[1];
    var n = document.createElement('i');
    n.textContent = ' ' + (a[0] === 'all' ? ${ROWS.length} : ${JSON.stringify(ROWS.reduce((o, r) => { o[r.area] = (o[r.area] || 0) + 1; return o; }, {}))}[a[0]] || 0);
    b.appendChild(n);
    b.addEventListener('click', function () {
      area = a[0];
      $$('.gal-filters button').forEach(function (o) { o.setAttribute('aria-pressed', String(o.textContent === b.textContent)); });
      apply();
    });
    host.appendChild(b);
  });
});
$$('#dseg button').forEach(function (b) { b.addEventListener('click', function () {
  $$('#dseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
  /* Layout is a CLASS on one wrapper, not three copies of the gallery. Three
     layouts x two coverage states inlined every screenshot six times and made
     an 8MB file — the same content, six times, to change a grid rule. */
  document.getElementById('lay').className = 'lay lay-' + b.dataset.d + ' on' +
    (mode === 'shot' ? ' cov-shot' : '');
  $$('.note .pane').forEach(function (p) { p.classList.toggle('on', p.dataset.p === b.dataset.d); });
  apply();
}); });
$$('#cseg button').forEach(function (b) { b.addEventListener('click', function () {
  mode = b.dataset.c;
  $$('#cseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
  apply();
}); });
$$('#wseg button').forEach(function (b) { b.addEventListener('click', function () {
  $$('#wseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
  document.getElementById('stage').className = 'stage ' + b.dataset.w;
}); });
apply();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'mockup', 'gallery-options.html'), doc);
console.log('  wrote mockup/gallery-options.html  ' + Math.round(doc.length / 1024) + 'KB');
