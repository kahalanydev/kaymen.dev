/**
 * Builds a SINGLE self-contained HTML mockup of the whole marketing site.
 *
 * Why one file: the review UI serves one file per tokenised URL with no
 * siblings, so anything with a relative path (styles.css, script.js, favicon)
 * silently 404s. Everything is inlined — the only external requests are Google
 * Fonts, which are absolute URLs and load fine.
 *
 * Why generated rather than hand-authored: the mockup renders through the same
 * server/render.js the real site uses, so it cannot drift from what would
 * actually ship. Reviewing it is reviewing the implementation.
 *
 *   node scripts/build-mockup.js
 */
const fs = require('fs');
const path = require('path');
const { homeSections, workIndexPage, caseStudyPage } = require('../server/render');
const { CASE_STUDIES, areaById } = require('../content/projects');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const CSS = read('styles.css') + '\n' + read('assets/demos.css');
const JS = read('script.js') + '\n;\n' + read('assets/demos.js');
const FAVICON = 'data:image/svg+xml;base64,' + Buffer.from(read('favicon.svg')).toString('base64');

/**
 * Turn a rendered page into a standalone document.
 *
 * CSS and JS are NOT inlined per page — eight copies of a 2,600-line
 * stylesheet made the file 776kB, and this gets opened on a phone. Each page
 * gets a marker the shell substitutes once, at the moment it fills the iframe.
 */
function selfContain(html) {
  return html
    .replace(/<link rel="stylesheet" href="\/?styles\.css">/, '<!--STYLE-->')
    .replace(/\s*<link rel="stylesheet" href="\/?assets\/demos\.css">/, '')
    .replace(/<script src="\/?script\.js"><\/script>/, '<!--SCRIPT-->')
    .replace(/\s*<script src="\/?assets\/demos\.js"><\/script>/, '')
    // Analytics has no endpoint inside a mockup — drop it rather than let it
    // throw on every page view.
    .replace(/\s*<script src="\/?tracker\.js"[^>]*><\/script>/, '')
    .replace(/href="\/?favicon\.svg"/g, `href="${FAVICON}"`)
    // OG images aren't rendered visually; the tags stay but must not 404-fetch.
    .replace(/<meta property="og:image"[^>]*>\s*/g, '')
    .replace(/<meta name="twitter:image"[^>]*>\s*/g, '');
}

/* --- collect every page ---------------------------------------------------- */

const homeTemplate = read('index.html');
if (!homeTemplate.includes('<!--{{WORK}}-->')) {
  throw new Error('index.html is missing the <!--{{WORK}}--> placeholder');
}

const pages = [
  {
    id: 'home',
    label: 'Home',
    group: 'Site',
    path: '/',
    html: homeTemplate.replace('<!--{{WORK}}-->', () => homeSections()),
  },
  { id: 'work', label: 'Work index', group: 'Site', path: '/work', html: workIndexPage() },
  ...CASE_STUDIES.map((s) => ({
    id: s.slug,
    label: s.name,
    group: areaById[s.area]?.label || 'Case studies',
    path: `/work/${s.slug}`,
    html: caseStudyPage(s.slug),
  })),
].map((p) => ({ ...p, html: selfContain(p.html) }));

/* --- the mockup shell ------------------------------------------------------ */

// JSON.stringify does not escape "/", so a literal </script> inside a page
// would close the shell's script block early. Escape it.
const escClose = (s) => s.replace(/<\/script>/gi, '<\\/script>');

const payload = escClose(
  JSON.stringify(pages.map(({ id, label, group, path: p, html }) => ({ id, label, group, path: p, html })))
);
// Shared once, substituted into each page as it is shown.
const cssPayload = JSON.stringify(CSS);
const jsPayload = escClose(JSON.stringify(JS));

const groups = [...new Set(pages.map((p) => p.group))];

const shell = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>kaymen.dev — site mockup</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--bar:#141418;--bar2:#1c1c21;--line:#2b2b31;--txt:#fafafa;--dim:#8b8b94;--accent:#3b82f6}
  html,body{height:100%}
  body{background:#08080a;color:var(--txt);
       font:14px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
       display:flex;flex-direction:column;overflow:hidden}
  header{background:var(--bar);border-bottom:1px solid var(--line);flex:none}
  .row{display:flex;align-items:center;gap:14px;padding:9px 14px;flex-wrap:wrap}
  .row+.row{border-top:1px solid var(--line)}
  .brand{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:13px;color:var(--dim);white-space:nowrap}
  .brand b{color:var(--accent);font-weight:400}
  .tag{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#facc15;
       border:1px solid #facc1544;background:#facc1514;padding:3px 8px;border-radius:100px;white-space:nowrap}
  nav{display:flex;gap:5px;flex-wrap:wrap;flex:1;min-width:0}
  button{font:inherit;cursor:pointer;border-radius:7px;border:1px solid var(--line);
         background:var(--bar2);color:var(--dim);padding:6px 11px;transition:.15s;white-space:nowrap}
  button:hover{color:var(--txt);border-color:#3f3f46}
  button[aria-current=true]{background:var(--accent);border-color:var(--accent);color:#fff}
  .grp{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#5b5b63;
       align-self:center;margin-left:6px}
  .grp:first-child{margin-left:0}
  .spacer{flex:1}
  .seg{display:flex;border:1px solid var(--line);border-radius:7px;overflow:hidden}
  .seg button{border:0;border-radius:0;padding:6px 12px}
  .seg button+button{border-left:1px solid var(--line)}
  .path{font-family:ui-monospace,monospace;font-size:12px;color:var(--dim);
        background:var(--bar2);border:1px solid var(--line);border-radius:7px;padding:6px 11px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
  main{flex:1;min-height:0;display:flex;justify-content:center;background:#08080a;padding:14px;overflow:auto}
  .frame{background:#000;border:1px solid var(--line);border-radius:10px;overflow:hidden;
         width:100%;max-width:100%;height:100%;transition:max-width .2s;box-shadow:0 20px 60px -20px #000}
  iframe{width:100%;height:100%;border:0;display:block;background:#09090b}
  @media (max-width:720px){ .path{display:none} .grp{display:none} }
</style>
</head>
<body>
<header>
  <div class="row">
    <span class="brand">{ kaymen<b>.</b>dev }</span>
    <span class="tag">Mockup — not live</span>
    <span class="spacer"></span>
    <span class="path" id="path">/</span>
    <div class="seg" id="widths">
      <button data-w="100%" aria-current="true">Desktop</button>
      <button data-w="834px">Tablet</button>
      <button data-w="414px">Phone</button>
    </div>
    <div class="seg" id="themes">
      <button data-t="dark" aria-current="true">Dark</button>
      <button data-t="light">Light</button>
    </div>
  </div>
  <div class="row"><nav id="nav"></nav></div>
</header>
<main><div class="frame" id="frame"><iframe id="view" title="Site preview"></iframe></div></main>

<script>
const PAGES = ${payload};
const SITE_CSS = ${cssPayload};
const SITE_JS = ${jsPayload};
const byId = Object.fromEntries(PAGES.map(p => [p.id, p]));
const view = document.getElementById('view');
const frame = document.getElementById('frame');
const nav = document.getElementById('nav');
const pathEl = document.getElementById('path');
let current = 'home';
let theme = 'dark';

// Build the page switcher, grouped.
let lastGroup = null;
for (const p of PAGES) {
  if (p.group !== lastGroup) {
    const g = document.createElement('span');
    g.className = 'grp'; g.textContent = p.group;
    nav.appendChild(g); lastGroup = p.group;
  }
  const b = document.createElement('button');
  b.textContent = p.label; b.dataset.id = p.id;
  b.onclick = () => show(p.id);
  nav.appendChild(b);
}

function show(id) {
  const p = byId[id];
  if (!p) return;
  current = id;
  pathEl.textContent = p.path;
  nav.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-current', String(b.dataset.id === id)));
  // Function replacements: CSS and JS can contain $& / $', which are special
  // when a replacement is passed as a string.
  view.srcdoc = p.html
    .replace('<!--STYLE-->', () => '<style>' + SITE_CSS + '<\\/style>')
    .replace('<!--SCRIPT-->', () => '<script>' + SITE_JS + '<\\/script>');
}

// Internal links inside the preview drive the switcher instead of 404ing.
// srcdoc inherits the parent origin, so the document is reachable.
view.addEventListener('load', () => {
  const doc = view.contentDocument;
  if (!doc) return;
  applyTheme();
  doc.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const hit = PAGES.find(p => p.path === href.split('#')[0]) ||
                (href.startsWith('#') ? null : PAGES.find(p => p.path === href));
    if (hit) { e.preventDefault(); show(hit.id); return; }
    if (href.startsWith('/#') ) {           // cross-page anchor -> home + hash
      e.preventDefault();
      show('home');
      const hash = href.slice(1);
      setTimeout(() => {
        const t = view.contentDocument.querySelector(hash);
        if (t) t.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return;
    }
    if (href === '/' ) { e.preventDefault(); show('home'); }
  });
});

function applyTheme() {
  const doc = view.contentDocument;
  if (!doc) return;
  if (theme === 'light') doc.documentElement.setAttribute('data-theme', 'light');
  else doc.documentElement.removeAttribute('data-theme');
}

document.getElementById('widths').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  frame.style.maxWidth = b.dataset.w;
  [...e.currentTarget.children].forEach(x => x.setAttribute('aria-current', String(x === b)));
};
document.getElementById('themes').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  theme = b.dataset.t;
  [...e.currentTarget.children].forEach(x => x.setAttribute('aria-current', String(x === b)));
  applyTheme();
};

show('home');
</script>
</body>
</html>`;

const out = path.join(ROOT, 'mockup', 'site-mockup.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, shell);

const kb = (n) => `${(n / 1024).toFixed(0)}kB`;
console.log(`${pages.length} pages -> ${out}  (${kb(Buffer.byteLength(shell))})`);
pages.forEach((p) => console.log(`   ${p.path.padEnd(40)} ${p.label}`));
