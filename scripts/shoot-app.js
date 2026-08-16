/* ============================================================================
   kaymen.dev — capture a back-end screenshot for the running-board strip

     node scripts/shoot-app.js --url=http://127.0.0.1:8140/admin --out=assets/shots/thrive.jpg

   WHY THIS EXISTS. The three shots in `SHOTS` (server/render.js) were taken by
   hand, and nothing recorded how. That is the same failure build-og.js was
   written to fix: an asset nobody can regenerate is an asset that goes stale and
   stays stale, because re-making it means rediscovering the recipe first.

   IT ALSO EXISTS FOR A PRIVACY REASON, WHICH MATTERS MORE. These are CLIENT back
   ends. BridgeMTG holds real borrowers, Horse & Harmony real riders, and the
   Thrive screenshot Ohav sent contained six real student names, three real
   intake rows, a staff member and a university. Naming consent covers the CLIENT,
   never the PEOPLE INSIDE their system. So every shot in the strip is taken
   against a LOCAL, FRESHLY SEEDED database of invented data — never a production
   URL, never a dev database that has been synced from production. The per-app
   recipes (which seed command, which port) are in HANDOFF-FRONTEND-2026-08-16.md.

   THE DOWNSCALE. The strip renders at 900x562 and the existing three files are
   exactly that. Capturing at 900 CSS px would trigger every tablet breakpoint in
   the app and photograph a layout no user of a back office ever sees, so we
   render at 1440x899 (the same 1.6:1) and downscale in a canvas with
   imageSmoothingQuality:'high'. Chrome's fractional deviceScaleFactor would do
   it in one step but resamples visibly worse on small UI text, which is most of
   what a back office is.

   RASTERISING. Installed Chrome over the DevTools protocol via Node's built-in
   WebSocket — same as build-icons.js and build-og.js, no new dependency.
   ============================================================================ */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');

/** CSS pixels we render at, and the file size the strip actually uses. */
const CSS_W = 1440;
const CSS_H = 899;
const OUT_W = 900;
const OUT_H = 562;
const QUALITY = 0.86;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

/* ---------------------------------------------------------------- arguments */

const args = {};
const repeat = { fill: [], click: [], hide: [] };
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (!m) continue;
  const [, k, v = 'true'] = m;
  if (k in repeat) repeat[k].push(v);
  else args[k] = v;
}

if (!args.url || !args.out) {
  console.error(`
usage: node scripts/shoot-app.js --url=<url> --out=<file.jpg> [options]

  --url=            page to photograph (a LOCAL, SEEDED instance — never prod)
  --out=            output path, written as a ${OUT_W}x${OUT_H} JPEG
  --login-url=      visit and sign in here first
  --fill=SEL::VALUE typed into SEL with real key events (repeatable)
  --click=SEL       clicked, in order, after the fills (repeatable)
  --hide=SEL        display:none before capture, e.g. a cookie bar (repeatable)
  --wait=SEL        wait for this selector before capturing
  --settle=MS       extra pause before capture (default 1200)
  --scroll=PX       scroll down this far before capturing
  --scroll-to=SEL   scroll this element to the top of the shot
`);
  process.exit(1);
}

const OUT = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
const SETTLE = Number(args.settle ?? 1200);

/* --------------------------------------------------------------------- cdp */

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
  const exe = CHROMES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error(`No Chrome or Edge found. Looked in:\n  ${CHROMES.join('\n  ')}`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-shot-'));
  const port = 9336;
  const chrome = spawn(exe, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let conn;
  try {
    conn = await cdp(port);
    await conn.send('Page.enable');
    await conn.send('Runtime.enable');
    await conn.send('Network.enable');
    /* Headless pages are never "focused", so Input.* events are delivered to
       nothing and every field stays empty. This is the switch that makes typing
       work at all. */
    await conn.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await conn.send('Emulation.setDeviceMetricsOverride', {
      width: CSS_W, height: CSS_H, deviceScaleFactor: 1, mobile: false,
    });

    const evalJs = async (expression) => {
      const r = await conn.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      });
      if (r.result?.exceptionDetails) {
        throw new Error(`page threw: ${r.result.exceptionDetails.text}`);
      }
      return r.result?.result?.value;
    };

    /* Navigation is only half done when Page.navigate resolves; wait for the
       document to actually be interactive or every later selector races it. */
    const go = async (url) => {
      await conn.send('Page.navigate', { url });
      for (let i = 0; i < 80; i++) {
        const state = await evalJs('document.readyState');
        if (state === 'interactive' || state === 'complete') return;
        await sleep(250);
      }
      throw new Error(`never finished loading: ${url}`);
    };

    const waitFor = async (sel, label = sel) => {
      for (let i = 0; i < 80; i++) {
        const ok = await evalJs(`!!document.querySelector(${JSON.stringify(sel)})`);
        if (ok) return;
        await sleep(250);
      }
      throw new Error(`timed out waiting for ${label}`);
    };

    if (args['login-url']) {
      console.log(`  sign in  ${args['login-url']}`);
      await go(args['login-url']);
      await sleep(600);
    } else {
      console.log(`  open     ${args.url}`);
      await go(args.url);
    }

    /* TYPE, don't assign. `el.value = x` fills the box on screen but leaves
       React's useState and Livewire's component state empty, so the form submits
       blank and the submit button stays disabled — the shot that follows is a
       photograph of a login screen. Both frameworks track the REAL input event,
       so drive the renderer with Input.insertText and let the page react as it
       would to a person. The native-setter fallback is only for inputs that
       refuse focus (readonly-until-clicked date pickers and the like). */
    const fillOnce = async () => {
      for (const spec of repeat.fill) {
        const sep = spec.indexOf('::');
        const sel = spec.slice(0, sep);
        const value = spec.slice(sep + 2);
        await waitFor(sel, `field ${sel}`);

        await evalJs(`(() => {
          const el = document.querySelector(${JSON.stringify(sel)});
          el.scrollIntoView({ block: 'center' });
          el.focus();
          el.select && el.select();
        })()`);
        await conn.send('Input.insertText', { text: value });

        let got = await evalJs(`document.querySelector(${JSON.stringify(sel)}).value`);
        if (!got) {
          await evalJs(`(() => {
            const el = document.querySelector(${JSON.stringify(sel)});
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
            setter.call(el, ${JSON.stringify(value)});
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          })()`);
          got = await evalJs(`document.querySelector(${JSON.stringify(sel)}).value`);
        }
        if (!got) throw new Error(`filled ${sel} but it read back empty`);

        await evalJs(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new Event('change', { bubbles: true }))`);
      }
      if (repeat.fill.length) await sleep(900); // let the framework round-trip the state
    };

    const enabled = async (sel) => evalJs(`!document.querySelector(${JSON.stringify(sel)}).disabled`);

    /* Typing into a server-rendered form BEFORE it hydrates fills the DOM and
       nothing else: React mounts afterwards with its own empty state and the
       submit button stays disabled forever. There is no reliable cross-framework
       "hydrated yet?" signal, so type, look at the button, and type again. */
    const gate = repeat.click[0];
    for (let attempt = 1; attempt <= 4; attempt++) {
      await fillOnce();
      if (!gate || await enabled(gate)) break;
      if (attempt === 4) {
        throw new Error(`${gate} never stopped being disabled — the form never accepted the fills`);
      }
      console.log(`  retry    form not hydrated yet (attempt ${attempt})`);
      await sleep(1500);
    }

    for (const sel of repeat.click) {
      await waitFor(sel, `click target ${sel}`);
      for (let i = 0; i < 40 && !(await enabled(sel)); i++) await sleep(250);
      await evalJs(`document.querySelector(${JSON.stringify(sel)}).click()`);
      await sleep(2500);
    }

    if (args['login-url']) {
      /* Signing in is the step that fails silently — a wrong password just
         re-renders the form, and the shot that follows is a photograph of a
         login screen. Refuse to continue unless we actually left it. */
      const here = await evalJs('location.href');
      if (/\/login\b/.test(String(here))) {
        const err = await evalJs(`(document.body.innerText.match(/^.*(invalid|incorrect|do not match|credentials).*$/im) || [''])[0].trim()`);
        throw new Error(`still on the login page after signing in${err ? ` — "${err}"` : ''}`);
      }
      console.log(`  open     ${args.url}`);
      await go(args.url);
    }

    if (args.wait) await waitFor(args.wait);
    if (args['scroll-to']) {
      await waitFor(args['scroll-to']);
      await evalJs(`(() => {
        const el = document.querySelector(${JSON.stringify(args['scroll-to'])});
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: 'instant' });
      })()`);
      await sleep(700); // reveal-on-scroll animations
    }
    if (args.scroll) {
      await evalJs(`window.scrollTo(0, ${Number(args.scroll)})`);
      await sleep(400);
    }

    for (const sel of repeat.hide) {
      await evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).forEach(n => n.style.display='none')`);
    }

    /* Webfonts and lazy chrome (charts, avatars) land after readyState, and a
       shot taken before them is the half-drawn one nobody notices until it is
       committed — the same trap build-og.js asserts its way out of. */
    await evalJs('document.fonts ? document.fonts.ready.then(() => true) : true');
    await sleep(SETTLE);

    const shot = await conn.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const raw = shot.result?.data;
    if (!raw) throw new Error('captureScreenshot returned nothing');

    /* Downscale in-page: a canvas at high smoothing quality beats anything a
       fractional deviceScaleFactor does to 12px table text. */
    await go('about:blank');
    const jpeg = await evalJs(`(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,${raw}';
      await img.decode();
      const c = document.createElement('canvas');
      c.width = ${OUT_W}; c.height = ${OUT_H};
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, ${OUT_W}, ${OUT_H});
      return c.toDataURL('image/jpeg', ${QUALITY}).split(',')[1];
    })()`);

    const buf = Buffer.from(jpeg, 'base64');

    /* Assert the file really is a JPEG at the strip's exact size. A silent
       near-miss here is a blurry or letterboxed card on the homepage, and the
       markup hard-codes width=900 height=562 so nothing downstream would flag
       it — same reasoning as the PNG colour-type check in build-icons.js. */
    if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('output is not a JPEG');
    let i = 2, w = 0, h = 0;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    if (w !== OUT_W || h !== OUT_H) throw new Error(`expected ${OUT_W}x${OUT_H}, got ${w}x${h}`);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, buf);
    console.log(`  wrote    ${path.relative(ROOT, OUT)}  ${w}x${h}  ${(buf.length / 1024).toFixed(0)}KB\n`);
  } finally {
    if (conn) conn.close();
    chrome.kill();
    /* Chrome holds its profile open for a moment after kill(), so an immediate
       delete throws EPERM on Windows and fails a run whose output is already
       written. Retry briefly, then leave it to the temp directory. */
    for (let i = 0; i < 20; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch { await sleep(150); }
    }
  }
})().catch((e) => {
  console.error(`\nshoot-app.js failed: ${e.message}\n`);
  process.exit(1);
});
