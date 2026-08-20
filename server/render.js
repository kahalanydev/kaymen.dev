/* ============================================================================
   Server-side rendering for the marketing site.

   Everything here renders from content/projects.js at request time. No build
   step, no client-side hydration — a crawler and a social-card scraper get the
   same fully-formed HTML a browser does, which is the whole point of doing the
   case studies server-side rather than as a JS-rendered SPA route.

   Markup ported to the "Quiet" design 2026-08-15 (mockup/v3-quiet.html). The
   data going in did not change; only the HTML around it did.
   ============================================================================ */

/* EVIDENCE is deliberately not imported any more: the stats band is generated
   from measured sources in content/stats.js rather than asserted in the content
   layer. EVIDENCE stays exported from projects.js as the editorial fallback. */
const {
  PRACTICE_AREAS,
  CASE_STUDIES,
  MORE_WORK,
  bySlug,
  areaById,
  clientName,
  mayLink,
  FRONT_ENDS: PROJECT_FRONTS,
} = require('../content/projects');
const { demoFor } = require('../content/demos');
const STATS = require('../content/stats');
const PRICING = require('../content/pricing');
const LEGAL = require('../content/legal');

const SITE = 'https://kaymen.dev';

/* --- escaping -------------------------------------------------------------- */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

/**
 * Minimal inline markup for prose written in content/projects.js.
 * Escapes first, then re-introduces only **bold** and `code`. Deliberately
 * tiny — content is authored by us, but escaping first means a stray angle
 * bracket in a case study can never become markup.
 */
function prose(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/* --- shared chrome ---------------------------------------------------------

   The rail is duplicated between index.html (static template) and here, the
   same way the old top nav was: index.html is served through a placeholder
   substitution rather than through layout(), so there is no single template
   both can share without introducing one. Keep the two in step.
   -------------------------------------------------------------------------- */

const RAIL_ITEMS = [
  { sec: 'start', label: 'Start', icon: '<path d="M3 10.5 12 3l9 7.5V21H3z"/>' },
  {
    /* #need and #price merged into one section on 2026-08-16, so this is one
       item pointing at #price. It kept the question-mark icon rather than the
       dollar sign because the section leads with "what do you need" and only
       then answers with a number. index.html carries the same single item;
       these two lists have to be changed together or the sub-pages get a rail
       the homepage does not have — which is exactly what happened here: this
       file kept a dead /#need link and a second /#price entry for a day. */
    sec: 'price',
    label: 'What you need',
    icon: '<path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2v.4"/><circle cx="12" cy="17.5" r=".8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9.2"/>',
  },
  /* "Still running" until 2026-08-16. "Still" presupposes that software stopping
     is the normal outcome, so it read as relief rather than confidence — and it
     promised a track record the board underneath cannot show, because every row
     on it says LIVE SINCE 2026. "What we run" is present tense, needs no
     duration to be true, and answers the abandonment fear in #terms positively:
     this is our standing job, not a thing that happens to have survived. Mirrors
     "What you need" above it. index.html carries the same item — change both. */
  { sec: 'running', label: 'What we run', icon: '<path d="M3 12h4l2.5-6 4 13L16 12h5"/>' },
  {
    sec: 'work',
    label: 'The work',
    icon: '<rect x="2.5" y="6.5" width="19" height="13.5" rx="2.2"/><path d="M8.5 6.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/>',
  },
  {
    sec: 'terms',
    label: 'No hostages',
    icon: '<path d="M12 2.8 4.5 6v6c0 4.6 3.1 8 7.5 9.2 4.4-1.2 7.5-4.6 7.5-9.2V6z"/><path d="M9.2 12.2l2 2 3.6-3.9"/>',
  },
  {
    sec: 'talk',
    label: 'Talk to us',
    icon: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.2 9.2 0 0 1-3.9-.9L3 20.5l1.6-4.8A8.3 8.3 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.9-8.4 8.4 8.4 0 0 1 8.5 8.4z"/>',
  },
];

/* Same order as the page, which is the only order a nav is allowed to be in.
   #price moved to second when it absorbed #need, and this list was left saying
   fourth, so the mobile bar walked start → running → work → price while the
   page ran start → price → running → work. */
const TAB_SECS = ['start', 'price', 'running', 'work', 'talk'];
const TAB_LABELS = { start: 'Start', price: 'Pricing', running: 'Running', work: 'Work', talk: 'Talk' };

/* The bar borrows the rail's icon by default, which breaks for #price: the rail
   says "What you need" and carries a question mark, the bar says "Pricing" and
   a question mark beside that word reads as a help link. So the bar keeps the
   dollar sign, which is also what index.html hardcodes — without this override
   the homepage showed $ and every sub-page showed ?. */
const TAB_ICONS = {
  price: '<path d="M12 2.5v19M16.8 6.3H9.9a3.1 3.1 0 0 0 0 6.2h4.2a3.1 3.1 0 0 1 0 6.2H6.7"/>',
};

const icon = (svg) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${svg}</svg>`;

/**
 * The floating glass rail. On sub-pages every target lives back on the
 * homepage, so links are absolute (`/#work`) rather than bare fragments, and
 * `active` marks which item the lozenge parks on at load.
 */
function rail(active = 'work') {
  return `
<div class="ambient" aria-hidden="true"><i class="g1"></i><i class="g2"></i><i class="g3"></i></div>

<nav class="rail left" id="rail" aria-label="Sections">
  <div class="rail-prog" aria-hidden="true"><i id="prog"></i></div>

  <a href="/#start" class="rail-brand" aria-label="kaymen.dev home"></a>

  <div class="rail-nav" id="railNav">
    <span class="lozenge" id="lozenge"></span>
    ${RAIL_ITEMS.map(
      (i) => `<a href="/#${i.sec}" class="rail-link${i.sec === active ? ' on' : ''}" data-sec="${i.sec}" data-track="nav-${i.sec}">
      ${icon(i.icon)}<span>${esc(i.label)}</span>
    </a>`
    ).join('\n    ')}
  </div>

  <!-- Outside .rail-nav on purpose: it is the one rail item that leaves the
       page, and the lozenge tracks .rail-nav's children. index.html carries the
       same markup for the homepage — change both or they disagree. -->
  <a href="/portal" class="rail-login" data-track="nav-portal">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3H18a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 18 21h-3.5"/><path d="M9.5 16.5 14 12 9.5 7.5"/><path d="M14 12H3.5"/></svg><span>Client login</span>
  </a>

  <div class="rail-foot">
    <span class="pulse"></span><em>${STATS.LIVE.running} systems live now</em>
  </div>
</nav>

<a href="/#start" class="brandbar" aria-label="kaymen.dev home"></a>

<nav class="tabbar" id="tabbar" aria-label="Sections">
  ${TAB_SECS.map((sec) => {
    const item = RAIL_ITEMS.find((i) => i.sec === sec);
    return `<a href="/#${sec}" class="tab${sec === active ? ' on' : ''}" data-sec="${sec}">
    ${icon(TAB_ICONS[sec] || item.icon)}<em>${esc(TAB_LABELS[sec])}</em>
  </a>`;
  }).join('\n  ')}
</nav>`;
}

function footer() {
  return `
  <footer>
    <div class="wrap foot">
      <span class="fm"><b>kaymen</b><span>.</span>dev</span>
      <nav>
        <a href="/work">Work</a>
        <a href="/#price">Pricing</a>
        <a href="/#terms">No hostages</a>
        <a href="/#talk">Contact</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms-of-use">Terms</a>
        <!-- Under 900px the rail is hidden and the tabbar is full at five slots,
             so this is the only place a returning client can find the portal on
             a phone. Do not drop it from the footer without giving it a home. -->
        <a href="/portal">Client login</a>
      </nav>
      <span>&copy; 2026 Kaymen Group LLC</span>
    </div>
  </footer>`;
}

/** Shared CTA band closing every sub-page. */
function ctaBand(heading, sub) {
  return `
  <section class="cta-band">
    <div class="wrap">
      <div class="cta-band-inner rv">
        <h2>${esc(heading)}</h2>
        <p>${esc(sub)}</p>
        <div class="cta-band-actions">
          <a href="/#talk" class="btn btn-light" data-track="cta-band-contact">Start a conversation</a>
          <a href="/work" class="btn btn-outline" data-track="cta-band-work">See more work</a>
        </div>
      </div>
    </div>
  </section>`;
}

/* --- page shell ------------------------------------------------------------ */

function layout({ title, description, path, ogImage, ogType = 'article', body, demos = false, active = 'work' }) {
  const url = SITE + path;
  const img = ogImage ? SITE + ogImage : `${SITE}/assets/og/default.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(url)}">
    <meta property="og:type" content="${esc(ogType)}">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:site_name" content="kaymen.dev">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${esc(img)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(img)}">
    <meta name="theme-color" content="#ffffff">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <!-- Reveal-on-scroll needs a no-JS escape hatch. .rv is opacity:0 until
         script.js adds .in, so with scripting off the ENTIRE page body renders
         blank — verified 2026-08-20, only the rail survived. That undoes the
         point of server-rendering the price ladder: a consumer that applies CSS
         but does not run JS (several AI crawlers, some link previewers, anyone
         with JS disabled) gets a fully-formed document it then paints invisible.
         <noscript> rather than @media (scripting: none) because it works in
         every engine, not just recent ones. server/render.js layout() carries
         the same block for the sub-pages — change both. -->
    <noscript><style>.rv{opacity:1;transform:none}</style></noscript>
${demos ? '    <link rel="stylesheet" href="/assets/demos.css">\n' : ''}    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
${rail(active)}
<main class="page">
${body}
${footer()}
</main>
    <script src="/script.js"></script>
${demos ? '    <script src="/assets/demos.js"></script>\n' : ''}    <script src="/tracker.js" defer></script>
</body>
</html>`;
}

/* --- homepage fragments ----------------------------------------------------

   These two sections replace the <!--{{WORK}}--> placeholder in index.html:
   the running board (#running) and the case studies (#work). Everything else
   on the homepage — hero, routing question, pricing, terms, contact — is
   static and lives in index.html.
   -------------------------------------------------------------------------- */

/* --- the fleet panel -------------------------------------------------------

   The hero graphic. Every bar is a measured value out of content/stats.js
   (generated by scripts/refresh-stats.js from each project's git history) —
   this used to be a hand-typed placeholder array in script.js, which is the
   one thing HANDOFF-REDESIGN-2026-08-15.md §5 said must not ship.

   Rendered server-side rather than drawn in JS so the numbers are in the HTML
   a crawler sees, and so there is no way to render a chart the data does not
   support.
   -------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   The cost block on a case study.

   It quotes the SAME ladder the pricing page does, by asking content/pricing.js
   for the tier and add-ons the case study is tagged with. That is the whole
   point: a case study that priced itself independently would drift from /#price
   within a month, and a site that disagrees with itself about money is worse
   than one that says nothing.

   The days are real and generated (content/stats.js, from git history). The
   comparison is a RANGE, because a day carrying a commit is not a timesheet and
   nobody knows whether an agency bills six hours or eight. A range says so; a
   single figure would fake a precision we do not have.

   Renders nothing for a project with no `pricing` field, which is how our own
   internal tooling stays out of it.
   --------------------------------------------------------------------------- */
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

function caseCost(s) {
  if (!s.pricing) return '';
  const q = PRICING.quote(s.pricing.tier, s.pricing.addons);
  if (!q) return '';

  const fleet = STATS.FLEET.find((f) => f.slug === s.slug);
  const days = fleet ? fleet.days.reduce((a, b) => a + b, 0) : 0;
  if (!days) return '';

  const [lo, hi] = PRICING.COMPARE.hoursPerDay;
  const cmpLo = days * lo * PRICING.COMPARE.hourly;
  const cmpHi = days * hi * PRICING.COMPARE.hourly;

  const ours = q.partnership
    ? `<b>No build fee</b><span>then ${money(PRICING.PARTNER.monthly)}/month on a ${PRICING.PARTNER.months}-month partnership</span>`
    : `<b>From ${money(q.build)}</b><span>to build, then ${money(q.monthly)}/month</span>`;

  return `
      <section class="case-cost">
        <h2>What something like this costs</h2>
        <p class="cc-days">It took <b>${days} working days</b>, counted out of the repository rather than estimated afterwards.</p>
        <div class="cc-rows">
          <div class="cc-row cc-us">
            <span class="cc-who">With us</span>
            <span class="cc-fig">${ours}</span>
          </div>
          <div class="cc-row">
            <span class="cc-who">At ${esc(PRICING.COMPARE.label)}</span>
            <span class="cc-fig"><b>${money(cmpLo)} to ${money(cmpHi)}</b><span>the same ${days} days at $${PRICING.COMPARE.hourly}/hr, billed at ${lo} to ${hi} hours a day</span></span>
          </div>
        </div>
        <p class="cc-fine">A rate comparison, not a bill. Our figure is the published ladder from <a href="/#price">the pricing page</a>, for the closest match to this shape of work. Working days regenerate from the repository on every deploy.</p>
      </section>`;
}

const MONTH_LABEL = (key) => {
  const [y, m] = key.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y}`;
};

/** One sparkline. Zero months render as a flat tick, not a minimum-height bar —
 *  a month with no work must not look like a month with one day of it. */
function spark(days) {
  const max = Math.max(...days, 1);
  return days
    .map((v, i) => {
      const when = esc(MONTH_LABEL(STATS.MONTHS[i]));
      if (v === 0) return `<b class="z" style="height:2px" title="${when}: no activity"></b>`;
      const h = Math.max(5, Math.round((v / max) * 26));
      const recent = i >= days.length - 3 ? ' hi' : '';
      const t = `${when}: ${v} active day${v === 1 ? '' : 's'}`;
      return `<b class="${recent.trim()}" style="height:${h}px;animation-delay:${(i * 0.16).toFixed(2)}s" title="${esc(t)}"></b>`;
    })
    .join('');
}

/* The hero's right-hand panel: what the stack they already pay for costs, and
   what owning one system costs instead. Server-rendered rather than drawn by
   script.js like the picker is, because this one is above the fold and must be
   in the HTML rather than appearing a beat later.
   Numbers come from content/pricing.js; the total is summed here, never typed. */
function rentPanel() {
  const { RENT_STACK: S, rentTotal, reconcileMonthly, reconcileBreakEven, BASES } = PRICING;
  const entry = BASES.find((b) => b.id === 'tool');
  return `<aside class="stack rv" aria-label="What renting it costs">
        <div class="sh"><span>What renting it costs</span><i>${esc(S.label)}</i></div>
        ${S.rows.map((r) => `<div class="srow"><b>${esc(r.name)}</b><span>${money(r.mo)}</span></div>`).join('\n        ')}
        <div class="stot"><b>${money(rentTotal())}<span> a month</span></b><span>Five bills, and none of them talk to each other.</span></div>
        <!-- The licences were never the expensive part, and the panel used to stop
             before saying so. Half a day a week is the low end on purpose; the
             figure published is a break-even, not a salary, so it is arithmetic
             the reader can check. Computed in content/pricing.js.
             The hours are said in words rather than as reconcileMonthly() — it
             rounds to 17, and "17 hours a month" sitting beside "$17 an hour"
             read as one number stated twice. -->
        <div class="swork"><b>And somebody keeps them in step.</b> Half a day a week on that beats all five bills combined at any wage over <b>${money(reconcileBreakEven())} an hour</b> — and it never arrives as an invoice.</div>
        <div class="sgrow">Priced per person, so growing costs twice. <b>${S.hires} more hires is about ${money(S.afterHires)}</b> in licences alone, and none of it becomes yours.</div>
        <div class="sown">
          <div class="k">One system, yours</div>
          <div class="v">From ${money(entry.from)} <small>once</small></div>
          <div class="n">Then <b>${money(entry.mo)} a month</b>, flat. Add the whole team, the next branch, the busiest month — <b>the price does not move</b>.</div>
        </div>
      </aside>`;
}

/**
 * The scale comparison. Seven CRMs, the automation layer that has to sit on top
 * of any of them, and one row for owning it instead — three years, at the
 * visitor's own headcount.
 *
 * SERVER-RENDERED AT THE DEFAULT HEADCOUNT, deliberately. The picker above it
 * is drawn by script.js because it is a control; this is an argument made of
 * numbers, so it has to be in the HTML for a reader with no JS, for a crawler,
 * and for anyone who screenshots the page before touching the slider. script.js
 * then MUTATES these nodes rather than rebuilding them — one markup generator,
 * so the two can never drift.
 *
 * Every figure comes from content/pricing.js. Nothing here computes a price.
 */
/* The price ladder, server-rendered.
 *
 * WHY THIS EXISTS. Until 2026-08-20 the whole of #price was empty divs in the
 * served HTML — script.js built the sentence, the pills, the estimate and the
 * four cards from window.KD_PRICING on load. A browser saw everything; a
 * crawler, a social scraper and every AI assistant saw nothing. Checked against
 * the live page: the only figure that leaked was one "$2,500 once, then
 * $300/mo" from the scale chart's own row.
 *
 * That is worse than it sounds, and worse than "our pricing is missing". The
 * numbers that WERE in the HTML are the comparison chart's — $12,000, $21,000,
 * $63,000, $47,383 — which are what Monday, Salesforce and HubSpot cost. A
 * machine reading that page finds a dozen five-figure sums and one $2,500, with
 * nothing marking whose is whose. Ariel, 2026-08-20: "the pricing is not
 * readable for bots".
 *
 * So the server renders the DEFAULT state (the `tool` rung, same one script.js
 * opens on) and script.js switches from building the markup to mutating it —
 * exactly the arrangement scaleChart() and the seat slider already use. There
 * is no second copy of the ladder anywhere: this and the browser both read
 * content/pricing.js.
 *
 * IF YOU EVER MOVE THIS BACK CLIENT-SIDE, the site silently stops being
 * quotable and nothing fails. scripts/verify-crawl.js is the guard.
 */
function askSection() {
  const P = PRICING;
  const rows = P.routes();
  const sel = 'tool';
  const cur = rows.find((r) => r.id === sel);
  const pkgs = rows.filter((r) => r.axes);

  const chips = rows.map((r) => {
    const on = r.id === sel;
    return `<button class="ask-chip${r.id === 'unsure' ? ' alt' : ''}${on ? ' on' : ''}"`
      + ` data-id="${esc(r.id)}" role="option" aria-selected="${on}">`
      + `<b>${esc(r.chip)}</b><span>${esc(r.price)}</span></button>`;
  }).join('');

  const band = `<div class="ask-uni"><b>Every one of them includes</b><ul>`
    + P.UNIVERSAL.map((u) => `<li>${esc(u)}</li>`).join('')
    + `</ul></div>`;

  const cards = pkgs.map((r) => {
    const on = r.id === sel;
    return `<button class="ask-card${on ? ' on' : ''}" data-id="${esc(r.id)}" aria-pressed="${on}">`
      + `<b>${esc(r.product)}</b><ul>`
      + r.axes.map((a) => `<li><em>${esc(a[0])}</em>${esc(a[1])}</li>`).join('')
      + `</ul><i class="mn">${esc(r.money)}</i></button>`;
  }).join('');

  /* The pilot has no `axes`, so its three ticks have nowhere to go in the grid.
     script.js shows them in this row instead whenever the chosen rung is not a
     package — server-rendered hidden because the default rung IS one. */
  const ticks = cur.axes ? '' : cur.ticks.map((t) => `<li>${esc(t)}</li>`).join('');

  return `<h2 class="ask-say rv">I need <button class="pick" id="askSay" aria-haspopup="listbox">${esc(cur.say)}</button></h2>
      <p class="ask-note rv" id="askNote">${esc(cur.note)}</p>
      <ul class="ask-ticks rv" id="askTicks"${cur.axes ? ' hidden' : ''}>${ticks}</ul>

      <p class="ask-hint rv">or pick the closest</p>
      <div class="ask-chips rv" id="askChips" role="listbox" aria-label="What you need">${chips}</div>

      <div class="ask-out rv">
        <div class="n" id="askBuild">${esc(cur.n1)}<span>${esc(cur.s1)}</span></div>
        <div class="sep">/</div>
        <div class="m" id="askMonthly">${esc(cur.n2)}<span>${esc(cur.s2)}</span></div>
        <a href="#talk" class="btn btn-primary" data-track="ask-talk">Talk it through &rarr;</a>
      </div>

      <div class="ask-all rv" id="askAll">
        <p class="ask-hint">or see what each one includes</p>
        ${band}
        <div class="ask-grid">${cards}</div>
      </div>
      ${pricingLd()}`;
}

/* Structured pricing, from the same ladder.
 *
 * The visible cards answer a human asking "which of these am I"; this answers a
 * machine asking "what does kaymen.dev charge", which until now had no answer at
 * all. Generated rather than written for the usual reason — a hand-kept copy
 * would be the third place the numbers live and the first one to go stale.
 *
 * Every build fee is a FROM price, so it is `minPrice` on a PriceSpecification
 * rather than `price`. Stating 6500 as the price would publish a figure the site
 * itself declines to promise, and machine-readable is only worth having if it is
 * also true. The `running` rung has no build fee at all and gets no build spec.
 */
function pricingLd() {
  const P = PRICING;
  const offers = P.routes().filter((r) => r.axes).map((r) => {
    const b = P.BASES.find((x) => x.id === r.id);
    const specs = [];
    if (b.from) {
      specs.push({
        '@type': 'PriceSpecification',
        name: 'Build, once',
        minPrice: b.from,
        priceCurrency: 'USD',
        valueAddedTaxIncluded: false,
      });
    }
    specs.push({
      '@type': 'UnitPriceSpecification',
      name: 'Service, monthly',
      price: b.mo,
      priceCurrency: 'USD',
      /* Per month, and per ENGAGEMENT rather than per seat. The page's whole
         argument is that this number does not move with headcount, so leaving
         the unit off would surrender the one claim that distinguishes it. */
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
    });
    return {
      '@type': 'Offer',
      name: r.product,
      description: b.note,
      category: b.name,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      priceSpecification: specs,
      itemOffered: {
        '@type': 'Service',
        name: r.product,
        description: b.note,
        serviceType: 'Custom business software',
      },
    };
  });

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Custom business software, built and run',
    provider: {
      '@type': 'Organization',
      name: 'kaymen.dev',
      url: SITE,
      logo: SITE + '/assets/brand/kaymen-mark-512.png',
      email: LEGAL.LEGAL_EMAIL,
    },
    serviceType: 'Custom business software',
    description: 'Software your business owns, on your own infrastructure, with '
      + 'logins for everyone and no per-seat licence.',
    termsOfService: SITE + '/terms-of-use',
    /* Said once here too, for the same reason the band above the cards exists:
       these are true of every offer, so stating them per-offer would imply the
       ones that omitted them lacked them. */
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'What it costs',
      itemListElement: offers,
    },
  };

  /* "</script>" inside a JSON string would close the tag early and dump the rest
     of the ladder into the document as markup. Escaping "<" is the whole guard. */
  return '<script type="application/ld+json">'
    + JSON.stringify(ld).replace(/</g, '\\u003c')
    + '</script>';
}

function scaleChart() {
  const P = PRICING;
  const seats = P.SCALE_DEFAULT_SEATS;
  const data = P.scaleRows(seats);
  const aside = P.scaleAside(seats);
  const lo = P.SCALE_SEAT_RANGE[0];
  const hi = P.SCALE_SEAT_RANGE[1];

  const row = (r, i) => {
    const bars = r.widths
      .map((w, k) => '<b class="y' + (k + 1) + '" style="width:' + w.toFixed(2) + '%"></b>')
      .join('');
    const years = r.years.map((v) => '<div class="sc-yr">' + money(v) + '</div>').join('');
    const yrs = r.years.map((v, k) => 'Yr ' + (k + 1) + ' ' + money(v)).join(' &middot; ');
    const tag = r.tag ? '<div class="sc-tag">' + esc(r.tag) + '</div>' : '';
    return `<div class="sc-row${r.kind === 'them' ? '' : ' ' + r.kind}" data-i="${i}">
            <div class="sc-name">${esc(r.name)}<i>${esc(r.tier)}${r.per ? ' &middot; ' + esc(r.per) : ''}</i></div>
            <div class="sc-bar">${bars}<span class="rest"></span></div>
            ${years}
            <div class="sc-total">${money(r.total)}</div>
            <div class="sc-yrs">${yrs}</div>
            ${tag}
          </div>`;
  };

  return `<div class="scale rv" id="scale">
        <div class="scale-head">
          <div class="scale-ask">
            <p class="eyebrow">Three years, at your headcount</p>
            <h2 class="sec scale-h2">What will it cost you to scale?</h2>
            <div class="scale-pick">
              <div class="scale-pick-head">
                <label for="scaleSeats">People who need a login</label>
                <b id="scaleSeatsV">${seats}</b>
              </div>
              <input type="range" id="scaleSeats" min="${lo}" max="${hi}" step="1" value="${seats}"
                     aria-label="People who need a login" aria-describedby="scaleAside">
              <div class="scale-ends"><span>${lo}</span><span>${hi}</span></div>
            </div>
          </div>
          <aside class="scale-aside" id="scaleAside" aria-live="polite">
            <h3 id="scaleAsideT">${esc(aside.title)}</h3>
            <p id="scaleAsideP">${aside.html}</p>
            <p class="scale-prov">${esc(P.SCALE_CHECKED)} list prices.</p>
          </aside>
        </div>
        <div class="scale-chead" aria-hidden="true">
          <div>System</div><div>By year</div><div>Year 1</div><div>Year 2</div><div>Year 3</div><div>Total</div>
        </div>
        <div class="scale-chart" id="scaleChart" role="img"
             aria-label="Three-year cost of seven CRMs, an automation layer, and one system you own, at your team size">
          ${data.rows.map(row).join('\n          ')}
        </div>
      </div>`;
}

/* THE RENT PANEL CAME OUT OF THE HERO on 2026-08-18. Two reasons, and the
   second decided it:

     1. It argued the same thing as the comparison chart in #price, less well -
        one static stack against seven named CRMs at the visitor own headcount.
     2. Its numbers had gone wrong. The books line was built on QuickBooks
        Essentials, which caps at THREE users, so a team of five could not
        legally be on it - and that tier rose on 1 August 2026. The line items
        summed to ~$34/head while afterHires implied $38. A claim about
        somebody else pricing, wrong, above the fold.

   rentPanel() below is kept, not deleted: the slot is expected to be refilled,
   most likely by a per-hire teaser reading off scaleRows() so it can never
   drift from the chart the way this did.

   This reasoning lives HERE rather than in index.html because index.html ships
   to the browser - a comment reciting the wrong competitor price puts it back
   into view-source on the page that removed it. */

/* Unused since the hero changed on 2026-08-16: the fleet panel was the hero
   graphic and rentPanel took that slot. Kept because the same board still
   renders in #running below, so nothing about it is stale, and it is the
   obvious thing to reach for if the hero ever wants the proof back. */
function fleetPanel() {
  const { FLEET, TYPICAL, MONTHS } = STATS;
  const window = `${MONTH_LABEL(MONTHS[0])} to ${MONTH_LABEL(MONTHS[MONTHS.length - 1])}`;
  return `<aside class="fleet rv" id="fleet" aria-label="Live systems">
        <div class="fleet-head"><b>Live fleet</b><span>Active days / mo</span></div>
        ${FLEET.map(
          (f) => `<div class="frow">
          <span class="pulse"></span>
          <div class="fn">${esc(f.name)}<i>${esc(f.kind)}</i></div>
          <div class="spark" role="img" aria-label="${esc(f.name)}: ${f.days.join(', ')} active days per month, ${esc(window)}">${spark(f.days)}</div>
        </div>`
        ).join('\n        ')}
        <p class="fleet-foot">Distinct days carrying a commit, per month, counted from each system's repository (${esc(window)}). Most active months land at <b>${TYPICAL.low}–${TYPICAL.high} days</b>.</p>
      </aside>`;
}

/**
 * Shot strip. THREE, and it stays three — one row. It briefly ran to six (the
 * client back ends plus predictable/kartov/davenen) and that was wrong twice
 * over: it doubled a strip already too small to read on a phone, and it diluted
 * the section's claim. "What we run" is proved by a business doing its work on
 * one of these, not by a product we made for ourselves. Naming is settled per
 * project by `client.named` in content/projects.js, not by this file.
 *
 * The three retired shots are still in assets/shots/ (predictable.jpg,
 * kartov.jpg, davenen.jpg) — swapping one back in is four lines, so the mix can
 * change without re-shooting anything. Do not let it grow past three.
 *
 * EVERY SHOT IS OF A LOCAL INSTANCE ON FABRICATED DATA, and that is not a
 * detail. These systems hold borrowers, riders and students: the Thrive
 * screenshot originally supplied showed six real students by name, an intake
 * queue, a staff member and a university. Consent to name the CLIENT is not
 * consent to publish the PEOPLE INSIDE their system, and no client gave the
 * second one. Re-take with scripts/shoot-app.js against a freshly seeded
 * database — never against production, and never against a dev database that
 * has been synced from it. The recipes are in HANDOFF-FRONTEND-2026-08-16.md §6.
 *
 * Lives here rather than in content/projects.js because it is presentation
 * for one section, not part of the case-study content model — move it if a
 * second surface ever needs it.
 */
/* --- front-and-back pairs -----------------------------------------------
   Replaced the three-shot strip on 2026-08-18. The strip showed three back
   offices, which proved we build systems and said nothing about the other half
   of every one of those jobs: the public site in front of it. That omission is
   why "we also build websites" looked like a gap in the business when it was a
   gap in the evidence.

   ORDER IS THE ARGUMENT, strongest first:
     1. ONE system running both  — Horse & Harmony. Its back office carries
        Hero, Site Images, Website Texts, Gallery and Testimonials beside
        Bookings and Clients, so the client edits their own public site from
        the same login that runs the business. Nothing else here does that.
     2. Public site + staff system — Olami Herzliya.
     3. Website only — Richmount Capital. Deliberately last and deliberately
        present: it is the answer to the buyer who wants a good site and
        currently never gets in touch.

   BRIDGEMORTGAGE IS NOT HERE and must not be added. bridgemtg.com reports
   `Go Daddy Website Builder 8.0.0000` — we built its back office, not its site.
   See FRONT_ENDS in content/projects.js.

   TWO SOURCES OF SCREENSHOT, and the rule is opposite for each:
     · `front` comes from PRODUCTION via scripts/shoot-front.js, because the
       client published that page themselves.
     · `back` comes from a LOCAL instance on a seeded database via
       scripts/shoot-app.js, because those systems hold borrowers, riders and
       students. Never production, never a dev copy synced from it.

   `publish` is a CONSENT flag read from FRONT_ENDS, not a style choice. false
   renders the anonymous label and does not link. The argument survives it
   intact — "a therapeutic riding centre, a bilingual public site" names nobody
   and proves the same thing — which is why none of this waited on the asks. */
const PROOF = [
  {
    key: 'bilingual-booking-platform',
    badge: 'One system, one login',
    named: { title: 'Horse & Harmony', host: 'horseandharmonyil.com' },
    anon: { title: 'A therapeutic riding centre', host: 'a bilingual public site' },
    front: '/assets/shots/horseharmony-front.jpg',
    back: '/assets/shots/horseharmony.jpg',
    frontCap: 'What riders book through',
    backCap: 'What the staff run — and where the site’s own hero, gallery and texts are edited',
  },
  {
    key: 'multi-campus-engagement-platform',
    badge: 'Public site and staff CRM',
    named: { title: 'Olami Herzliya', host: 'olamiherzliya.org' },
    anon: { title: 'A multi-campus student organisation', host: 'a public sign-up site' },
    front: '/assets/shots/olami-front.jpg',
    back: '/assets/shots/thrive.jpg',
    frontCap: 'Events, tickets and sign-ups, in English and Spanish',
    backCap: 'The same database, as the staff see it',
  },
];

const PROOF_SOLO = {
  key: 'Investment firm site',
  named: { title: 'Richmount Capital', host: 'richmountcapital.com' },
  anon: { title: 'An investment fund', host: 'a public marketing site' },
  front: '/assets/shots/richmount-front.jpg',
  cap: 'A fund’s public face: thesis, strategy, team, and a gated investor deck. No system behind it — sometimes the website is the whole job, and we take that as seriously as the rest.',
};

/** Name and host for a proof row, honouring the consent flag in FRONT_ENDS. */
function proofLabel(row) {
  const fe = PROJECT_FRONTS[row.key];
  const named = fe && fe.publish === true;
  return { ...(named ? row.named : row.anon), link: named && fe.url ? fe.url : null };
}

/* Front ends are shot at 1440x900 — the width their layouts are actually
   designed for. At 900 the browser window was narrower than the sites expect
   and they clipped their own chrome: Horse & Harmony lost the Book-a-Session
   button out of its nav, which is the one thing that screenshot exists to show.
   Back offices stay at 900x562 because they are ours and they fit.

   Both are 1.6:1, so they drop into the same box and the CSS aspect-ratio
   holds — but the intrinsic attributes must be the REAL ones, or the browser
   reserves the wrong box before the JPEG lands. */
function shotFigure(src, host, capTitle, cap, extra) {
  const front = /-front\.jpg$/.test(src);
  const w = front ? 1440 : 900;
  const h = front ? 900 : 562;
  return `<figure class="shot${extra ? ' ' + extra : ''}">
            <div class="shot-bar"><i></i><i></i><i></i><em>${esc(host)}</em></div>
            <img src="${esc(src)}" alt="" loading="lazy" decoding="async" width="${w}" height="${h}">
            <figcaption><b>${esc(capTitle)}</b>${esc(cap)}</figcaption>
          </figure>`;
}

function proofStrip() {
  const rows = PROOF.map((p) => {
    const l = proofLabel(p);
    const host = l.link
      ? `<a href="${esc(l.link)}" target="_blank" rel="noopener">${esc(l.host)}</a>`
      : esc(l.host);
    /* The flip control is rendered on every pair but only ever VISIBLE below
       860px, and only once script.js has added .flip-on. Two halves of one
       decision: side by side is the right answer on desktop, but stacking
       three pairs on a phone means six full-width screenshots and a third of
       the page. On a phone you get one at a time and a toggle.

       PROGRESSIVE ENHANCEMENT, deliberately. The CSS hides the second figure
       only under .flip-on, which script.js adds. Without JS a phone still gets
       both figures stacked — the old behaviour — rather than a toggle that
       does nothing and a back office that can never be reached. */
    return `<div class="pair">
          <div class="pair-head"><h3>${esc(l.title)}</h3><span class="pair-host">${host}</span><span class="pair-badge">${esc(p.badge)}</span></div>
          <div class="pair-flip" role="group" aria-label="Which side to show">
            <button type="button" data-side="0" aria-pressed="true">What they see</button>
            <button type="button" data-side="1" aria-pressed="false">What you run</button>
          </div>
          <div class="pair-shots">
            ${shotFigure(p.front, l.host, 'What they see', p.frontCap, 'on')}
            ${shotFigure(p.back, 'the back office', 'What you run', p.backCap)}
          </div>
        </div>`;
  }).join('\n        ');

  const s = proofLabel(PROOF_SOLO);
  const solo = `<div class="pair pair-solo">
          <div>
            <h3>${esc(s.title)}</h3>
            <div class="pair-host">${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.host)}</a>` : esc(s.host)}</div>
            <p>${esc(PROOF_SOLO.cap)}</p>
          </div>
          ${shotFigure(PROOF_SOLO.front, s.host, 'Website only', 'No system behind it.')}
        </div>`;

  return `<div class="proof rv">
        <p class="proof-lead"><b>Front and back, on the same project.</b> Most shops build one or the other. Each pair below is one job, seen twice.</p>
        ${rows}
        ${solo}
      </div>`;
}

/* Retired 2026-08-18, replaced by PROOF above. Kept because the three JPEGs are
   still in assets/shots/ and this is the definition that goes with them — if
   the pairs are ever reverted, this is what to put back. */
const SHOTS = [
  {
    img: '/assets/shots/bridgemtg.jpg',
    host: 'bridgemtg.kaymen.dev',
    title: 'Mortgage pipeline and client portal',
    note: 'Every file, stage and bank approval on one board.',
  },
  {
    img: '/assets/shots/thrive.jpg',
    host: 'thrivestudyabroad.org',
    title: 'Multi-campus student CRM',
    note: 'One tenanted system serving five organisations.',
  },
  {
    img: '/assets/shots/horseharmony.jpg',
    host: 'horseandharmonyil.com',
    title: 'Therapeutic-riding bookings',
    note: 'Bilingual diary, health-fund referrals, reminders.',
  },
];

/** One row of the running board — the fleet currently under maintenance. */
function boardRow(s) {
  const area = areaById[s.area];
  // The scale figures rather than the tagline: the board's job is evidence,
  // and the tagline is already the headline on the case card below.
  const facts = s.scale.map((x) => `${x.value} ${x.label}`).join(' · ');
  return `<div class="brow">
          <span class="dot"></span>
          <div class="nm">${esc(s.name)} <i>${esc(area ? area.label : '')} · ${
            s.own ? 'Ours' : (clientName(s) || 'Named on request')
          }</i></div>
          <div class="wt">${esc(facts)}</div>
          <div class="yr">LIVE SINCE ${esc(s.year)}</div>
        </div>`;
}

function runningBoard() {
  return `
  <section id="running">
    <div class="wrap">
      <div class="prose rv">
        <p class="eyebrow">The proof</p>
        <h2 class="sec">What we run</h2>
        <p class="sec-sub">Not a gallery of finished things. The fleet currently under maintenance.</p>
      </div>

      <div class="board rv">
        ${CASE_STUDIES.map(boardRow).join('\n        ')}
      </div>

      ${proofStrip()}

      <div class="band rv">
        <div class="stats">
          ${STATS.BAND.map(
            (e) => `<div class="stat">
            <div class="n">${esc(e.value)}</div>
            <div class="l">${esc(e.label)}<i>${esc(e.note)}</i></div>
          </div>`
          ).join('\n          ')}
        </div>
      </div>
    </div>
  </section>`;
}

/** One case-study card. Used on the homepage and on the /work index. */
function caseCard(s) {
  const area = areaById[s.area];
  const demo = Boolean(demoFor(s.slug));
  return `<a class="case" href="/work/${esc(s.slug)}" data-track="study-${esc(s.slug)}">
          <span class="tag">${esc(area ? area.label : '')}</span>
          <h3>${esc(s.tagline)}</h3>
          <p class="tl">${esc(s.summary)}</p>
          <div class="hard">
            <b>The hard part${demo ? ', playable' : ''}</b>
            <p>${esc(s.hardPart.title)}</p>
          </div>
          <div class="meta">
            <span class="live"><span class="pulse"></span> ${esc(s.status)}</span>
            <span class="rd">${demo ? 'Try it' : 'Read it'}
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"/></svg>
            </span>
          </div>
        </a>`;
}

function caseStudyTeasers() {
  return `
  <section id="work">
    <div class="wrap">
      <div class="prose rv">
        <p class="eyebrow">Case studies</p>
        <h2 class="sec">Every one includes the part that broke</h2>
        <p class="sec-sub">A capability list is free to write. Naming what went wrong is not.</p>
      </div>

      <div class="cases rv">
        ${CASE_STUDIES.map(caseCard).join('\n        ')}
      </div>
    </div>
  </section>`;
}

/**
 * The long tail. Deliberately NOT on the homepage any more — the locked page
 * structure is hero · routing · running board · case studies · pricing ·
 * no-hostages · contact. It keeps its home on /work, where breadth is what a
 * reader arrived for.
 */
function longTail() {
  const byArea = PRACTICE_AREAS.map((a) => ({
    area: a,
    items: MORE_WORK.filter((m) => m.area === a.id),
  }));
  return `
  <section class="more-work">
    <div class="wrap">
      <details class="more-toggle rv">
        <summary>
          <span class="more-summary-text">Everything else we've built</span>
          <span class="more-count">${MORE_WORK.length} more projects</span>
        </summary>
        <div class="more-grid">
          ${byArea
            .map(
              (g) => `<div class="more-col">
            <h4>${esc(g.area.title)}</h4>
            <ul>
              ${g.items
                .map((m) => {
                  const label = esc(m.name);
                  const badge = m.badge ? `<span class="more-badge">${esc(m.badge)}</span>` : '';
                  const inner =
                    mayLink(m) && m.url
                      ? `<a href="${esc(m.url)}"${m.url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`
                      : label;
                  return `<li><span class="more-name">${inner}${badge}</span><span class="more-note">${esc(m.note)}</span></li>`;
                })
                .join('\n              ')}
            </ul>
          </div>`
            )
            .join('\n          ')}
        </div>
        <p class="more-footnote">Client work is described by shape rather than by name. We don't put client brands, logos or data in our marketing, including in screenshots.</p>
      </details>
    </div>
  </section>`;
}

/** All homepage sections that come from the content layer. */
function homeSections() {
  return [runningBoard(), '\n  <hr class="rule">\n', caseStudyTeasers(), '\n  <hr class="rule">\n'].join('\n');
}

/* --- case study page ------------------------------------------------------- */

function caseStudyPage(slug) {
  const s = bySlug[slug];
  if (!s) return null;
  const area = areaById[s.area];
  const ogImage = `/assets/og/work-${s.slug}.png`;
  const demo = demoFor(s.slug);

  const list = (items, cls = '') =>
    `<ul class="${cls}">${items.map((i) => `<li>${prose(i)}</li>`).join('')}</ul>`;

  const body = `
  <article class="case-page">
    <header class="case-hero">
      <div class="wrap case-narrow">
        <a class="case-back" href="/work" data-track="case-back">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"/></svg>
          All work
        </a>
        <div class="case-meta">
          <span class="case-area">${esc(area ? area.title : '')}</span>
          <span class="case-dot">·</span>
          <span class="case-status">${esc(s.status)}</span>
          <span class="case-dot">·</span>
          <span class="case-year">${esc(s.year)}</span>
        </div>
        <h1>${esc(s.name)}</h1>
        ${clientName(s) ? `<p class="case-client">Built for <b>${esc(clientName(s))}</b></p>` : ''}
        <p class="case-tagline">${esc(s.tagline)}</p>
        <p class="case-summary">${esc(s.summary)}</p>
        ${
          mayLink(s) && s.liveUrl
            ? `<a class="btn btn-ghost case-live" href="${esc(s.liveUrl)}" target="_blank" rel="noopener" data-track="case-live-${esc(s.slug)}">View it live
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"/></svg>
        </a>`
            : ''
        }
        <div class="case-scale">
          ${s.scale
            .map(
              (x) => `<div class="case-scale-item">
            <span class="case-scale-value">${esc(x.value)}</span>
            <span class="case-scale-label">${esc(x.label)}</span>
          </div>`
            )
            .join('\n          ')}
        </div>
      </div>
    </header>

    <div class="wrap case-narrow case-body">
      ${demo}

      <section class="case-glance">
        <div class="glance-col">
          <h2>The problem</h2>
          ${list(s.problemShort || s.constraints.slice(0, 3), 'glance-list')}
        </div>
        <div class="glance-col">
          <h2>What we built</h2>
          ${list(s.built.slice(0, 4), 'glance-list glance-check')}
        </div>
      </section>

      <section class="case-outcome">
        <h2>Outcome</h2>
        ${list(s.outcome, 'case-list case-list-check')}
        <div class="case-stack">
          ${s.stack.map((t) => `<span>${esc(t)}</span>`).join('')}
        </div>
      </section>

      ${caseCost(s)}

      <details class="case-longform">
        <summary>
          <span class="lf-title">The full write-up</span>
          <span class="lf-sub">problem, constraints, and the whole debugging story. About a 4-minute read</span>
        </summary>
        <div class="lf-body">
          <section class="case-section">
            <h3><span class="case-num">01</span> The problem</h3>
            ${s.problem.map((p) => `<p>${prose(p)}</p>`).join('\n            ')}
          </section>
          <section class="case-section">
            <h3><span class="case-num">02</span> Constraints</h3>
            ${list(s.constraints, 'case-list')}
          </section>
          <section class="case-section">
            <h3><span class="case-num">03</span> What we built</h3>
            ${list(s.built, 'case-list case-list-check')}
          </section>
          <section class="case-hard">
            <div class="case-hard-tag">The hard part, in full</div>
            <h3>${esc(s.hardPart.title)}</h3>
            ${s.hardPart.body.map((p) => `<p>${prose(p)}</p>`).join('\n            ')}
            <aside class="case-lesson">
              <span class="case-lesson-label">What it taught us</span>
              <p>${prose(s.hardPart.lesson)}</p>
            </aside>
          </section>
        </div>
      </details>
    </div>

    ${nextPrev(s)}
  </article>
  ${ctaBand('Got something shaped like this?', 'Tell us what it is and what has stopped working. We will tell you what we would build.')}`;

  return layout({
    title: `${s.name} | kaymen.dev`,
    description: s.tagline,
    path: `/work/${s.slug}`,
    ogImage,
    body,
    demos: Boolean(demo),
  });
}

function nextPrev(current) {
  const i = CASE_STUDIES.findIndex((c) => c.slug === current.slug);
  const prev = CASE_STUDIES[(i - 1 + CASE_STUDIES.length) % CASE_STUDIES.length];
  const next = CASE_STUDIES[(i + 1) % CASE_STUDIES.length];
  const link = (s, dir) => `<a class="case-nav-item ${dir}" href="/work/${esc(s.slug)}">
          <span class="case-nav-dir">${dir === 'prev' ? 'Previous' : 'Next'}</span>
          <span class="case-nav-name">${esc(s.name)}</span>
        </a>`;
  return `
    <nav class="case-nav">
      <div class="wrap case-narrow case-nav-inner">
        ${link(prev, 'prev')}
        ${link(next, 'next')}
      </div>
    </nav>`;
}

/* --- work index ------------------------------------------------------------ */

/**
 * A legal page — privacy, terms of use, security.
 *
 * Content is data in content/legal.js so the wording is versioned and diffable
 * rather than buried in markup, and so the retention table can be mirrored from
 * the one real RETENTION constant instead of retyped. A policy that describes
 * behaviour the code does not have is a written false statement, which is worse
 * than having no policy at all.
 */
function legalPage(slug) {
  const page = LEGAL.legalBySlug(slug);
  if (!page) return null;

  const block = (s) => {
    const paras = (s.p || []).map((t) => `<p>${t}</p>`).join('\n            ');
    const table = s.table
      ? `<table class="legal-table"><tbody>${s.table
          .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
          .join('')}</tbody></table>`
      : '';
    return `<section class="legal-sec">
            <h2>${esc(s.h)}</h2>
            ${paras}
            ${table}
          </section>`;
  };

  const others = LEGAL.LEGAL_PAGES.filter((p) => p.slug !== slug);

  return layout({
    title: `${page.title} — kaymen.dev`,
    description: page.lede,
    path: `/${page.slug}`,
    ogType: 'article',
    active: 'terms',
    body: `
  <main class="page">
    <article class="legal">
      <div class="wrap">
        <div class="prose rv">
          <p class="eyebrow">Legal</p>
          <h1 class="sec">${esc(page.title)}</h1>
          <p class="sec-sub">${esc(page.lede)}</p>
          <p class="legal-date">Last updated ${esc(LEGAL.LEGAL_UPDATED)}. ${esc(LEGAL.LEGAL_ENTITY)}.</p>
        </div>
        <div class="legal-body rv">
          ${page.sections.map(block).join('\n          ')}
        </div>
        <nav class="legal-nav rv" aria-label="Other legal pages">
          ${others.map((p) => `<a href="/${p.slug}">${esc(p.title)}</a>`).join('\n          ')}
          <a href="/">Back to the site</a>
        </nav>
      </div>
    </article>
  </main>`,
  });
}

function workIndexPage() {
  const body = `
  <header class="work-hero">
    <div class="wrap prose">
      <p class="eyebrow">Selected work</p>
      <h1>The builds, and what was <em>hard</em> about each</h1>
      <p>Each case study covers the problem, the constraints, what we built, and one specific thing that went wrong along the way. The last part is the one worth reading.</p>
    </div>
  </header>
  <section class="work-index">
    <div class="wrap">
      <div class="cases rv">
        ${CASE_STUDIES.map(caseCard).join('\n        ')}
      </div>
    </div>
  </section>
  ${longTail()}
  ${ctaBand('Want the same treatment on your problem?', 'The first conversation is us working out whether this is a build, a fix, or something you should not do at all.')}`;

  return layout({
    title: 'Work | kaymen.dev',
    description:
      'Six case studies: multi-tenant platforms, business-system integrations, and apps in the stores. Each with the part that went wrong and how it was fixed.',
    path: '/work',
    ogType: 'website',
    ogImage: '/assets/og/work.png',
    body,
  });
}

/* --- 404 ------------------------------------------------------------------- */

function notFoundPage() {
  const body = `
  <header class="work-hero notfound-hero">
    <div class="wrap prose">
      <p class="eyebrow">404</p>
      <h1>That page isn't here</h1>
      <p>The link may be out of date. The work is all still around. Start from there.</p>
      <div class="actions">
        <a href="/work" class="btn btn-primary">See the work</a>
        <a href="/" class="btn btn-ghost">Back to home</a>
      </div>
    </div>
  </header>`;
  return layout({
    title: 'Not found | kaymen.dev',
    description: 'That page is not here.',
    path: '/404',
    ogType: 'website',
    body,
  });
}

module.exports = {
  homeSections,
  fleetPanel,
  rentPanel,
  scaleChart,
  askSection,
  legalPage,
  liveCount: () => String(STATS.LIVE.running),
  caseStudyPage,
  workIndexPage,
  notFoundPage,
  esc,
};
