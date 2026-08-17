/* ============================================================================
   kaymen.dev — write the LinkedIn company page asset set

     node scripts/build-linkedin.js

   WHY THIS IS A GENERATOR AND NOT A FOLDER OF EXPORTS. The same argument as
   scripts/build-og.js: the OG cards were built by hand once and then drifted,
   and nobody noticed because there was no way to notice. A LinkedIn page is
   worse in that respect, because the artwork lives on someone else's server and
   nothing in this repo can even see it. So the files here are written from the
   things that already own them, and re-running this after a copy change is the
   whole maintenance story.

     content/logo.js       the mark (never redrawn, only required)
     index.html            the hero <h1>, parsed out of the template
     content/stats.js      the live-systems count and the band figures
     content/projects.js   case-study names, headline stats, the hard part

   NOTHING HERE IS TYPED that already exists somewhere else. The one exception
   is the LinkedIn-only prose (the eyebrow labels), which has no home elsewhere.

   THE THREE PLATFORM CONSTRAINTS THAT SHAPED THE ARTWORK. These are not taste,
   they are the reason the layouts look the way they do:

   1. THE COVER IS OVERLAPPED BY THE LOGO. On a company page the avatar tile
      sits at the bottom-left, on top of the banner. Anything drawn in the left
      ~200px is behind it. That is also why the banner does NOT carry the
      lockup: the mark is already on screen, 40px away, and showing it twice
      reads as a template nobody adjusted.

   2. MOBILE CROPS THE BANNER TO THE CENTRE 900px. 114px comes off each side.
      Combined with (1), the honest safe band is x = 232 .. 1010 of 1128, and
      every element in the cover is inside it.

   3. THE AVATAR IS SEEN AT 48px, NOT AT 300px. The upload is 300x300 but the
      feed draws it at about 48 and search at about 56. assets/brand/README.md
      fixes the boundary at 48: at or under it, three stones and no wordmark.
      So the page logo is the SMALL cut even though the file is large, which is
      the opposite of what the filename suggests and is the single easiest
      thing to get wrong here.

   RASTERISING. Installed Chrome over the DevTools protocol via Node's built-in
   WebSocket — no new dependency for a site with no build step. Same font
   assertion as build-og.js: a webfont that has not arrived renders as a
   plausible fallback and would ship silently, so every shot proves both faces
   are live before it is written.
   ============================================================================ */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const LOGO = require('../content/logo.js');
const { CASE_STUDIES, areaById } = require('../content/projects.js');
const STATS = require('../content/stats.js');

const ROOT = path.join(__dirname, '..');
const OUT = 'assets/social/linkedin';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const ACCENT = LOGO.ACCENT;
const DEEP = LOGO.DEEP;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function write(rel, buf) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  console.log(`  ${rel.padEnd(52)} ${String(buf.length).padStart(7)}`);
}

/* --- the homepage's own words -----------------------------------------------
   Parsed, not duplicated, exactly as build-og.js does it. The <h1> arrives with
   its <s> and <span> intact because the banner reproduces the strike and the
   accent word rather than flattening them to plain text — that headline IS the
   brand's one piece of motion and dropping it would make the banner a different
   sentence from the site. */
function heroHeadline() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/);
  if (!h1) throw new Error('index.html: could not find the hero <h1>. Has the hero been restructured?');
  const inner = h1[1].replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  /* Only the four tags the hero actually uses are allowed through. Anything
     else appearing here means the hero changed shape and the banner should
     fail loudly rather than render half a tag as text. */
  const stripped = inner.replace(/<\/?(?:br|s|span|b)\s*\/?>/g, '');
  if (/[<>]/.test(stripped)) {
    throw new Error(`index.html: the hero <h1> now contains markup this script does not handle: ${inner}`);
  }
  return inner;
}

/* --- shared chrome ----------------------------------------------------------
   One <head> for every shot. The glow is a single radial: build-og.js measured
   this exact trade at 1200x630 — flat 3.5KB, one radial 122KB, two layers
   279KB — and a second layer bought a barely visible diagonal shift for 157KB.
   One layer, and it is the same one the OG cards use so the two sets of
   artwork sit on an identical ground. */
const head = (w, h, extra) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@400;600;700&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{
    background: radial-gradient(${Math.round(w * 0.92)}px ${Math.round(h * 1.15)}px at 78% 8%, rgba(43,188,179,.16), transparent 62%) ${DEEP};
    font-family:Inter, sans-serif; color:#fff; -webkit-font-smoothing:antialiased;
  }
  /* The struck word, lifted from styles.css .hero h1 s: the word goes muted and
     an accent bar is drawn across it at 54% height, rotated -1.6deg. On deep the
     site's --muted (#5f6368) is far too dark to read, so the muting is done in
     white instead — same intent, correct ground. */
  .h1 s, .title s{text-decoration:none;position:relative;color:rgba(255,255,255,.5)}
  .h1 s::after, .title s::after{
    content:"";position:absolute;left:-2px;right:-2px;top:54%;height:.11em;
    background:${ACCENT};border-radius:3px;transform:rotate(-1.6deg);
  }
  .h1 span, .title span{color:${ACCENT}}
  ${extra}
</style></head><body>`;

/* --- the cover --------------------------------------------------------------
   1128x191, and everything inside x = 232..1010 for the two reasons in the
   header. Left is the hero headline verbatim; right is the live count, which is
   the one number on this page that keeps proving itself. */
function cover() {
  const live = STATS.LIVE && STATS.LIVE.running;
  if (!live) throw new Error('content/stats.js: no LIVE.running. Re-run scripts/refresh-stats.js first.');

  return head(1128, 191, `
    body{display:flex;align-items:center;padding:0 118px}
    .safe{display:flex;align-items:center;justify-content:space-between;width:100%;
          padding-left:114px;padding-right:0;gap:40px}
    .h1{font-family:Sora,sans-serif;font-weight:800;font-size:38px;line-height:1.12;
        letter-spacing:-.045em;white-space:nowrap}
    .right{text-align:right;flex:none}
    .count{display:flex;align-items:center;justify-content:flex-end;gap:10px;
           font-size:15px;font-weight:600;color:rgba(255,255,255,.82)}
    .dot{width:8px;height:8px;border-radius:50%;background:${ACCENT};flex:none;
         box-shadow:0 0 0 4px rgba(43,188,179,.18)}
    .count b{color:#fff;font-weight:700}
    .sub{font-size:13.5px;color:rgba(255,255,255,.42);margin-top:9px;letter-spacing:.01em}
  `) + `
  <div class="safe">
    <div class="h1">${heroHeadline()}</div>
    <div class="right">
      <div class="count"><span class="dot"></span><span><b>${esc(live)} systems</b> running in production right now</span></div>
      <div class="sub">Built and run by the same people · kaymen.dev</div>
    </div>
  </div>
</body></html>`;
}

/* --- the personal profile banner --------------------------------------------
   1584x396, and a different safe zone from the company cover rather than the
   same picture stretched. A personal profile puts a ~152px round avatar at the
   bottom-left and, on desktop, hangs the name block under it; on mobile the
   banner keeps roughly the centre. So the composition sits right of x=560 and
   above the lower third, which is the only region both layouts leave alone.

   It exists because a one-person shop's personal profile is seen far more than
   its company page — the posts go out under a person, and that is the header
   people land on. */
function profileBanner() {
  const live = STATS.LIVE && STATS.LIVE.running;
  const band = STATS.BAND || [];
  const commits = (band.find((b) => /commit/i.test(b.label || '')) || {}).value;

  return head(1584, 396, `
    body{display:flex;align-items:center;justify-content:flex-end;padding:0 92px 76px 0}
    .block{width:920px}
    .h1{font-family:Sora,sans-serif;font-weight:800;font-size:56px;line-height:1.1;
        letter-spacing:-.045em}
    .row{display:flex;align-items:center;gap:26px;margin-top:26px}
    .count{display:flex;align-items:center;gap:11px;font-size:17px;font-weight:600;
           color:rgba(255,255,255,.84)}
    .dot{width:9px;height:9px;border-radius:50%;background:${ACCENT};flex:none;
         box-shadow:0 0 0 5px rgba(43,188,179,.18)}
    .count b{color:#fff;font-weight:700}
    .pipe{width:1px;height:18px;background:rgba(255,255,255,.18)}
    .m{font-size:17px;color:rgba(255,255,255,.5)}
  `) + `
  <div class="block">
    <div class="h1">${heroHeadline()}</div>
    <div class="row">
      <div class="count"><span class="dot"></span><span><b>${esc(live)} systems</b> in production</span></div>
      <div class="pipe"></div>
      <div class="m">${commits ? `${esc(commits)} commits in 12 months` : 'Built and run by the same people'}</div>
      <div class="pipe"></div>
      <div class="m">kaymen.dev</div>
    </div>
  </div>
</body></html>`;
}

/* --- post cards -------------------------------------------------------------
   1200x627. Deliberately the OG card layout at LinkedIn's aspect ratio rather
   than a new design: someone who clicks through from a post to the site should
   not feel they have changed brands. Long titles step down a size instead of
   wrapping to three lines and pushing the sub-line off the bottom. */
/* `titleHtml` renders instead of the escaped title where the headline carries
   the hero's own <s> and <span> — `title` is still required in that case and is
   the plain-text version, because the size step below has to measure the words
   rather than the tags. */
function postCard({ eyebrow, stat, statLabel, title, titleHtml, sub, subLead }) {
  const mark = LOGO.arch({ cut: 'display', ctx: 'deep' });
  const titleSize = title.length > 46 ? 40 : title.length > 34 ? 44 : 50;

  return head(1200, 627, `
    body{padding:54px 72px 44px; display:flex; flex-direction:column}
    .top{display:flex;align-items:flex-start;gap:14px}
    .top svg{width:172px;height:89px;display:block;margin:-14px 0 0 -17px}
    .eyebrow{margin-left:auto;font-size:13px;font-weight:600;letter-spacing:.16em;
             text-transform:uppercase;color:${ACCENT};padding-top:6px;text-align:right}
    .stat{font-family:Sora,sans-serif;font-weight:800;font-size:118px;line-height:1;
          letter-spacing:-.055em;color:${ACCENT};margin-top:14px}
    .statLabel{font-size:21px;color:rgba(255,255,255,.62);margin-top:14px}
    .rule{height:1px;background:rgba(255,255,255,.13);margin:28px 0 26px}
    .title{font-family:Sora,sans-serif;font-weight:800;font-size:${titleSize}px;
           line-height:1.12;letter-spacing:-.035em}
    .sub{font-size:20px;color:rgba(255,255,255,.58);margin-top:14px;line-height:1.45}
    .sub b{color:${ACCENT};font-weight:600}
    .foot{margin-top:auto;font-size:15px;color:rgba(255,255,255,.34)}
  `) + `
  <div class="top">${mark}<span class="eyebrow">${esc(eyebrow)}</span></div>
  <div class="stat">${esc(stat)}</div>
  <div class="statLabel">${esc(statLabel)}</div>
  <div class="rule"></div>
  <div class="title">${titleHtml || esc(title)}</div>
  <div class="sub">${subLead ? `<b>${esc(subLead)}</b> ` : ''}${esc(sub)}</div>
  <div class="foot">kaymen.dev</div>
</body></html>`;
}

/* A case study's card, built from the case study rather than from a copy of it.
   Same three fields the OG cards use, so /work/<slug> and the LinkedIn post
   about it cannot end up claiming different numbers. */
function studyCard(slug, eyebrow) {
  const s = CASE_STUDIES.find((c) => c.slug === slug);
  if (!s) throw new Error(`content/projects.js: no case study with slug "${slug}"`);
  const headline = (s.scale && s.scale[0]) || {};
  if (!headline.value) throw new Error(`${slug}: no scale[0].value to put on the card`);
  if (!s.hardPart || !s.hardPart.title) throw new Error(`${slug}: no hardPart.title`);
  const area = areaById[s.area];
  return postCard({
    eyebrow: eyebrow || (area ? area.label : 'Case study'),
    stat: headline.value,
    statLabel: headline.label || '',
    title: s.hardPart.title,
    subLead: 'The build:',
    sub: s.name,
  });
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
  console.log('kaymen.dev LinkedIn assets\n');

  const live = STATS.LIVE && STATS.LIVE.running;
  const apps = (STATS.STORE_APPS || []).length;

  const heroLine = heroHeadline().replace(/<br\s*\/?>/gi, ' ');
  const heroPlain = heroLine.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  /* HTML shots: the banner and the post cards. */
  const SHOTS = [
    ['li-cover-1128x191.png', cover(), 1128, 191],
    ['li-profile-banner-1584x396.png', profileBanner(), 1584, 396],

    /* Post 1 — the page exists and here is what it is for. The headline keeps
       its strike, so the launch card and the banner are visibly the same
       sentence; one line here rather than the hero's two, because the card is
       landscape and a <br> would leave a short second line hanging. */
    ['li-post-1-launch.png', postCard({
      eyebrow: 'Custom software',
      stat: String(live),
      statLabel: 'systems running in production right now',
      title: heroPlain,
      titleHtml: heroLine,
      sub: 'Five subscriptions, each doing half a job, and you own none of it. We build the one system that does all of it.',
    }), 1200, 627],

    /* Post 2 — proof, led by the hard part rather than the capability. A
       capability list is free to write; naming what went wrong is not. */
    ['li-post-2-hardpart.png', studyCard('multi-campus-engagement-platform'), 1200, 627],

    /* Post 3 — the apps, because "we also ship native" is the thing people are
       most surprised by and it is the least visible on the site. */
    ['li-post-3-apps.png', postCard({
      eyebrow: 'Apps',
      stat: String(apps),
      statLabel: 'apps live in the App Store & Google Play',
      title: 'Shipping the first build is the easy half',
      sub: 'The hard half is every update after it: OTA releases that actually land on the installed base, and RTL that is not a translated afterthought.',
    }), 1200, 627],

    /* The weekly template. Rendered with its slots visible so the shape is
       obvious when it is filled in — this file is a guide, not a post. */
    ['li-post-template-shipped.png', postCard({
      eyebrow: 'Shipped · week of __',
      stat: '00',
      statLabel: 'what the number is',
      title: 'The one thing that was hard about it',
      subLead: 'The build:',
      sub: 'Which system it was, and who it is for.',
    }), 1200, 627],
  ];

  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error(`No Chrome or Edge found. Looked in:\n  ${CHROMES.join('\n  ')}`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-li-'));
  const port = 9335;
  const chrome = spawn(exe, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let conn;
  try {
    conn = await cdp(port);
    await conn.send('Page.enable');
    await conn.send('Runtime.enable');

    const evaluate = async (expr) => {
      const r = await conn.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      return r.result && r.result.result ? r.result.result.value : undefined;
    };

    for (const [name, html, w, h] of SHOTS) {
      await conn.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await conn.send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
      await sleep(300);

      await evaluate('document.fonts.ready.then(()=>1)');
      for (let i = 0; i < 40; i++) {
        const ok = await evaluate("document.fonts.check('800 38px Sora') && document.fonts.check('400 20px Inter')");
        if (ok) break;
        await sleep(250);
      }
      const sora = await evaluate("document.fonts.check('800 38px Sora')");
      const inter = await evaluate("document.fonts.check('400 20px Inter')");
      if (!sora || !inter) {
        throw new Error(`${name}: webfonts never loaded (Sora=${sora}, Inter=${inter}). ` +
          'Refusing to write artwork in a fallback face. Check the network and re-run.');
      }

      const r = await conn.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const buf = Buffer.from(r.result.data, 'base64');
      if (buf.length < 2000 || buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error(`${name} came back as ${buf.length} bytes and is not a PNG`);
      }
      write(`${OUT}/${name}`, buf);
    }

    /* ---- the avatar ----
       THE SMALL CUT, AT A LARGE SIZE. See constraint 3 in the header: the file
       is 300x300 because that is what LinkedIn asks for, but the picture is the
       one drawn for 48px, because that is where it is actually read.

       FULL BLEED, radius 0. The tile's own 7.4/32 corner would leave
       transparent corners that LinkedIn then rounds again, and a double-rounded
       tile reads as chewed. Letting the platform own the mask is the same
       decision the Android maskable icon makes. */
    const shootSvg = async (svg, px) => {
      const html = '<!doctype html><meta charset="utf-8">' +
        `<style>html,body{margin:0;padding:0;background:transparent}` +
        `svg{display:block;width:${px}px;height:${px}px}</style>` + svg;
      await conn.send('Emulation.setDeviceMetricsOverride', { width: px, height: px, deviceScaleFactor: 1, mobile: false });
      await conn.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
      await conn.send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
      await sleep(340);
      const r = await conn.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const buf = Buffer.from(r.result.data, 'base64');
      if (buf.length < 200 || buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error(`the ${px}px avatar came back as ${buf.length} bytes and is not a PNG`);
      }
      return buf;
    };

    write(`${OUT}/li-logo-300.png`, await shootSvg(LOGO.tile({ kind: 'deep', radius: 0 }), 300));
    /* Ohav's alternative, generated so the choice can be made by looking rather
       than by imagining: the name inside the arch. Correct at the 130px page
       header, a grey smear at the 48px feed avatar. */
    write(`${OUT}/li-logo-alt-lockup-300.png`, await shootSvg(
      LOGO.tileLockup({ embedFont: fs.readFileSync(path.join(ROOT, 'assets/brand/fonts/sora-700-latin.woff2')).toString('base64'), radius: 0 }), 300));
    /* A 48px proof of the recommended file, so "it survives the feed" is a
       thing that can be checked rather than asserted. */
    write(`${OUT}/li-logo-proof-48.png`, await shootSvg(LOGO.tile({ kind: 'deep', radius: 0 }), 48));
  } finally {
    if (conn) conn.close();
    try { chrome.kill(); } catch { /* already gone */ }
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
  }

  console.log('\ndone.');
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
