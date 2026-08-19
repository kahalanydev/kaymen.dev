#!/usr/bin/env node
/**
 * Builds mockup/proof-options.html — three ways to show front-and-back, in one
 * self-contained file.
 *
 *   node scripts/build-proof-options.js
 *
 * GENERATED, so it uses styles.css verbatim and the real FRONT_ENDS data. The
 * screenshots are base64-inlined rather than linked: the deliverable is served
 * as a single tokenised file with no siblings, AND inlining means these client
 * screenshots are not sitting at a guessable public URL before the consent asks
 * have gone out.
 *
 * TWO CONTROLS, and the second one is the point:
 *   · direction  A pairs / B flip / C overlap
 *   · consent    NAMED (what ships once the yeses land) vs ANONYMOUS (what can
 *                ship today). Three of the seven front ends are publish:false,
 *                so "anonymous" is not a hypothetical - it is the current state.
 */
const fs = require('fs');
const path = require('path');
const PROJECTS = require('../content/projects');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const b64 = (p) => {
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) return null;
  return 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
};

/* The three pairs worth showing, strongest first. Each carries the shape of the
   claim it supports, because they are NOT equal and the section should not
   pretend they are. */
/* BridgeMortgage is NOT here on purpose: bridgemtg.com is a GoDaddy Website
   Builder template, checked 2026-08-18. We built its back office only, so it
   cannot be a front-and-back pair. See FRONT_ENDS in content/projects.js. */
const PAIRS = [
  {
    key: 'bilingual-booking-platform',
    shape: 'one', badge: 'One system, one login',
    named: { title: 'Horse & Harmony', host: 'horseandharmonyil.com' },
    anon: { title: 'A therapeutic riding centre', host: 'a bilingual public site' },
    front: b64('assets/shots/horseharmony-front.jpg'),
    back: b64('assets/shots/horseharmony.jpg'),
    frontCap: 'What riders book through',
    backCap: 'What the staff run — and where the site’s own hero, gallery and texts are edited',
  },
  {
    key: 'multi-campus-engagement-platform',
    shape: 'two', badge: 'Public site and staff CRM',
    named: { title: 'Olami Herzliya', host: 'olamiherzliya.org' },
    anon: { title: 'A multi-campus student organisation', host: 'a public sign-up site' },
    front: b64('assets/shots/olami-front.jpg'),
    back: b64('assets/shots/thrive.jpg'),
    frontCap: 'Events, tickets and sign-ups, in English and Spanish',
    backCap: 'The same database, as the staff see it',
  },
];

/* The website-only row. It is the answer to "the guy who wants a good website
   never reaches out" - proof that the work is taken seriously on its own. */
const SOLO = {
  key: 'Investment firm site',
  named: { title: 'Richmount Capital', host: 'richmountcapital.com' },
  anon: { title: 'An investment fund', host: 'a public marketing site' },
  front: b64('assets/shots/richmount-front.jpg'),
  cap: 'A fund’s public face: thesis, strategy, team, and a gated investor deck. No system behind it — this one is the website.',
};

const missing = PAIRS.filter((p) => !p.front || !p.back).map((p) => p.key);
if (missing.length) console.warn('  WARNING missing shots for: ' + missing.join(', '));

const CSS = `
.pf{max-width:var(--w-page);margin:0 auto;padding:44px 22px 60px}
.pf .eyebrow{margin-bottom:12px}
.pf h2.sec{margin-bottom:12px}
.pf .sec-sub{font-size:16.5px;color:var(--muted);max-width:62ch;margin-bottom:34px}

/* --- A: pairs side by side --- */
.pair{margin-bottom:34px}
.pair-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.pair-head h3{font-family:var(--display);font-size:18px;font-weight:600;letter-spacing:-.02em}
.pair-head .host{font-size:12.5px;color:var(--muted)}
.pair-head .badge{margin-left:auto;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-dark);background:var(--accent-soft);border:1px solid rgba(43,188,179,.3);padding:4px 10px;border-radius:20px}
.pair-shots{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.shotbox{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 10px 30px -18px rgba(22,48,61,.3)}
.shotbox .bar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--bg-alt);border-bottom:1px solid var(--line)}
.shotbox .bar i{width:8px;height:8px;border-radius:50%;background:var(--line);flex:none}
.shotbox .bar em{font-style:normal;font-size:11px;color:var(--muted);margin-left:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shotbox img{display:block;width:100%;height:auto}
.shotbox figcaption{padding:11px 14px;font-size:12.5px;color:var(--muted);line-height:1.5}
.shotbox figcaption b{display:block;color:var(--ink);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}

/* --- B: flip --- */
.flip{margin-bottom:30px}
.flip-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:11px}
.flip-head h3{font-family:var(--display);font-size:18px;font-weight:600;letter-spacing:-.02em}
.flip-head .host{font-size:12.5px;color:var(--muted)}
.flipseg{margin-left:auto;display:flex;gap:2px;background:var(--bg-alt);padding:3px;border-radius:8px;border:1px solid var(--line)}
.flipseg button{font:inherit;font-size:12px;font-weight:500;border:0;background:transparent;color:var(--muted);padding:5px 12px;border-radius:5px;cursor:pointer}
.flipseg button[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.flip .shotbox img{transition:opacity .18s var(--ease)}

/* --- C: overlap --- */
.ov{position:relative;margin-bottom:56px;padding-bottom:60px}
.ov-head{margin-bottom:14px}
.ov-head h3{font-family:var(--display);font-size:18px;font-weight:600;letter-spacing:-.02em}
.ov-head .host{font-size:12.5px;color:var(--muted)}
.ov-front{width:74%;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 18px 46px -22px rgba(22,48,61,.34)}
.ov-back{position:absolute;right:0;bottom:0;width:56%;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 22px 54px -20px rgba(22,48,61,.4)}
.ov-front img,.ov-back img{display:block;width:100%;height:auto}
.ov-tag{position:absolute;left:0;bottom:0;width:36%;font-size:12.5px;color:var(--muted);line-height:1.55}
.ov-tag b{display:block;color:var(--ink);font-weight:600}

/* --- the website-only row, shared --- */
.solo{border-top:1px solid var(--line);padding-top:30px;margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:center}
.solo h3{font-family:var(--display);font-size:18px;font-weight:600;letter-spacing:-.02em;margin-bottom:4px}
.solo .host{font-size:12.5px;color:var(--muted);margin-bottom:10px}
.solo p{font-size:14px;color:var(--muted);line-height:1.6}

@media (max-width:860px){
  .pair-shots{grid-template-columns:1fr}
  .solo{grid-template-columns:1fr;gap:16px}
  .ov-front{width:100%}
  .ov-back{position:static;width:78%;margin:-28px 0 0 auto}
  .ov-tag{position:static;width:auto;margin-top:14px}
  .ov{padding-bottom:0;margin-bottom:36px}
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
.mk .warn{font-size:11.5px;color:var(--rent-dark);font-weight:600}
.note{max-width:1240px;margin:0 auto;padding:22px 22px 0}
.note .pane{display:none}.note .pane.on{display:block}
.note h2{font-family:var(--display);font-size:22px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
.note p{font-size:14.5px;color:var(--muted);max-width:80ch;margin:0}
.note p b{color:var(--ink);font-weight:600}
.note .risk{margin-top:9px;font-size:13.5px;border-left:2px solid var(--rent);padding-left:12px}
.note .risk b{color:var(--rent-dark);font-weight:600}
.stagewrap{overflow-x:auto;padding:20px 0 70px}
.stage{margin:0 auto;background:var(--bg);border:1px solid var(--line);border-radius:16px;transition:width .28s var(--ease);box-shadow:0 12px 40px -22px rgba(0,0,0,.18);overflow:hidden}
.stage.w-desk{width:1200px}.stage.w-tab{width:860px}.stage.w-phone{width:390px}
.dir{display:none}.dir.on{display:block}
`;

const NOTES = {
  A: { h: 'A — pairs, side by side',
    p: 'The two screenshots next to each other, labelled. No cleverness: what the customer sees, and what the staff run. Reads without being operated, works in a screenshot, and stacks cleanly on a phone.',
    r: '<b>Risk:</b> it is the tallest of the three — two images per project means the section grows fast, and three pairs is already most of a screen. It also makes every project look equally strong, when only Horse &amp; Harmony is genuinely one system.' },
  B: { h: 'B — the flip',
    p: 'One frame per project with a <b>Front / Back</b> toggle. Half the height of A, and the <i>act of flipping</i> is the argument — you are shown the same project twice and have to notice it is the same project.',
    r: '<b>Risk:</b> a visitor who never clicks sees only half of it, and most visitors never click. It also cannot be screenshotted as proof, which matters for a page people send to a colleague.' },
  C: { h: 'C — overlap',
    p: 'The public site with the back office breaking out from behind it, one composite per project. The most designed of the three, and the only one where a single glance carries "these are the same thing".',
    r: '<b>Risk:</b> the back office is the smaller image, and it is the harder thing to build — the composition puts the weaker claim forward. Also the fussiest to make work at 390px, where it becomes a stack anyway.' },
};

const shotbox = (src, host, capTitle, cap) => src ? `
        <figure class="shotbox">
          <div class="bar"><i></i><i></i><i></i><em>${host}</em></div>
          <img src="${src}" alt="" loading="lazy">
          <figcaption><b>${capTitle}</b>${cap}</figcaption>
        </figure>` : '<div class="shotbox" style="padding:40px;text-align:center;color:var(--muted)">shot missing</div>';

const nameFor = (p) => `<span data-named="${p.named.title}" data-anon="${p.anon.title}" class="jsname">${p.named.title}</span>`;
const hostFor = (p) => `<span data-named="${p.named.host}" data-anon="${p.anon.host}" class="jshost">${p.named.host}</span>`;

const dirA = `
  <div class="pf">
    <p class="eyebrow">The proof</p>
    <h2 class="sec">The site your customers use, and the system behind it.</h2>
    <p class="sec-sub">Most shops build one or the other. Every pair below is the same project, twice.</p>
    ${PAIRS.map((p) => `
    <div class="pair">
      <div class="pair-head"><h3>${nameFor(p)}</h3><span class="host">${hostFor(p)}</span><span class="badge">${p.badge}</span></div>
      <div class="pair-shots">
        ${shotbox(p.front, p.named.host, 'What they see', p.frontCap)}
        ${shotbox(p.back, 'the back office', 'What you run', p.backCap)}
      </div>
    </div>`).join('')}
    <div class="solo">
      <div>
        <h3>${nameFor(SOLO)}</h3>
        <div class="host">${hostFor(SOLO)}</div>
        <p>${SOLO.cap}</p>
      </div>
      ${shotbox(SOLO.front, SOLO.named.host, 'Website only', 'No system behind it. Sometimes the website is the whole job, and we take that seriously too.')}
    </div>
  </div>`;

const dirB = `
  <div class="pf">
    <p class="eyebrow">The proof</p>
    <h2 class="sec">The site your customers use, and the system behind it.</h2>
    <p class="sec-sub">Most shops build one or the other. Flip any of these — it is the same project both times.</p>
    ${PAIRS.map((p, i) => `
    <div class="flip" data-flip="${i}">
      <div class="flip-head"><h3>${nameFor(p)}</h3><span class="host">${hostFor(p)}</span>
        <div class="flipseg"><button data-side="front" aria-pressed="true">Front</button><button data-side="back" aria-pressed="false">Back</button></div>
      </div>
      <figure class="shotbox">
        <div class="bar"><i></i><i></i><i></i><em class="fhost">${p.named.host}</em></div>
        <img src="${p.front}" data-front="${p.front}" data-back="${p.back}" alt="">
        <figcaption><b class="fcapt">What they see</b><span class="fcap">${p.frontCap}</span></figcaption>
      </figure>
    </div>`).join('')}
    <div class="solo">
      <div><h3>${nameFor(SOLO)}</h3><div class="host">${hostFor(SOLO)}</div><p>${SOLO.cap}</p></div>
      ${shotbox(SOLO.front, SOLO.named.host, 'Website only', 'No system behind it.')}
    </div>
  </div>`;

const dirC = `
  <div class="pf">
    <p class="eyebrow">The proof</p>
    <h2 class="sec">The site your customers use, and the system behind it.</h2>
    <p class="sec-sub">Most shops build one or the other. Every project below is both.</p>
    ${PAIRS.map((p) => `
    <div class="ov">
      <div class="ov-head"><h3>${nameFor(p)}</h3><div class="host">${hostFor(p)}</div></div>
      <div class="ov-front"><img src="${p.front}" alt=""></div>
      <div class="ov-back"><img src="${p.back}" alt=""></div>
      <div class="ov-tag"><b>${p.badge}</b>${p.frontCap}, and ${p.backCap.toLowerCase()}.</div>
    </div>`).join('')}
    <div class="solo">
      <div><h3>${nameFor(SOLO)}</h3><div class="host">${hostFor(SOLO)}</div><p>${SOLO.cap}</p></div>
      ${shotbox(SOLO.front, SOLO.named.host, 'Website only', 'No system behind it.')}
    </div>
  </div>`;

const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kaymen.dev — the proof section, front and back</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* GENERATED by scripts/build-proof-options.js — do not hand-edit.
   styles.css below is verbatim; screenshots are base64-inlined so these client
   images are not sitting at a public URL before the consent asks go out. */
${read('styles.css')}
${CSS}
${CHROME}
</style>
</head>
<body>
<div class="mk"><div class="mk-in">
  <h1>The proof section <span>— front and back</span></h1>
  <div class="seg" id="dseg" role="group" aria-label="Direction">
    <button data-d="A" aria-pressed="true">A · Pairs</button>
    <button data-d="B" aria-pressed="false">B · Flip</button>
    <button data-d="C" aria-pressed="false">C · Overlap</button>
  </div>
  <div class="seg" id="cseg" role="group" aria-label="Consent">
    <button data-c="named" aria-pressed="true">Named</button>
    <button data-c="anon" aria-pressed="false">Anonymous</button>
  </div>
  <div class="sp"></div>
  <span class="warn" id="warn"></span>
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
  <div class="dir on" data-dir="A">${dirA}</div>
  <div class="dir" data-dir="B">${dirB}</div>
  <div class="dir" data-dir="C">${dirC}</div>
</div></div>

<script>
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* consent switch: three of the seven front ends are publish:false, so
   "anonymous" is what can actually ship today, not a hypothetical */
function setConsent(mode) {
  $$('.jsname, .jshost').forEach(function (el) { el.textContent = el.dataset[mode]; });
  $$('#cseg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.c === mode)); });
  document.getElementById('warn').textContent = mode === 'named'
    ? 'Named view needs 3 consents: BridgeMortgage, Horse & Harmony, Richmount'
    : 'This is what can ship today';
}
$$('#cseg button').forEach(function (b) { b.addEventListener('click', function () { setConsent(b.dataset.c); }); });

$$('#dseg button').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('#dseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    $$('.dir').forEach(function (d) { d.classList.toggle('on', d.dataset.dir === b.dataset.d); });
    $$('.note .pane').forEach(function (p) { p.classList.toggle('on', p.dataset.p === b.dataset.d); });
  });
});
$$('#wseg button').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('#wseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    document.getElementById('stage').className = 'stage ' + b.dataset.w;
  });
});

/* B: the flip */
$$('.flip').forEach(function (f) {
  var img = f.querySelector('img'), capT = f.querySelector('.fcapt'), cap = f.querySelector('.fcap'), host = f.querySelector('.fhost');
  var texts = { front: [img.dataset.front, 'What they see', cap.textContent, host.textContent],
                back: [img.dataset.back, 'What you run', 'The system behind it', 'the back office'] };
  f.querySelectorAll('.flipseg button').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = texts[b.dataset.side];
      img.style.opacity = 0;
      setTimeout(function () { img.src = t[0]; img.style.opacity = 1; }, 90);
      capT.textContent = t[1]; cap.textContent = t[2]; host.textContent = t[3];
      f.querySelectorAll('.flipseg button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    });
  });
});

setConsent('named');
</script>
</body>
</html>
`;

const out = path.join(ROOT, 'mockup', 'proof-options.html');
fs.writeFileSync(out, doc);
console.log('wrote mockup/proof-options.html  ' + Math.round(doc.length / 1024) + 'KB');
