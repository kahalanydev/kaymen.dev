#!/usr/bin/env node
/* What a crawler, a scraper and an AI assistant see — no browser, no JS.
 *
 *   node scripts/verify-crawl.js [url]
 *
 * WHY. Until 2026-08-20 the entire price ladder was built by script.js on load,
 * so #askChips, #askAll, #askBuild and #askMonthly were empty divs in the served
 * HTML. A browser saw four packages; every machine saw nothing. The one figure
 * that leaked was "$2,500 once, then $300/mo" from the scale chart's own row —
 * so an assistant asked what kaymen.dev charges would answer "$2,500 + $300/mo,
 * full stop", which understates three of the four rungs and omits the fourth.
 *
 * And the failure was quieter than that. The numbers that WERE in the HTML are
 * the comparison chart's — $12,000, $21,000, $63,000, $47,383 — which are what
 * Monday, Salesforce and HubSpot cost. A machine reading that page found a dozen
 * five-figure sums and one small one, with nothing in the markup saying whose
 * were whose. Getting quoted at a competitor's price is a worse outcome than not
 * being quoted at all, and nothing about the page looked broken.
 *
 * That is the class of bug this file exists for: it renders perfectly, it passes
 * every visual check, and it is only visible in `curl`. Run it against
 * production after any change to server/render.js, script.js or index.html.
 *
 * It asserts against content/pricing.js rather than against literals, so raising
 * a price cannot make it fail and cannot make it pass while the page lies.
 */
const P = require('../content/pricing');

const URL_ = process.argv[2] || 'http://127.0.0.1:8080/';

let pass = 0;
const fails = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fails.push(name); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

(async () => {
  const res = await fetch(URL_, { headers: { 'user-agent': 'kaymen-crawl-check', connection: 'close' } });
  const html = await res.text();
  console.log(`\nwhat a machine sees — ${URL_}  (${res.status}, ${(html.length / 1024).toFixed(1)}KB)\n`);
  check('page responds 200', res.status === 200, String(res.status));

  const rungs = P.routes().filter((r) => r.axes);

  /* ---------- the shells are filled, not empty ---------- */
  for (const id of ['askChips', 'askAll', 'askBuild', 'askMonthly']) {
    const m = html.match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]{0,40})'));
    check(`#${id} is not an empty div`, !!m && !/^\s*<\/(div|ul)>/.test(m[1]),
      m ? JSON.stringify(m[1].slice(0, 30)) : 'not found');
  }

  /* ---------- every rung is legible, by name and by price ---------- */
  for (const r of rungs) {
    check(`"${r.product}" is in the HTML`, html.includes(r.product));
    check(`"${r.product}" carries its price (${r.money})`,
      html.includes(r.money) || html.includes(r.money.replace(/ · /g, ' &middot; ')));
  }

  /* Every universal, once above the cards — the claim the whole ladder rests on
     ("no per-seat fee") lives here and nowhere else, so if the band stops
     rendering the site loses it entirely rather than partially. */
  for (const u of P.UNIVERSAL) {
    check(`universal: "${u.slice(0, 34)}…"`, html.includes(u.replace(/&/g, '&amp;')));
  }

  /* ---------- structured data ---------- */
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]);
  check('JSON-LD is present', blocks.length > 0, blocks.length + ' blocks');

  let ld = null;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b);
      if (j.hasOfferCatalog) ld = j;
    } catch (e) { check('JSON-LD parses', false, e.message); }
  }
  check('an Offer catalog is present', !!ld);

  if (ld) {
    const offers = ld.hasOfferCatalog.itemListElement || [];
    check('one Offer per rung', offers.length === rungs.length, offers.length + ' offers');
    for (const r of rungs) {
      const b = P.BASES.find((x) => x.id === r.id);
      const o = offers.find((x) => x.name === r.product);
      check(`Offer "${r.product}" exists`, !!o);
      if (!o) continue;
      const specs = o.priceSpecification || [];
      const monthly = specs.find((s) => s['@type'] === 'UnitPriceSpecification');
      const build = specs.find((s) => s['@type'] === 'PriceSpecification');
      check(`  monthly is ${b.mo}/month`,
        !!monthly && monthly.price === b.mo && monthly.referenceQuantity?.unitCode === 'MON',
        JSON.stringify(monthly));
      /* Build fees are published as FROM prices and must stay that way in the
         markup too: emitting `price` instead of `minPrice` would have a machine
         quote a fixed figure the site itself declines to promise. */
      if (b.from) {
        check(`  build is a FROM price (minPrice ${b.from}, no fixed price)`,
          !!build && build.minPrice === b.from && build.price === undefined, JSON.stringify(build));
      } else {
        check('  no build spec on the no-build-fee rung', !build, JSON.stringify(build));
      }
    }
  }

  /* ---------- the competitors' numbers are not ours ----------
     The scale chart puts what Monday, Salesforce and HubSpot cost on the same
     page. That is the argument and it should stay. But it is only safe while
     OUR figures are in the HTML too — otherwise the biggest numbers on the page
     are the only ones there, and nothing marks them as somebody else's. */
  const ourFigures = rungs.flatMap((r) => {
    const b = P.BASES.find((x) => x.id === r.id);
    return [P.money(b.mo)].concat(b.from ? [P.money(b.from)] : []);
  });
  const missing = ourFigures.filter((f) => !html.includes(f));
  check('every one of our own figures is in the HTML', missing.length === 0, 'missing ' + missing.join(', '));

  console.log(`\n${pass} passed, ${fails.length} failed`);
  /* Close fetch's keep-alive pool before the process ends. Without this the run
     exits 127 with a libuv assertion on Windows AFTER every check has passed, so
     the script is useless as a gate whatever it found — the same trap
     verify-proof.js hit with its websocket. Neither process.exit() nor a
     `Connection: close` header avoids it: the pooled handle is undici's. */
  await globalThis[Symbol.for('undici.globalDispatcher.1')]?.close?.();
  process.exitCode = fails.length ? 1 : 0;
})().catch((e) => { console.error('FAILED: ' + e.message); process.exitCode = 1; });
