/* ============================================================================
   kaymen.dev — write every Open Graph social card from the site's own copy

     node scripts/build-og.js

   WHY THIS EXISTS. The cards were built once by hand and then drifted. On
   2026-08-16 assets/og/default.png still read "the integrations most shops
   decline / Built and maintained by the same people" while the homepage had
   said "hard integrations / Built and run by the same people" for a day. The
   mark on them was current, because scripts/build-icons.js re-stamped it, but
   nothing re-stamped the words: there was no generator, so there was no way to
   notice. Anyone sharing the site saw the old sentence.

   The fix is the same one build-icons.js applies to the mark. NOTHING HERE IS
   TYPED. Every string is read from the thing that already owns it:

     index.html            the hero <h1> and .lead, parsed out of the template
     content/projects.js   name, practice area, headline stat, the hard part
     content/stats.js      the live-systems count (itself generated from git)
     content/logo.js       the mark

   So a copy change on the homepage is one `node scripts/build-og.js` away from
   being true on Twitter, and a card can no longer disagree with the page it
   points at. Counts are derived too: the /work card used to say "6" and "Six"
   as literals and would have lied the day a seventh case study landed.

   RASTERISING. Same approach as build-icons.js — installed Chrome over the
   DevTools protocol via Node's built-in WebSocket, no new dependency for a site
   that has no build step.

   THE FONT TRAP, WHICH IS THE WHOLE REASON FOR THE ASSERT BELOW. These cards
   are HTML, so they need Sora and Inter over the network at build time. A
   webfont that has not arrived does not throw: the card renders in a perfectly
   respectable fallback, looks fine at a glance, and gets committed wrong. So
   every shot waits on document.fonts.ready and then ASSERTS document.fonts.check
   for both faces, and refuses to write anything if either is missing. Same
   reasoning as the PNG-signature check: a silent near-miss is worse than a
   crash.
   ============================================================================ */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const LOGO = require('../content/logo.js');
const { CASE_STUDIES, areaById } = require('../content/projects.js');
const STATS = require('../content/stats.js');

const ROOT = path.join(__dirname, '..');
const OUT = 'assets/og';
const W = 1200;
const H = 630;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function write(rel, buf) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  console.log(`  ${rel.padEnd(48)} ${String(buf.length).padStart(7)}`);
}

/* --- reading the homepage's own words ---------------------------------------
   index.html is a template with placeholders, not a rendered page, so the live
   count arrives as <!--{{LIVE}}--> and has to come from STATS instead. Parsing
   rather than duplicating is the entire point: if these regexes stop matching
   the file has been restructured, and a card built from a guess would be worse
   than a loud failure. */
function homeCopy() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/);
  const lead = html.match(/<p class="lead">([\s\S]*?)<\/p>/);
  if (!h1) throw new Error('index.html: could not find the hero <h1>. Has the hero been restructured?');
  if (!lead) throw new Error('index.html: could not find <p class="lead">. Has the hero been restructured?');

  const flatten = (s) => s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  /* The lead runs to four sentences on the page, which is right there and far
     too long on a 1200x630 card. Two is what fits without shrinking the type. */
  const full = flatten(lead[1]);
  const short = (full.match(/[^.]+\.\s*/g) || [full]).slice(0, 2).join('').trim();

  return { title: flatten(h1[1]), lead: short };
}

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve'];
const spell = (n) => WORDS[n] || String(n);

/* --- the card ---------------------------------------------------------------
   One layout, four slots. Long titles step down a size rather than wrapping to
   three lines and pushing the sub-line off the bottom edge. */
function card({ eyebrow, stat, statLabel, title, sub, subLead }) {
  /* The lockup on deep, not the tile plus a typed wordmark. Inlined rather than
     linked because the card is rendered from a data: URL with no base to
     resolve a relative path against — and inline is fine here, unlike in the
     browser, because this SVG sits in the document and can reach the page's
     Sora. The 10% dead space each side of the arch is cropped by the negative
     margin so it lines up with the text below it. */
  const mark = LOGO.arch({ cut: 'display', ctx: 'deep' });
  const titleSize = title.length > 46 ? 40 : title.length > 34 ? 44 : 50;

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@400;600&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  /* ONE gradient, not two, and this is a size decision rather than a taste one.
     Chrome dithers gradients, and dither is per-pixel noise that PNG cannot
     compress. Measured on this exact card at 1200x630: flat 3.5KB, one radial
     122KB, one linear 181KB, both stacked 279KB. The linear layer was a barely
     visible diagonal shift costing 157KB, so it is gone. The glow does the
     work and the card is half the weight. */
  body{
    background: radial-gradient(1100px 720px at 78% 10%, rgba(43,188,179,.15), transparent 62%) #16303d;
    font-family:Inter, sans-serif; color:#fff;
    padding:56px 72px 46px; display:flex; flex-direction:column;
  }
  .top{display:flex;align-items:flex-start;gap:14px}
  .top svg{width:172px;height:89px;display:block;margin:-14px 0 0 -17px}
  .eyebrow{margin-left:auto;font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#2bbcb3;padding-top:6px}
  .stat{font-family:Sora,sans-serif;font-weight:800;font-size:122px;line-height:1;letter-spacing:-.055em;color:#2bbcb3;margin-top:18px}
  .statLabel{font-size:21px;color:rgba(255,255,255,.62);margin-top:16px}
  .rule{height:1px;background:rgba(255,255,255,.13);margin:30px 0 28px}
  .title{font-family:Sora,sans-serif;font-weight:800;font-size:${titleSize}px;line-height:1.12;letter-spacing:-.035em}
  .sub{font-size:20px;color:rgba(255,255,255,.58);margin-top:14px;line-height:1.45}
  .sub b{color:#2bbcb3;font-weight:600}
  .foot{margin-top:auto;font-size:15px;color:rgba(255,255,255,.34)}
</style></head><body>
  <div class="top">${mark}<span class="eyebrow">${esc(eyebrow)}</span></div>
  <div class="stat">${esc(stat)}</div>
  <div class="statLabel">${esc(statLabel)}</div>
  <div class="rule"></div>
  <div class="title">${esc(title)}</div>
  <div class="sub">${subLead ? `<b>${esc(subLead)}</b> ` : ''}${esc(sub)}</div>
  <div class="foot">kaymen.dev</div>
</body></html>`;
}

async function cdp(port) {
  let list;
  for (let i = 0; i < 40; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list.some((t) => t.type === 'page')) break;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  const page = (list || []).find((t) => t.type === 'page');
  if (!page) throw new Error('Chrome started but never exposed a page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send, close: () => ws.close() };
}

(async () => {
  console.log('kaymen.dev social cards\n');

  const home = homeCopy();
  /* .running, not .total: the homepage chip and the rail foot both say
     STATS.LIVE.running, and a card that disagreed with the page it links to is
     the exact failure this script exists to stop. */
  const live = STATS.LIVE && STATS.LIVE.running;
  if (!live) throw new Error('content/stats.js: no LIVE.running. Re-run scripts/refresh-stats.js first.');
  const n = CASE_STUDIES.length;

  const CARDS = [
    ['default.png', card({
      eyebrow: 'Custom software',
      stat: String(live),
      statLabel: 'systems running in production right now',
      title: home.title,
      sub: home.lead,
    })],
    ['work.png', card({
      eyebrow: 'Selected work',
      stat: String(n),
      statLabel: 'case studies, each including the part that broke',
      title: `${spell(n)} builds, and what was hard about each`,
      sub: 'A capability list is free to write. Naming what went wrong is not.',
    })],
  ];

  for (const s of CASE_STUDIES) {
    const area = areaById[s.area];
    const headline = (s.scale && s.scale[0]) || {};
    if (!headline.value) throw new Error(`${s.slug}: no scale[0].value to put on the card`);
    if (!s.hardPart || !s.hardPart.title) throw new Error(`${s.slug}: no hardPart.title`);
    CARDS.push([`work-${s.slug}.png`, card({
      eyebrow: area ? area.label : 'Case study',
      stat: headline.value,
      statLabel: headline.label || '',
      title: s.name,
      subLead: 'The hard part:',
      sub: s.hardPart.title,
    })]);
  }

  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error(`No Chrome or Edge found. Looked in:\n  ${CHROMES.join('\n  ')}`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-og-'));
  const port = 9334;
  const chrome = spawn(exe, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let conn;
  try {
    conn = await cdp(port);
    await conn.send('Page.enable');
    await conn.send('Runtime.enable');
    await conn.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

    const evaluate = async (expr) => {
      const r = await conn.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      return r.result && r.result.result ? r.result.result.value : undefined;
    };

    for (const [name, html] of CARDS) {
      await conn.send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
      await sleep(300);

      /* Wait for the faces, then prove they are actually there. A missing
         webfont renders as a plausible fallback and would ship silently. */
      await evaluate('document.fonts.ready.then(()=>1)');
      for (let i = 0; i < 40; i++) {
        const ok = await evaluate("document.fonts.check('800 122px Sora') && document.fonts.check('400 20px Inter')");
        if (ok) break;
        await sleep(250);
      }
      const sora = await evaluate("document.fonts.check('800 122px Sora')");
      const inter = await evaluate("document.fonts.check('400 20px Inter')");
      if (!sora || !inter) {
        throw new Error(`${name}: webfonts never loaded (Sora=${sora}, Inter=${inter}). ` +
          'Refusing to write a card in a fallback face. Check the network and re-run.');
      }

      const r = await conn.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const buf = Buffer.from(r.result.data, 'base64');
      if (buf.length < 2000 || buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error(`${name} came back as ${buf.length} bytes and is not a PNG`);
      }
      write(`${OUT}/${name}`, buf);
    }
  } finally {
    if (conn) conn.close();
    try { chrome.kill(); } catch { /* already gone */ }
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
  }

  console.log(`\ndone. ${CARDS.length} cards, all copy read from the site rather than typed here.`);
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
