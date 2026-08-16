/**
 * Four genuinely distinct homepage directions, in one self-contained file.
 *
 * WHY FOUR AND NOT ONE MORE ATTEMPT
 * The same lesson is recorded against three separate projects for this user:
 * when a design brief is ambiguous, options beat another single guess. The
 * TorahTracker redesign burned two rounds — one mockup rejected as "too much",
 * the next as "nearly identical to today's design" — before switching to
 * showing four distinct directions side by side, which is what settled it.
 * "Not in love with it / something that hasn't been done" is exactly that kind
 * of brief, so this is four directions, not a fifth revision of one.
 *
 * WHAT IS HELD CONSTANT
 * All four render from the same PLAIN content below, so what is being compared
 * is structure and feel — not copy. The language is deliberately non-technical
 * throughout: no stack names, no "row-level security", no "delta sync". A
 * business owner should recognise their own problem in the user's own words.
 *
 *   node scripts/build-directions.js
 */
const fs = require('fs');
const path = require('path');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

/* ===========================================================================
   SHARED CONTENT — plain English, no jargon, no client names.
   =========================================================================== */

const PLAIN = {
  promise: 'Software for businesses that have outgrown the way they work now.',

  // The user's own words for their problem — this is the entry point in three
  // of the four directions.
  problems: [
    {
      id: 'spreadsheets',
      say: 'We run the business on spreadsheets',
      then: 'and nobody is sure which copy is the real one',
      answer:
        'We replace the spreadsheets with one system everybody works in. Same information, one version of it, and a record of who changed what.',
      proof: 'A community loan fund with $1.58M on the books ran this way for four years.',
    },
    {
      id: 'disconnected',
      say: 'Two systems that don’t talk to each other',
      then: 'so someone re-types the same thing twice a day',
      answer:
        'We build the connection between them. Most shops decline this work because it is fiddly and unglamorous — it is most of what we do.',
      proof: 'Accounting, scheduling, payments, shipping, CRM — connected and kept in step.',
    },
    {
      id: 'numbers',
      say: 'Our numbers don’t add up',
      then: 'and no one can explain the difference',
      answer:
        'We find where the gap comes from and fix how the figure is worked out — which is usually a business decision, not a bug.',
      proof: 'One dashboard was overstating a fund by $47,383. It had been wrong for four years.',
    },
    {
      id: 'app',
      say: 'We need an app people can download',
      then: 'on both iPhone and Android',
      answer:
        'We build it, publish it to both stores, and keep it updated afterwards — which is the part that usually goes wrong.',
      proof: 'Apps of ours are live in the App Store and Google Play right now.',
    },
    {
      id: 'breaking',
      say: 'Something keeps breaking',
      then: 'and we only find out when a customer tells us',
      answer:
        'We make the system tell you first. Most bad failures are silent — the site looks fine and quietly stops working.',
      proof: 'A booking page once ran out of appointments for weeks while reporting itself healthy.',
    },
    {
      id: 'manual',
      say: 'Too much of this is done by hand',
      then: 'and it only works because one person remembers how',
      answer:
        'We automate the repetitive part and write down the rest, so the business stops depending on one person’s memory.',
      proof: 'Reports that took a morning now arrive by email before anyone is awake.',
    },
  ],

  // Every project in business terms. `before` / `after` drive direction C.
  work: [
    {
      sector: 'Education',
      title: 'Four locations, one system',
      before: 'Four branches, four separate systems, and the same person on file three times.',
      after: 'One system. Every branch sees only its own people, and head office sees all four.',
      since: 'Running since 2026',
      scale: '4 locations',
    },
    {
      sector: 'Community finance',
      title: 'A loan fund that finally balances',
      before: 'Spreadsheets, contracts in a shared drive, and a headline figure $47,383 out.',
      after: 'One ledger that reconciles to the bank, and 44 lenders who can see where they stand.',
      since: 'Running since 2026',
      scale: '$1.58M',
    },
    {
      sector: 'IT services',
      title: 'Where the billable hours went',
      before: 'Nobody could tell which engineers were logging time until the invoice was late.',
      after: 'A daily view per person. Missing hours show up the same day, not at month end.',
      since: 'Running since 2026',
      scale: 'Updated every 10 min',
    },
    {
      sector: 'Health & wellbeing',
      title: 'A booking page that fills itself',
      before: 'Every appointment came through a phone call or a WhatsApp message.',
      after: 'Customers book themselves, in two languages, and the owner just confirms.',
      since: 'Running since 2026',
      scale: '2 languages',
    },
    {
      sector: 'Consumer app',
      title: 'An app people actually keep',
      before: 'A website pretending to be an app — no reliable reminders, nothing offline.',
      after: 'A real app in both stores, with fixes that reach people’s phones the same week.',
      since: 'Live in the App Store & Google Play',
      scale: 'iOS + Android',
    },
    {
      sector: 'Property',
      title: 'The paperwork, done once',
      before: 'Clients emailed documents; someone re-keyed them into three different places.',
      after: 'Clients fill it in once. It arrives complete, checked, and where it needs to be.',
      since: 'Running since 2026',
      scale: '54 fields, once',
    },
  ],

  // Facts, each checkable. No adjectives.
  facts: [
    { n: '20+', l: 'systems running in production' },
    { n: '12', l: 'live platforms we host ourselves' },
    { n: '4', l: 'apps published to the app stores' },
    { n: '1', l: 'team, from first sketch to 3am callout' },
  ],

  steps: [
    ['We listen', 'You describe the problem in your words. We do not need you to know what to ask for.'],
    ['We show you', 'A working version early — not a document, not a slideshow.'],
    ['We build it', 'You see it change week by week and say when it is wrong.'],
    ['We keep it running', 'On machines we look after. When it breaks, we are the ones who get woken up.'],
  ],
};

/* ===========================================================================
   Shared page scaffold for each direction.
   =========================================================================== */

const FONTS = {
  a: 'family=Archivo:wght@400;500;600;700;800;900&family=Archivo+Narrow:wght@400;600',
  b: 'family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700',
  c: 'family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,700&family=Inter:wght@400;500;600',
  d: 'family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500;6..72,600&family=Inter:wght@400;500;600',
};

function doc(id, css, body, extraJs = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${FONTS[id]}&display=swap" rel="stylesheet">
<style>*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
img{max-width:100%}button{font:inherit;cursor:pointer}
${css}</style></head><body class="dir-${id}">${body}<script>${extraJs}<\/script></body></html>`;
}

/* ===========================================================================
   DIRECTION A — "The Switchboard"
   No nav bar. The first screen is the customer's problem in their own words,
   as physical switches. Picking one reassembles the page around that answer.
   The problem list IS the navigation.
   =========================================================================== */

function dirA() {
  const css = `
:root{--ink:#141310;--paper:#F4F2ED;--line:#DBD6CC;--hot:#FF4D17;--dim:#6E685D}
body{background:var(--paper);color:var(--ink);font-family:Archivo,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:0 40px}
.top{display:flex;justify-content:space-between;align-items:baseline;padding:34px 0 0}
.mark{font-weight:900;font-size:19px;letter-spacing:-.03em}
.mark i{font-style:normal;color:var(--hot)}
.top .aside{font-family:'Archivo Narrow';font-size:13px;color:var(--dim)}
.ask{padding:74px 0 26px}
.ask h1{font-size:clamp(38px,6.4vw,80px);font-weight:900;letter-spacing:-.05em;line-height:.94}
.ask p{margin-top:20px;font-size:19px;color:var(--dim);max-width:44ch;line-height:1.5}
/* the switch stack — this is the menu */
.switches{border-top:2px solid var(--ink);margin-top:44px}
.sw{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);
    padding:26px 0;display:grid;grid-template-columns:44px 1fr auto;gap:22px;align-items:baseline;
    transition:padding .16s ease,background .16s ease}
.sw:hover{background:#EDEAE3;padding-left:14px;padding-right:14px}
.sw .num{font-family:'Archivo Narrow';font-size:13px;color:var(--dim);letter-spacing:.1em}
.sw .say{font-size:clamp(21px,2.6vw,31px);font-weight:700;letter-spacing:-.03em;line-height:1.15}
.sw .then{display:block;font-size:15px;font-weight:400;color:var(--dim);margin-top:6px;letter-spacing:0}
.sw .go{width:34px;height:34px;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;
        color:var(--dim);transition:.16s;flex:none}
.sw:hover .go{background:var(--hot);border-color:var(--hot);color:#fff;transform:translateX(4px)}
.sw[aria-expanded=true]{background:var(--ink);color:var(--paper);padding-left:14px;padding-right:14px}
.sw[aria-expanded=true] .num,.sw[aria-expanded=true] .then{color:#9C958A}
.sw[aria-expanded=true] .go{background:var(--hot);border-color:var(--hot);color:#fff;transform:rotate(90deg)}
.answer{display:none;border-bottom:1px solid var(--line);background:#EDEAE3}
.answer.on{display:block}
.answer .inner{display:grid;grid-template-columns:44px 1fr;gap:22px;padding:30px 14px 34px}
.answer .body{max-width:62ch}
.answer .body p{font-size:19px;line-height:1.62}
.answer .proof{margin-top:18px;padding-left:16px;border-left:3px solid var(--hot);
               font-family:'Archivo Narrow';font-size:15px;color:var(--dim)}
.answer .cta{margin-top:24px;display:inline-block;background:var(--ink);color:var(--paper);
             text-decoration:none;padding:13px 22px;font-weight:600;font-size:15px}
.answer .cta:hover{background:var(--hot)}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--line);
       border:1px solid var(--line);margin:78px 0}
.fact{background:var(--paper);padding:26px 22px}
.fact b{display:block;font-size:38px;font-weight:900;letter-spacing:-.045em;line-height:1}
.fact span{display:block;margin-top:7px;font-size:13.5px;color:var(--dim);line-height:1.4}
.foot{border-top:2px solid var(--ink);padding:30px 0 60px;display:flex;justify-content:space-between;
      font-family:'Archivo Narrow';font-size:14px;color:var(--dim);flex-wrap:wrap;gap:14px}
@media(max-width:760px){.wrap{padding:0 22px}.facts{grid-template-columns:1fr 1fr}
 .sw{grid-template-columns:1fr auto;gap:14px}.sw .num{display:none}
 .answer .inner{grid-template-columns:1fr;padding:24px 14px 28px}}`;

  const body = `<div class="wrap">
  <div class="top"><div class="mark">kaymen<i>.</i>dev</div><div class="aside">Software, built and looked after</div></div>
  <section class="ask">
    <h1>What’s not<br>working?</h1>
    <p>${esc(PLAIN.promise)} Pick the one that sounds like you.</p>
  </section>
  <div class="switches">
    ${PLAIN.problems
      .map(
        (p, i) => `<button class="sw" aria-expanded="false" data-t="${esc(p.id)}">
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <span class="say">“${esc(p.say)}”<span class="then">${esc(p.then)}</span></span>
      <span class="go">→</span>
    </button>
    <div class="answer" id="a-${esc(p.id)}"><div class="inner"><div></div><div class="body">
      <p>${esc(p.answer)}</p>
      <div class="proof">${esc(p.proof)}</div>
      <a class="cta" href="#">Talk to us about this →</a>
    </div></div></div>`
      )
      .join('\n    ')}
  </div>
  <div class="facts">${PLAIN.facts.map((f) => `<div class="fact"><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`).join('')}</div>
  <div class="foot"><span>hello@kaymen.dev</span><span>Kaymen Group LLC</span></div>
</div>`;

  const js = `document.querySelectorAll('.sw').forEach(b=>b.addEventListener('click',()=>{
    const open=b.getAttribute('aria-expanded')==='true';
    document.querySelectorAll('.sw').forEach(x=>x.setAttribute('aria-expanded','false'));
    document.querySelectorAll('.answer').forEach(x=>x.classList.remove('on'));
    if(!open){b.setAttribute('aria-expanded','true');document.getElementById('a-'+b.dataset.t).classList.add('on');}
  }));`;
  return doc('a', css, body, js);
}

/* ===========================================================================
   DIRECTION B — "Proof of Work"
   The homepage is the fleet of systems actually running. The nav is a live
   status ribbon. The argument is volume of real operating software, which a
   shop with three case studies cannot fake.
   =========================================================================== */

function dirB() {
  const css = `
:root{--bg:#16171A;--panel:#1D1F23;--line:#2C2F35;--ink:#EDEDEF;--dim:#8A8F98;--live:#3DD68C;--amber:#F5B544}
body{background:var(--bg);color:var(--ink);font-family:'IBM Plex Sans',sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin:0 auto;padding:0 32px}
/* the ribbon replaces the nav bar */
.ribbon{position:sticky;top:0;z-index:5;background:#101114;border-bottom:1px solid var(--line)}
.ribbon .in{max-width:1240px;margin:0 auto;padding:0 32px;height:52px;display:flex;align-items:center;gap:26px}
.rb-mark{font-family:'IBM Plex Mono';font-weight:600;font-size:14px;letter-spacing:-.02em}
.rb-mark i{font-style:normal;color:var(--live)}
.rb-stat{display:flex;align-items:center;gap:8px;font-family:'IBM Plex Mono';font-size:12px;color:var(--dim)}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--live);box-shadow:0 0 0 0 rgba(61,214,140,.7);
       animation:p 2.4s infinite}
@keyframes p{0%{box-shadow:0 0 0 0 rgba(61,214,140,.55)}70%{box-shadow:0 0 0 7px rgba(61,214,140,0)}100%{box-shadow:0 0 0 0 rgba(61,214,140,0)}}
.rb-links{margin-left:auto;display:flex;gap:20px;font-size:13.5px}
.rb-links a{color:var(--dim);text-decoration:none}.rb-links a:hover{color:var(--ink)}
.hero{padding:78px 0 44px;border-bottom:1px solid var(--line)}
.hero h1{font-size:clamp(32px,4.6vw,56px);font-weight:700;letter-spacing:-.035em;line-height:1.06;max-width:17ch}
.hero p{margin-top:20px;font-size:18px;color:var(--dim);max-width:56ch;line-height:1.6}
.hero .row{margin-top:30px;display:flex;gap:12px;flex-wrap:wrap}
.btn{padding:12px 20px;border-radius:6px;text-decoration:none;font-size:14.5px;font-weight:600}
.btn.p{background:var(--live);color:#0B2018}
.btn.s{border:1px solid var(--line);color:var(--ink)}
/* the board */
.board-h{display:flex;justify-content:space-between;align-items:baseline;padding:38px 0 14px;flex-wrap:wrap;gap:10px}
.board-h h2{font-size:13px;font-family:'IBM Plex Mono';letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.board-h span{font-family:'IBM Plex Mono';font-size:12px;color:var(--dim)}
.board{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.sys{background:var(--panel);padding:22px;display:flex;flex-direction:column;gap:12px;min-height:186px;transition:background .15s}
.sys:hover{background:#24272C}
.sys .hd{display:flex;justify-content:space-between;align-items:center}
.sys .sec{font-family:'IBM Plex Mono';font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.sys .st{display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono';font-size:11px;color:var(--live)}
.sys h3{font-size:18px;font-weight:600;letter-spacing:-.02em;line-height:1.25}
.sys p{font-size:14px;color:var(--dim);line-height:1.55;flex:1}
.sys .ft{display:flex;justify-content:space-between;align-items:baseline;padding-top:12px;border-top:1px solid var(--line);
         font-family:'IBM Plex Mono';font-size:11.5px;color:var(--dim)}
.sys .ft b{color:var(--amber);font-weight:500}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin:52px 0}
.fact{background:var(--panel);padding:22px}
.fact b{display:block;font-family:'IBM Plex Mono';font-size:30px;font-weight:500;letter-spacing:-.03em}
.fact span{display:block;margin-top:6px;font-size:13px;color:var(--dim);line-height:1.4}
.foot{border-top:1px solid var(--line);padding:26px 0 56px;display:flex;justify-content:space-between;
      font-family:'IBM Plex Mono';font-size:12px;color:var(--dim);flex-wrap:wrap;gap:12px}
@media(max-width:960px){.board{grid-template-columns:1fr 1fr}}
@media(max-width:680px){.wrap,.ribbon .in{padding:0 18px}.board,.facts{grid-template-columns:1fr}
 .rb-stat.hide-s{display:none}}`;

  const body = `<div class="ribbon"><div class="in">
    <span class="rb-mark">kaymen<i>.</i>dev</span>
    <span class="rb-stat"><span class="pulse"></span>12 systems live</span>
    <span class="rb-stat hide-s">last release 4h ago</span>
    <span class="rb-links"><a href="#">The work</a><a href="#">How we work</a><a href="#">Talk to us</a></span>
  </div></div>
  <div class="wrap">
    <section class="hero">
      <h1>These are running right now.</h1>
      <p>${esc(PLAIN.promise)} Not case studies from three years ago — systems in daily use, on machines we look after ourselves.</p>
      <div class="row"><a class="btn p" href="#">Tell us what you need</a><a class="btn s" href="#">See how we work</a></div>
    </section>
    <div class="board-h"><h2>Currently in service</h2><span>updated continuously</span></div>
    <div class="board">
      ${PLAIN.work
        .map(
          (w) => `<div class="sys">
        <div class="hd"><span class="sec">${esc(w.sector)}</span><span class="st"><span class="pulse"></span>live</span></div>
        <h3>${esc(w.title)}</h3>
        <p>${esc(w.after)}</p>
        <div class="ft"><span>${esc(w.since)}</span><b>${esc(w.scale)}</b></div>
      </div>`
        )
        .join('\n      ')}
    </div>
    <div class="facts">${PLAIN.facts.map((f) => `<div class="fact"><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`).join('')}</div>
    <div class="foot"><span>hello@kaymen.dev</span><span>Kaymen Group LLC</span></div>
  </div>`;
  return doc('b', css, body);
}

/* ===========================================================================
   DIRECTION C — "Before / After"
   One repeated unit: drag from the mess to the system. The format makes jargon
   impossible. Navigation is a progress rail, not a menu.
   =========================================================================== */

function dirC() {
  const css = `
:root{--paper:#FAF8F5;--ink:#191712;--dim:#7C766B;--line:#E4DFD6;--before:#C2554A;--after:#1F7A5C}
body{background:var(--paper);color:var(--ink);font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
.rail{position:fixed;left:26px;top:50%;transform:translateY(-50%);z-index:5;display:flex;flex-direction:column;gap:12px}
.rail a{width:9px;height:9px;border-radius:50%;background:var(--line);display:block;transition:.2s}
.rail a.on{background:var(--ink);transform:scale(1.45)}
.wrap{max-width:960px;margin:0 auto;padding:0 32px}
.top{display:flex;justify-content:space-between;align-items:baseline;padding:32px 0}
.mark{font-family:Fraunces;font-weight:700;font-size:21px;letter-spacing:-.02em}
.top a{font-size:14px;color:var(--dim);text-decoration:none}
.hero{padding:70px 0 34px;text-align:center}
.hero h1{font-family:Fraunces;font-weight:300;font-size:clamp(36px,6vw,68px);letter-spacing:-.03em;line-height:1.06}
.hero h1 em{font-style:italic;font-weight:500}
.hero p{margin:22px auto 0;font-size:18px;color:var(--dim);max-width:50ch;line-height:1.6}
.hint{margin-top:34px;font-size:13px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
.ba{margin:56px 0 0;padding-bottom:56px;border-bottom:1px solid var(--line)}
.ba .sec{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:14px}
/* The stage wipes a PICTURE, never text: half-revealed prose from two layers
   reads as garbled nonsense. The sentence lives below and swaps at the middle. */
.stage{position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);
       height:230px;display:grid}
.side{grid-area:1/1;padding:26px 30px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
.side .tag{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:600}
.side.b{background:#FDF6F5}.side.b .tag{color:var(--before)}
.side.a{background:#F1F8F4;clip-path:inset(0 0 0 var(--split,50%))}
.side.a .tag{color:var(--after)}
/* mess: overlapping, tilted, uneven */
.heap{position:relative;flex:1}
.chit{position:absolute;background:#fff;border:1px solid #D9AFA8;border-radius:4px;height:30px;
      box-shadow:0 3px 10px rgba(120,60,50,.13)}
.chit::before{content:'';position:absolute;left:10px;top:11px;height:8px;width:54%;border-radius:2px;background:#DCB4AD}
.chit.warn{border-color:var(--before);border-width:1.5px}
.chit.warn::after{content:'!';position:absolute;right:10px;top:5px;color:var(--before);font-weight:700;font-size:14px}
/* order: aligned, even, ticked */
.stack{flex:1;display:flex;flex-direction:column;gap:7px;padding-top:2px}
.line{height:26px;background:#fff;border:1px solid #CFE6DA;border-radius:5px;position:relative}
.line::before{content:'';position:absolute;left:9px;top:9px;height:7px;width:46%;border-radius:2px;background:#D3E8DC}
.line::after{content:'✓';position:absolute;right:10px;top:3px;color:var(--after);font-size:13px}
.handle{position:absolute;top:0;bottom:0;left:var(--split,50%);width:2px;background:var(--ink);cursor:ew-resize;z-index:3}
.handle::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:40px;height:40px;border-radius:50%;background:var(--ink);
  background-image:linear-gradient(90deg,transparent 46%,#FAF8F5 46%,#FAF8F5 54%,transparent 54%)}
.range{position:absolute;inset:0;width:100%;opacity:0;cursor:ew-resize;z-index:4;margin:0}
.say{margin-top:20px;display:flex;gap:16px;align-items:flex-start}
.say .who{flex:none;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;
          padding-top:9px;width:62px}
.say.is-b .who{color:var(--before)}.say.is-a .who{color:var(--after)}
.say p{font-family:Fraunces;font-size:clamp(19px,2.5vw,27px);font-weight:300;line-height:1.34;
       letter-spacing:-.02em;transition:opacity .18s}
.facts{display:flex;flex-wrap:wrap;gap:44px;justify-content:center;padding:64px 0}
.fact b{display:block;font-family:Fraunces;font-size:40px;font-weight:300;letter-spacing:-.03em;text-align:center}
.fact span{display:block;margin-top:5px;font-size:13px;color:var(--dim);text-align:center;max-width:16ch}
.cta{text-align:center;padding:20px 0 80px}
.cta a{display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;
       padding:15px 30px;border-radius:100px;font-size:15px;font-weight:500}
@media(max-width:760px){.rail{display:none}.wrap{padding:0 20px}.side{padding:28px 24px}
 .facts{gap:28px}}`;

  const body = `<div class="rail">${PLAIN.work.map((_, i) => `<a href="#ba${i}" class="${i === 0 ? 'on' : ''}"></a>`).join('')}</div>
<div class="wrap">
  <div class="top"><span class="mark">kaymen.dev</span><a href="#">hello@kaymen.dev</a></div>
  <section class="hero">
    <h1>Before, it was a mess.<br><em>After, it just works.</em></h1>
    <p>${esc(PLAIN.promise)}</p>
    <div class="hint">↔ drag any picture below</div>
  </section>
  ${PLAIN.work
    .map(
      (w, i) => {
        // Deterministic scatter so the "mess" differs per card but never re-rolls.
        const chits = Array.from({ length: 7 }, (_, k) => {
          const t = ((i * 37 + k * 53) % 60) + 4;
          const l = ((i * 29 + k * 41) % 52) + 2;
          const wd = ((i * 13 + k * 17) % 26) + 42;
          const r = (((i * 7 + k * 11) % 13) - 6) * 0.9;
          return `<span class="chit${k % 3 === 0 ? ' warn' : ''}" style="top:${t}%;left:${l}%;width:${wd}%;transform:rotate(${r}deg)"></span>`;
        }).join('');
        const lines = Array.from({ length: 5 }, () => '<span class="line"></span>').join('');
        return `<section class="ba" id="ba${i}">
    <div class="sec">${esc(w.sector)} — ${esc(w.title)}</div>
    <div class="stage">
      <div class="side b"><span class="tag">Before</span><div class="heap">${chits}</div></div>
      <div class="side a"><span class="tag">After</span><div class="stack">${lines}</div></div>
      <div class="handle"></div>
      <input class="range" type="range" min="0" max="100" value="50" aria-label="Drag between before and after">
    </div>
    <div class="say is-b" data-before="${esc(w.before)}" data-after="${esc(w.after)}">
      <span class="who">Before</span><p>${esc(w.before)}</p>
    </div>
  </section>`;
      }
    )
    .join('\n  ')}
  <div class="facts">${PLAIN.facts.map((f) => `<div class="fact"><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`).join('')}</div>
  <div class="cta"><a href="#">Tell us what’s not working →</a></div>
</div>`;

  const js = `document.querySelectorAll('.ba').forEach(ba=>{
    const st=ba.querySelector('.stage'), r=st.querySelector('.range'),
          say=ba.querySelector('.say'), p=say.querySelector('p'), who=say.querySelector('.who');
    const set=v=>{
      st.querySelector('.side.a').style.clipPath='inset(0 0 0 '+v+'%)';
      st.querySelector('.handle').style.left=v+'%';
      // Caption swaps at the midpoint rather than being wiped — half a wiped
      // sentence is unreadable, which is exactly what a text wipe produces.
      const isAfter=v>=50, txt=isAfter?say.dataset.after:say.dataset.before;
      if(p.textContent!==txt){p.textContent=txt;who.textContent=isAfter?'After':'Before';
        say.classList.toggle('is-a',isAfter);say.classList.toggle('is-b',!isAfter);}
    };
    r.addEventListener('input',()=>set(+r.value)); set(50);
  });
  const dots=[...document.querySelectorAll('.rail a')];
  const secs=[...document.querySelectorAll('.ba')];
  new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){
    const i=secs.indexOf(e.target);dots.forEach((d,j)=>d.classList.toggle('on',i===j));}}),
    {threshold:.5}).observe&&secs.forEach(s=>new IntersectionObserver(es=>es.forEach(e=>{
      if(e.isIntersecting){const i=secs.indexOf(e.target);dots.forEach((d,j)=>d.classList.toggle('on',i===j));}
    }),{threshold:.5}).observe(s));`;
  return doc('c', css, body, js);
}

/* ===========================================================================
   DIRECTION D — "The Proposal"
   Looks like a beautifully set one-page proposal rather than a SaaS landing
   page. Anti-tech on purpose: paper, serif, no gradients, no dark mode. The
   nav is a document contents rail that tracks where you are.
   =========================================================================== */

function dirD() {
  const css = `
:root{--paper:#FCFBF7;--ink:#1B1A17;--dim:#6F6A60;--line:#E6E1D6;--accent:#0F5C4A}
body{background:var(--paper);color:var(--ink);font-family:Newsreader,Georgia,serif;-webkit-font-smoothing:antialiased}
.sheet{max-width:1120px;margin:0 auto;padding:0 40px;display:grid;grid-template-columns:210px 1fr;gap:56px}
/* contents rail instead of a nav bar */
.toc{position:sticky;top:0;align-self:start;height:100vh;padding:40px 0;display:flex;flex-direction:column}
.toc .mark{font-size:19px;font-weight:600;letter-spacing:-.01em;margin-bottom:34px}
.toc ol{list-style:none;counter-reset:s;display:flex;flex-direction:column;gap:3px}
.toc li{counter-increment:s}
.toc a{display:flex;gap:10px;padding:7px 0;font-family:Inter;font-size:12.5px;color:var(--dim);
       text-decoration:none;border-top:1px solid var(--line);transition:.15s}
.toc a::before{content:counter(s,decimal-leading-zero);color:#B9B2A4;font-size:11px;padding-top:1px}
.toc a:hover,.toc a.on{color:var(--ink)}
.toc a.on::before{color:var(--accent)}
.toc .sig{margin-top:auto;font-family:Inter;font-size:11.5px;color:var(--dim);line-height:1.6}
.doc{padding:40px 0 90px;max-width:66ch}
.doc .kicker{font-family:Inter;font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);
             padding-bottom:22px}
.doc h1{font-size:clamp(34px,4.6vw,55px);font-weight:400;letter-spacing:-.022em;line-height:1.1}
.doc .lede{margin-top:22px;font-size:21px;line-height:1.62;color:#3A3730}
.doc section{padding-top:58px}
.doc h2{font-family:Inter;font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);
        padding-bottom:16px;border-bottom:1px solid var(--line);margin-bottom:22px}
.doc p{font-size:18.5px;line-height:1.72;margin-bottom:16px}
.doc .q{font-size:20px;line-height:1.6;padding-left:20px;border-left:2px solid var(--accent);margin:22px 0}
.rows{display:flex;flex-direction:column}
.row{display:grid;grid-template-columns:1fr auto;gap:26px;align-items:baseline;
     padding:17px 0;border-bottom:1px solid var(--line)}
.row .t{font-size:18.5px}
.row .t small{display:block;font-family:Inter;font-size:12.5px;color:var(--dim);margin-top:4px;line-height:1.5}
.row .v{font-family:Inter;font-size:12px;color:var(--dim);white-space:nowrap}
.steps{counter-reset:n;display:flex;flex-direction:column;gap:2px}
.step{counter-increment:n;display:grid;grid-template-columns:34px 1fr;gap:16px;padding:16px 0;
      border-bottom:1px solid var(--line)}
.step::before{content:counter(n,decimal-leading-zero);font-family:Inter;font-size:11.5px;color:var(--accent);padding-top:5px}
.step b{display:block;font-size:18.5px;font-weight:500;margin-bottom:4px}
.step span{font-family:Inter;font-size:14px;color:var(--dim);line-height:1.6}
.numbers{display:grid;grid-template-columns:repeat(2,1fr);gap:26px}
.num b{display:block;font-size:38px;font-weight:400;letter-spacing:-.03em}
.num span{font-family:Inter;font-size:13px;color:var(--dim)}
.sign{margin-top:56px;padding-top:26px;border-top:2px solid var(--ink)}
.sign a{font-family:Inter;font-size:14px;font-weight:600;color:var(--ink);text-decoration:none;
        border-bottom:2px solid var(--accent);padding-bottom:2px}
@media(max-width:900px){.sheet{grid-template-columns:1fr;gap:0;padding:0 24px}
 .toc{position:static;height:auto;padding:28px 0 0}.toc ol{display:none}.toc .sig{display:none}
 .doc{padding-top:14px}}`;

  const sections = [
    ['what', 'What this is'],
    ['problem', 'The problems we take on'],
    ['work', 'What we have built'],
    ['how', 'How it goes'],
    ['facts', 'By the numbers'],
  ];

  const body = `<div class="sheet">
  <nav class="toc">
    <div class="mark">kaymen.dev</div>
    <ol>${sections.map((s) => `<li><a href="#${s[0]}">${esc(s[1])}</a></li>`).join('')}</ol>
    <div class="sig">Kaymen Group LLC<br>hello@kaymen.dev</div>
  </nav>
  <article class="doc">
    <div class="kicker">A short note on what we do</div>
    <h1>We build the system your business has outgrown.</h1>
    <p class="lede">Most of our work starts the same way: something that used to be fine — a spreadsheet, a shared inbox, a folder of documents — stopped being fine, and everybody has quietly built habits around the gap.</p>

    <section id="what"><h2>What this is</h2>
      <p>We are a small practice that designs, builds and then runs business software. The same people do all three, which matters more than it sounds: there is nobody to hand your problem to, and nobody to blame when it breaks.</p>
      <p class="q">You do not need to know what to ask for. Describing what is annoying you is enough to start.</p>
    </section>

    <section id="problem"><h2>The problems we take on</h2>
      <div class="rows">${PLAIN.problems
        .map((p) => `<div class="row"><span class="t">“${esc(p.say)}”<small>${esc(p.then)}</small></span></div>`)
        .join('')}</div>
    </section>

    <section id="work"><h2>What we have built</h2>
      <div class="rows">${PLAIN.work
        .map(
          (w) => `<div class="row"><span class="t">${esc(w.title)}<small>${esc(w.after)}</small></span><span class="v">${esc(w.sector)}</span></div>`
        )
        .join('')}</div>
    </section>

    <section id="how"><h2>How it goes</h2>
      <div class="steps">${PLAIN.steps
        .map((s) => `<div class="step"><div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div></div>`)
        .join('')}</div>
    </section>

    <section id="facts"><h2>By the numbers</h2>
      <div class="numbers">${PLAIN.facts.map((f) => `<div class="num"><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`).join('')}</div>
    </section>

    <div class="sign"><a href="#">Tell us what is not working →</a></div>
  </article>
</div>`;

  const js = `const ls=[...document.querySelectorAll('.toc a')];
  document.querySelectorAll('.doc section').forEach(s=>new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting)ls.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id));
  }),{threshold:.35,rootMargin:'-10% 0px -60% 0px'}).observe(s));`;
  return doc('d', css, body, js);
}

/* ===========================================================================
   Shell
   =========================================================================== */

const DIRECTIONS = [
  {
    id: 'a',
    name: 'A — Switchboard',
    idea: 'No menu bar at all. The first screen is your problem in your own words, as a row of switches; picking one opens the answer in place. The problem list IS the navigation.',
    why: 'Every agency site leads with what they do. This one leads with what is wrong with you — so a non-technical visitor recognises themselves in the first two seconds.',
    html: dirA(),
  },
  {
    id: 'b',
    name: 'B — Proof of Work',
    idea: 'The homepage is the fleet of systems actually running, on a board. The nav is replaced by a live status ribbon.',
    why: 'The argument is made by volume of real, operating software — something a competitor with three case studies cannot fake. Risk: it is the most "technical-feeling" of the four.',
    html: dirB(),
  },
  {
    id: 'c',
    name: 'C — Before / After',
    idea: 'One repeated unit: drag the handle from the mess to the system. Navigation is a progress rail on the left, not a menu.',
    why: 'The format makes jargon impossible — you cannot say "row-level security" in a before/after. Lowest reading effort of the four; a visitor understands the offer without reading a paragraph.',
    html: dirC(),
  },
  {
    id: 'd',
    name: 'D — The Proposal',
    idea: 'Looks like a beautifully typeset one-page proposal, not a landing page. The nav is a document contents rail that tracks where you are.',
    why: 'Deliberately anti-tech: paper, serif, no gradients, no dark mode. Reads like an architecture or law practice rather than a SaaS startup, which is genuinely rare in this market.',
    html: dirD(),
  },
];

const escClose = (s) => s.replace(/<\/script>/gi, '<\\/script>');
const payload = escClose(JSON.stringify(DIRECTIONS));

const shell = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>kaymen.dev — four directions</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:#0B0B0D;color:#F2F2F4;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;
     display:flex;flex-direction:column;overflow:hidden}
header{background:#141417;border-bottom:1px solid #2A2A30;flex:none}
.r{display:flex;align-items:center;gap:12px;padding:10px 16px;flex-wrap:wrap}
.r+.r{border-top:1px solid #2A2A30}
.brand{font-family:ui-monospace,monospace;font-size:13px;color:#8A8A94;white-space:nowrap}
.brand b{color:#5B8CFF;font-weight:400}
.tag{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#FFC93C;border:1px solid #FFC93C44;
     background:#FFC93C14;padding:3px 8px;border-radius:100px;white-space:nowrap}
button{font:inherit;cursor:pointer;border-radius:7px;border:1px solid #2A2A30;background:#1D1D22;color:#9A9AA4;
       padding:7px 13px;transition:.15s;white-space:nowrap}
button:hover{color:#fff;border-color:#3F3F48}
button[aria-current=true]{background:#5B8CFF;border-color:#5B8CFF;color:#fff}
.spacer{flex:1}
.seg{display:flex;border:1px solid #2A2A30;border-radius:7px;overflow:hidden}
.seg button{border:0;border-radius:0;padding:7px 12px}
.seg button+button{border-left:1px solid #2A2A30}
.note{padding:9px 16px;background:#101014;border-top:1px solid #2A2A30;font-size:12.5px;color:#9A9AA4;line-height:1.5}
.note b{color:#F2F2F4;font-weight:600}
.note .why{color:#7C7C86;display:block;margin-top:3px}
main{flex:1;min-height:0;display:flex;justify-content:center;background:#0B0B0D;padding:12px;overflow:auto}
.frame{background:#fff;border:1px solid #2A2A30;border-radius:10px;overflow:hidden;width:100%;height:100%;
       transition:max-width .2s;box-shadow:0 20px 60px -20px #000}
iframe{width:100%;height:100%;border:0;display:block}
@media(max-width:720px){.hide-s{display:none}}
</style></head><body>
<header>
  <div class="r">
    <span class="brand">kaymen<b>.</b>dev</span>
    <span class="tag">Four directions — pick one</span>
    <span class="spacer"></span>
    <div class="seg" id="w">
      <button data-w="100%" aria-current="true">Desktop</button>
      <button data-w="834px">Tablet</button>
      <button data-w="414px">Phone</button>
    </div>
  </div>
  <div class="r" id="nav"></div>
  <div class="note" id="note"></div>
</header>
<main><div class="frame" id="frame"><iframe id="v" title="Direction preview"></iframe></div></main>
<script>
const D=${payload};
const nav=document.getElementById('nav'),v=document.getElementById('v'),
      note=document.getElementById('note'),frame=document.getElementById('frame');
D.forEach(d=>{const b=document.createElement('button');b.textContent=d.name;b.dataset.id=d.id;
  b.onclick=()=>show(d.id);nav.appendChild(b);});
function show(id){const d=D.find(x=>x.id===id);
  nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===id)));
  note.innerHTML='<b>'+d.idea+'</b><span class="why">'+d.why+'</span>';
  v.srcdoc=d.html;}
document.getElementById('w').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  frame.style.maxWidth=b.dataset.w;
  [...e.currentTarget.children].forEach(x=>x.setAttribute('aria-current',String(x===b)));};
show('a');
<\/script></body></html>`;

const out = path.join(__dirname, '..', 'mockup', 'directions.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, shell);
console.log(`${DIRECTIONS.length} directions -> ${out}  (${(Buffer.byteLength(shell) / 1024).toFixed(0)}kB)`);
DIRECTIONS.forEach((d) => console.log(`   ${d.id}  ${d.name}`));
