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
} = require('../content/projects');
const { demoFor } = require('../content/demos');
const STATS = require('../content/stats');
const PRICING = require('../content/pricing');

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

      <div class="shots rv">
        ${SHOTS.map(
          (s) => `<figure class="shot">
          <div class="shot-bar"><i></i><i></i><i></i><em>${esc(s.host)}</em></div>
          <img src="${esc(s.img)}" alt="${esc(s.title)}" loading="lazy" decoding="async" width="900" height="562">
          <figcaption><b>${esc(s.title)}</b>${esc(s.note)}</figcaption>
        </figure>`
        ).join('\n        ')}
      </div>

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
  liveCount: () => String(STATS.LIVE.running),
  caseStudyPage,
  workIndexPage,
  notFoundPage,
  esc,
};
