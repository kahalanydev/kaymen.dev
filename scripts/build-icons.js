/* ============================================================================
   kaymen.dev — write the whole brand asset set from content/logo.js

     node scripts/build-icons.js

   Two destinations, one source:

     ROOT           favicon.svg, apple-touch-icon.png, icon-192, icon-512.
                    These live at the paths browsers and manifests already ask
                    for and must not move.
     assets/brand/  the complete handoff package, including everything above
                    again, so the folder can be sent to another team on its own
                    without a list of things to also go and fetch.

   The duplication is deliberate and safe because both are written in the same
   run from the same functions. There is no copy step and no second drawing to
   forget about.

   WHY THE PNGs HAVE TO EXIST. index.html pointed apple-touch-icon at an SVG,
   and iOS ignores SVG there: it drops the tag and puts a screenshot of the page
   on the home screen instead. Android's maskable support for SVG is patchy the
   same way, Outlook renders mail through Word and does not draw SVG at all, and
   .ico is still what a bare /favicon.ico request wants.

   RASTERISING WITHOUT A DEPENDENCY. The one image tool on this machine belongs
   to the showcase harness, which is shared. Rather than reach into it or add
   playwright to a site with no build step, this drives installed Chrome over
   the DevTools protocol using Node's built-in WebSocket, and checks the PNG
   signature so a blank screenshot fails loudly instead of committing a broken
   icon.
   ============================================================================ */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const LOGO = require('../content/logo.js');

const ROOT = path.join(__dirname, '..');
const BRAND = 'assets/brand';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const WHITE = '#ffffff';
/* The lockup carries its own typeface. Without this the file renders in
   whatever the opening machine has, which is not a logo. */
const SORA = fs.readFileSync(path.join(ROOT, 'assets/brand/fonts/sora-700-latin.woff2')).toString('base64');
const lockup = (cut, ctx, live) => LOGO.arch({ cut, ctx, embedFont: SORA, live });
const DEEP = LOGO.DEEP;

function write(rel, body) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  const n = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
  console.log(`  ${rel.padEnd(42)} ${String(n).padStart(7)}`);
}

/* An .ico is a tiny container: a 6-byte header, one 16-byte directory entry per
   image, then the images. Every Windows version still in service accepts PNG
   payloads rather than BMP, so the entries are just the PNGs we already made.
   A width or height byte of 0 means 256. */
function ico(pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const dir = [], body = [];
  for (const { px, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(px >= 256 ? 0 : px, 0);
    e.writeUInt8(px >= 256 ? 0 : px, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e); body.push(buf);
  }
  return Buffer.concat([head, ...dir, ...body]);
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
  console.log('kaymen.dev brand assets\n');

  /* ---------------- vectors ---------------- */
  const tileDeep = LOGO.tile({ kind: 'deep' });
  const tileAccent = LOGO.tile({ kind: 'accent' });
  const stamp = '<!-- generated by scripts/build-icons.js from content/logo.js; do not hand-edit -->\n';

  /* Browsers draw this one at 16 to 32px in a tab strip, so it is the small
     cut even though it is a vector and could scale to anything. */
  write('favicon.svg', stamp + tileDeep + '\n');
  write('assets/mark.svg', LOGO.glyph({ keyFill: WHITE, flankFill: WHITE, flankOpacity: 0.62 }) + '\n');

  /* THE SITE'S OWN COPY, WHICH TAKES THE LIGHT. Identical geometry to
     kaymen-lockup.svg plus the keyframes that run the light down the course
     from the keystone out (see LIVE in content/logo.js).

     OUTSIDE assets/brand ON PURPOSE. That folder is the handoff package — it
     goes to other teams, print shops and the icon slots, and none of them want
     a logo that moves. The static file stays the canonical one; this is the
     marketing rail's copy and nothing else points at it. */
  write('assets/lockup-live.svg', stamp + lockup('display', undefined, true) + '\n');
  write('assets/lockup-live-text.svg', stamp + lockup('text', undefined, true) + '\n');

  const VECTORS = [
    ['kaymen-mark-tile.svg', tileDeep, 'the icon: deep tile, accent keystone'],
    ['kaymen-mark-tile-accent.svg', tileAccent, 'the icon on accent, for light surfaces'],
    ['kaymen-avatar-circle.svg', LOGO.tile({ kind: 'deep', radius: 16 }), 'circular avatar, for slots that crop to a circle'],
    ['kaymen-icon-large.svg', LOGO.tileLockup({ embedFont: SORA }), 'app icon 64px and up: the lockup on the tile'],
    ['kaymen-mark-white.svg', LOGO.glyph({ keyFill: WHITE, flankFill: WHITE, flankOpacity: 0.62 }), 'glyph only, white, transparent'],
    ['kaymen-mark-deep.svg', LOGO.glyph({ keyFill: LOGO.ACCENT, flankFill: DEEP, flankOpacity: 0.34 }), 'glyph only, for light backgrounds'],
    ['kaymen-mark-mono.svg', LOGO.glyph({ keyFill: 'currentColor', flankFill: 'currentColor', flankOpacity: 0.4 }), 'one colour: inherits currentColor, prints flat'],
    ['kaymen-lockup.svg', lockup('display'), 'signature, 140px and up, light background'],
    ['kaymen-lockup-white.svg', lockup('display', 'deep'), 'signature on deep'],
    ['kaymen-lockup-text.svg', lockup('text'), 'text cut, 56 to 140px'],
    ['kaymen-lockup-text-white.svg', lockup('text', 'deep'), 'text cut on deep'],
  ];
  for (const [name, svg] of VECTORS) write(`${BRAND}/${name}`, stamp + svg + '\n');

  /* ---------------- rasters ---------------- */
  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error(`No Chrome or Edge found. Looked in:\n  ${CHROMES.join('\n  ')}`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-icons-'));
  const port = 9333;
  const chrome = spawn(exe, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let conn;
  try {
    conn = await cdp(port);
    await conn.send('Page.enable');

    /* One page per shot, sized to the artwork, so nothing is ever resampled. */
    /* TRANSPARENCY IS A PROTOCOL CALL, NOT A CSS ONE. `background:transparent`
       on html/body does nothing for a screenshot: Chrome composites the frame
       onto its default white base, so every PNG here came out colour type 2
       with no alpha channel at all. It went unnoticed because most of these are
       tiles that fill their own square — but kaymen-lockup-white.png, the
       handoff asset for dark backgrounds, was a white logo flattened onto white
       and arrived essentially blank, and email-mark.png carried white corners
       onto the deep mail header. setDefaultBackgroundColorOverride with a=0 is
       what actually makes the base transparent. Verified below by asserting the
       IHDR colour type, so this cannot silently regress. */
    const shoot = async (svg, w, h, transparent, fullBleed) => {
      const html = '<!doctype html><meta charset="utf-8">' +
        `<style>html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#fff'}}` +
        `svg{display:block;width:${w}px;height:${h}px}</style>` + svg;
      await conn.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await conn.send('Emulation.setDefaultBackgroundColorOverride',
        transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
      await conn.send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
      await sleep(340);
      const r = await conn.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const buf = Buffer.from(r.result.data, 'base64');
      if (buf.length < 200 || buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error(`a ${w}x${h} shot came back as ${buf.length} bytes and is not a PNG`);
      }
      /* IHDR colour type lives at byte 25: 6 is truecolour+alpha, 2 is no alpha. */
      if (transparent && !fullBleed && buf[25] !== 6) {
        throw new Error(`a ${w}x${h} shot asked for transparency but came back colour type ${buf[25]} ` +
          '(2 = flattened on white). The background override did not take.');
      }
      return buf;
    };

    /* SQUARE ICONS, SPLIT BY SIZE. Ohav's call, and the split is by size
       rather than by purpose: three stones on the small icons, the name inside
       the arch on the large ones. 48 is the boundary because that is the last
       size where the wordmark would be under about 5px and reduce to a grey
       smear that makes the whole tile look out of focus.

       The large tiles embed the lockup itself rather than a redrawing of it,
       so the two cannot drift; verified below by checking the lockup's own
       path data appears verbatim in the tile. */
    const SMALL = [16, 32, 48];
    const LARGE = [64, 128, 180, 192, 512];
    const tileBig = LOGO.tileLockup({ embedFont: SORA });

    const bare = LOGO.arch({ cut: 'display', ctx: 'deep', bare: true });
    const reused = (bare.match(/d="[^"]+"/g) || []);
    if (!reused.length || !reused.every((d) => tileBig.includes(d))) {
      throw new Error('the large icon is not built from the lockup geometry any more');
    }

    const square = {};
    for (const px of SMALL) square[px] = await shoot(tileDeep, px, px, true);
    for (const px of LARGE) square[px] = await shoot(tileBig, px, px, true);

    write('apple-touch-icon.png', square[180]);
    write('icon-192.png', square[192]);
    write('icon-512.png', square[512]);

    /* MASKABLE IS A DIFFERENT PICTURE, not the same one relabelled. Android
       crops it to a centred circle of 80% diameter, so anything wider than
       that is cut off. The lockup tile's arch spans nearly the full width and
       would lose its springing stones; the three stones fit inside the safe
       circle with room, so the maskable slot uses the small cut on a full
       bleed tile. Both manifests point purpose:maskable here. */
    write('icon-maskable-512.png', await shoot(LOGO.tile({ kind: 'deep', radius: 0 }), 512, 512, true, true));
    for (const px of [...SMALL, ...LARGE]) write(`${BRAND}/kaymen-icon-${px}.png`, square[px]);

    /* /favicon.ico is still requested bare by crawlers, feed readers and
       Windows shortcuts, and it was 404ing on every one of them. */
    const icoBuf = ico([16, 32, 48].map((px) => ({ px, buf: square[px] })));
    write('favicon.ico', icoBuf);
    write(`${BRAND}/favicon.ico`, icoBuf);

    /* the mail header mark: accent tile at 2x, flattened onto nothing so it
       sits on the deep header band without a white box around it */
    write(`${BRAND}/email-mark.png`, await shoot(tileAccent, 60, 60, true));

    /* The mail header LOCKUP. Mail needs a raster because Outlook draws through
       Word and cannot render SVG at all, and it needs its own export because the
       shipped lockup carries 10% dead space either side of the arch (which spans
       x=20..180 of a 200-wide viewBox). Left-aligned in a header that has an
       eyebrow under it, that dead space reads as a misindented logo. Cropping
       the viewBox to the arch bounds is exact and costs nothing — the wordmark
       is centred at x=100 and ~85px wide, so it stays well inside. 2x. */
    const emailLockup = lockup('display', 'deep')
      .replace('viewBox="0 0 200 104"', 'viewBox="20 0 160 104"');
    write(`${BRAND}/email-lockup.png`, await shoot(emailLockup, 320, 208, true));

    /* lockups, at 3x the largest place they are used */
    const lock = (svg, w) => shoot(svg, w, Math.round(w * 0.52), true);
    write(`${BRAND}/kaymen-lockup.png`, await lock(lockup('display'), 900));
    write(`${BRAND}/kaymen-lockup-white.png`, await lock(lockup('display', 'deep'), 900));
  } finally {
    if (conn) conn.close();
    try { chrome.kill(); } catch { /* already gone */ }
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
  }

  /* ---------------- the note that travels with the folder ---------------- */
  write(`${BRAND}/README.md`, `# kaymen.dev brand assets

Generated. Do not hand-edit anything in this folder, and do not redraw the mark
in a design tool: it is defined by geometry in \`content/logo.js\` and every file
here is written from it in one pass by

    node scripts/build-icons.js

If a file needs to change, change the module and re-run. Editing an export means
the next run silently reverts it.

## What the mark is

A segmented arch with the keystone picked out in the accent. The keystone is the
wedge that holds an arch up: you own the building, we are the stone that keeps it
standing.

**The one rule.** The keystone is never shown on its own. A lone tapered block
reads as a cup, and taper is not what separates the two shapes, since a drinking
glass and a real voussoir taper within a few per cent of each other. Context is
what separates them. Always three stones or more.

## Which file to use

| Use | File |
|---|---|
| Favicon, modern browsers | \`../../favicon.svg\` (root) |
| Favicon, bare \`/favicon.ico\` requests | \`favicon.ico\` |
| iOS home screen | \`../../apple-touch-icon.png\` (root, 180px) |
| Android / PWA manifest | \`../../icon-192.png\`, \`../../icon-512.png\` (root) |
| App icon, 48px and under | \`kaymen-icon-{16,32,48}.png\` (three stones) |
| App icon, 64px and up | \`kaymen-icon-{64,128,180,192,512}.png\` (name in the arch) |
| Android maskable | \`../../icon-maskable-512.png\` (root) |
| In-app icon on a coloured tile | \`kaymen-mark-white.svg\` |
| Icon on a light background, no tile | \`kaymen-mark-deep.svg\` |
| Print, embroidery, stamps, one colour | \`kaymen-mark-mono.svg\` |
| Signature, 140px and up | \`kaymen-lockup.svg\` / \`-white.svg\` |
| Signature, 56 to 140px | \`kaymen-lockup-text.svg\` / \`-white.svg\` |
| Email header | \`email-lockup.png\` (cropped, 2x) |
| Email, where only the icon fits | \`email-mark.png\` |

## The size split, which is not negotiable

**48px and under: three stones only.** **64px and up: the name inside the**
**arch.** 48 is the boundary because below 64 the wordmark falls under about
5px and stops being type, becoming a grey smear that makes the whole tile look
out of focus.

The large tiles embed the lockup itself rather than a redrawing of it, so the
icon and the logo cannot drift. The build asserts this: it checks the lockup's
own path data appears verbatim inside the tile and fails if it does not.

**Android maskable is a different picture, not the same one relabelled.**
Android crops a maskable icon to a centred circle of 80% diameter. The lockup
tile's corners sit 14.5 units from centre on a 32 grid where the safe radius is
12.8, so it would lose its springing stones. The three stones reach only 10.7
and clear it, which is why \`icon-maskable-512.png\` uses the small cut on a full
bleed tile. Do not point \`purpose:maskable\` at \`icon-512.png\`.

## Sizes, because one drawing does not cover the range

- **140px and up** — \`kaymen-lockup.svg\`. Nine segments.
- **56 to 140px** — \`kaymen-lockup-text.svg\`. Five segments and a wider gap.
  Below 140 the display cut's gaps fall under one physical pixel and the arch
  fuses into a solid band.
- **40px and under** — the tile, no wordmark. Type inside the arch is unreadable
  at that size, and keeping it makes the whole thing look blurred.

These are three drawings, not one scaled. Do not substitute one for another.

## Colours

    accent   #2bbcb3
    deep     #16303d
    white    #ffffff

## Two traps

**SVG falls back to serif, not sans.** If the webfont has not loaded when the
lockup paints, the wordmark renders in Times while everything around it is Sora.
Request the face, wait for it, then draw. \`kaymen-lockup*.svg\` already carries a
fallback chain, but a page that redraws the lockup in script must wait as well.

**Outlook does not render SVG at all**, because it draws through Word, and Gmail
strips CSS background images. Email uses \`email-mark.png\` as a plain \`<img>\` for
this reason. Do not "improve" it to an inline SVG.

## Clear space and minimum size

Keep clear space of one pier width on all sides. Minimum size is 16px for the
tile and 56px wide for the text lockup. Do not recolour the keystone, do not
stretch either axis independently, and do not place the white mark on a light
background: use \`kaymen-mark-deep.svg\` instead.
`);

  console.log('\ndone.');
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
