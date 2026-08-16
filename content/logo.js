/* ============================================================================
   kaymen.dev — the mark

   One arch, drawn from one set of numbers, so the favicon and the social card
   cannot drift apart. Everything here is generated from `seg` and `course`:
   there are no hand-drawn path strings in this repo, and there should never be.

   THE SHAPE. A keystone is the wedge at the top of an arch, and the reason the
   first attempt failed is worth keeping written down, because it is not
   obvious. A lone tapered block is a cup. Taper does not distinguish the two
   objects at all: a drinking tumbler and a real voussoir taper within a few
   per cent of each other. What distinguishes them is context. Flanked by its
   neighbours the wedge is unmistakably one stone in a course; alone it is
   glassware. So the mark is always three stones, never one.

   THE TILE, AND WHY IT EXISTS. An arch is 2:1 and an icon slot is 1:1, so a
   bare arc can only ever occupy about a third of the height and it degrades to
   a smudge by 16px. That is a property of the shape and no amount of redrawing
   fixes it. Setting it on a filled tile solves the aspect outright, which is
   why `tile()` is the favicon and `markBare()` is only for places that already
   supply their own background.

   OPTICAL CUTS. 180 degrees split nine ways is a narrower wedge than split
   five ways, so the display and text cuts are siblings rather than one drawing
   scaled. That is deliberate. Below about 140px the three-degree gaps of the
   display cut fall under one physical pixel and the course fuses into a solid
   band, which is the failure this avoids.

   Consumed by scripts/build-icons.js (favicon and the PNG icons) and by the OG
   card generator in _tools/showcase. Requiring it is always better than copying
   a path out of it.
   ============================================================================ */

const ACCENT = '#2bbcb3';
const DEEP = '#16303d';
const WHITE = '#ffffff';

const r2 = (n) => Math.round(n * 100) / 100;

/* One voussoir: the area between two radii, bounded by two arcs.
   Angles are degrees from the springing line, so 180 is the left spring, 90
   the apex, 0 the right. Sweep is 1 going down in angle (left to right over
   the top) and 0 coming back along the inner edge. */
function seg(cx, cy, rIn, rOut, aHi, aLo, gap) {
  const a1 = aHi - gap / 2;
  const a2 = aLo + gap / 2;
  const P = (r, a) => {
    const t = (a * Math.PI) / 180;
    return [r2(cx + r * Math.cos(t)), r2(cy - r * Math.sin(t))];
  };
  const A = P(rOut, a1), B = P(rOut, a2), C = P(rIn, a2), D = P(rIn, a1);
  return `M${A[0]} ${A[1]}A${rOut} ${rOut} 0 0 1 ${B[0]} ${B[1]}` +
         `L${C[0]} ${C[1]}A${rIn} ${rIn} 0 0 0 ${D[0]} ${D[1]}Z`;
}

/* n segments across the half circle, left to right. n must be odd or there is
   no middle stone, and a course without a keystone is just an arch that has
   already fallen down. */
function course(cx, cy, rIn, rOut, n, gap) {
  if (n % 2 === 0) throw new Error(`course needs an odd segment count, got ${n}`);
  const w = 180 / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ d: seg(cx, cy, rIn, rOut, 180 - i * w, 180 - (i + 1) * w, gap), key: i === (n - 1) / 2, i });
  }
  return out;
}

const centreThree = (c) => c.filter((v) => Math.abs(v.i - (c.length - 1) / 2) <= 1);

/* THE ICON IS THE KEYSTONE AND ITS TWO NEIGHBOURS. Nothing else.

   This is Ohav's, and it is worth saying plainly that I twice replaced it with
   something I preferred and twice had to put it back. The first substitution
   was a gateway with piers, on the reasoning that three stones over empty space
   read as wings at 192px. The reasoning was not wrong. It was also not mine to
   act on: he had approved the three stones, and an icon that argues with the
   lockup is a worse problem than an icon that is quiet at large sizes.

   So: three stones, and the numbers below are the ones from the mockup he
   approved rather than anything re-derived. The ring is thicker than the
   lockup's on purpose, 6 against 12.5 rather than the lockup's 0.7 ratio,
   because a thin ring cropped to three segments disappears by 16px. That is an
   optical cut, the same argument as the segment counts, and it is the only
   liberty taken with the shape. */
const FAN = { cx: 16, cy: 24, rIn: 6, rOut: 12.5, n: 5, gap: 5.5 };

function fanPaths(opts = {}) {
  const keyFill = opts.keyFill || ACCENT;
  const flankFill = opts.flankFill || WHITE;
  const flankOpacity = opts.flankOpacity == null ? 0.42 : opts.flankOpacity;
  const { cx, cy, rIn, rOut, n, gap } = FAN;
  return centreThree(course(cx, cy, rIn, rOut, n, gap))
    .map((v) => v.key
      ? `<path d="${v.d}" fill="${keyFill}"/>`
      : `<path d="${v.d}" fill="${flankFill}" opacity="${flankOpacity}"/>`)
    .join('');
}

const glyphPaths = fanPaths;

/* The glyph alone, transparent, for anywhere that already draws its own tile
   (the rail, the sidebars, the login screens). */
function glyph(opts = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${glyphPaths(opts)}</svg>`;
}

/* The icon. `kind` picks which way round the colours run: 'deep' is the
   favicon and the app icon, 'accent' is for placing on a light surface. */
function tile(opts = {}) {
  const kind = opts.kind || 'deep';
  const px = opts.px;
  const size = px ? ` width="${px}" height="${px}"` : '';
  const bg = kind === 'accent' ? ACCENT : DEEP;
  /* 16 gives a circle, for the avatar slots that crop to one anyway. */
  const rx = opts.radius == null ? 7.4 : opts.radius;
  /* White on teal needs more weight than accent on deep: at 0.45 the masonry
     washed out to near invisible by 24px, which is most of the places the
     accent tile is actually used. */
  const paths = kind === 'accent'
    ? glyphPaths({ keyFill: WHITE, flankFill: WHITE, flankOpacity: 0.62 })
    : glyphPaths({ keyFill: ACCENT, flankFill: WHITE, flankOpacity: 0.42 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${size}>` +
         `<rect width="32" height="32" rx="${rx}" fill="${bg}"/>${paths}</svg>`;
}

/* The same three stones with no tile behind them, for a surface that already
   has its own background. `ctx` says what it is sitting on so the masonry stays
   legible either way; the keystone keeps the accent regardless, because it is
   the one part that must never be mistaken for a neighbour. */
function markBare(opts = {}) {
  const px = opts.px;
  const size = px ? ` width="${px}" height="${px}"` : '';
  const base = opts.ctx === 'deep' ? WHITE : DEEP;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${size}>` +
         `${fanPaths({ keyFill: ACCENT, flankFill: base, flankOpacity: 0.34 })}</svg>`;
}

/* The full lockup: the whole course with the wordmark in the span beneath the
   stone. `cut` is 'display' (nine segments, 140px and up) or 'text' (five
   segments and a wider gap, 56 to 140).

   The wordmark is emitted with an explicit fallback chain rather than
   font-family="Sora" alone. SVG's default fallback is serif, not sans, so a
   missed webfont does not degrade quietly here: it degrades into a completely
   different voice. */
const WM_STACK = "Sora, Inter, -apple-system, 'Segoe UI', sans-serif";

/* A STANDALONE SVG CANNOT REACH A WEBFONT, which makes font-family alone a lie
   in any file handed to somebody else. Opened directly, dropped in an <img>, or
   rasterised by a tool, the lockup renders in whatever the machine happens to
   have, so it looked correct here and would have arrived wrong everywhere else.
   Caught by measuring: the string came out the same width under "Sora" as under
   a deliberately invented font name.

   Passing `embedFont` (the woff2 as base64) writes an @font-face into the file
   so it carries its own typeface and renders identically everywhere. Sora is
   OFL, so redistributing it this way is allowed; the licence ships beside it in
   assets/brand/fonts. Costs about 20KB, which is the correct trade for a file
   whose whole job is to look the same on someone else's computer. */
function fontFace(b64) {
  return `<defs><style>@font-face{font-family:'Sora';font-style:normal;font-weight:700;` +
         `src:url(data:font/woff2;base64,${b64}) format('woff2')}</style></defs>`;
}

/* opts.bare returns the drawing without the <svg> wrapper, so tileLockup can
   place the identical geometry inside its own coordinate space rather than a
   re-derived copy of it. */
/* Explicit spans per stone rather than a uniform division, because the two at
   the springing are half-length. Whatever the spans fall short of 180 is split
   evenly at both ends, so the course stays centred on the apex and the keystone
   stays the middle stone. */
function customCourse(cx, cy, rIn, rOut, spans, gap) {
  const total = spans.reduce((a, b) => a + b, 0);
  let a = 180 - (180 - total) / 2;
  return spans.map((w, i) => {
    const d = seg(cx, cy, rIn, rOut, a, a - w, gap);
    a -= w;
    return { d, key: i === (spans.length - 1) / 2, i };
  });
}

/* Option D, to the pixel. Three things, and they are all Ohav's:

   1. FLAT, NOT RAMPED. The previous ramp ran 0.30 to 0.54, which made the two
      stones beside the keystone almost as heavy as the keystone itself. He had
      only asked for the outermost bricks to be less faded and I raised the
      whole ramp, which flattened the one stone the mark exists to point at.
      Every flanker is now the same 0.32: the keystone is the only thing
      carrying weight, and a real course is one stone cut the same way anyway.

   2. HALF-LENGTH SPRINGING STONES. Lightens the base so the arch does not sit
      on two heavy feet.

   3. THE WORDMARK NO LONGER TOUCHES. It genuinely did: at cap height the word
      measured 50.1 units against an opening of 48.3. Worth recording that
      shortening the end stones does NOT fix this, which is not obvious and cost
      a measurement to find out. The collision is with the SECOND stone, where
      the inner curve is still coming down steeply, so only changing the type
      clears it. At 16 and y=85 the word is 47.0 against an opening of 50.4. */
const SPANS = {
  display: [10, 20, 20, 20, 20, 20, 20, 20, 10],
  text: [18, 36, 36, 36, 18],
};

/* THE LIGHT RUNNING DOWN THE COURSE. Ohav's, 2026-08-16: the grey stones take
   the light in order, from the keystone down both legs, then it starts again.

   One animation on every stone, delayed by one step per ring out from the apex,
   so both legs are always the same distance from the keystone and the wave is
   symmetrical without a second set of keyframes to keep in sync.

   IT HAS TO LIVE INSIDE THE FILE. The rail draws the lockup as a
   background-image, and page CSS cannot reach inside an SVG loaded as an image.
   The browser does run the image's own declarative animation, so the keyframes
   are written into the file — the same argument as the embedded Sora. It also
   means the page's global prefers-reduced-motion rule cannot reach it either,
   hence the media query below AND the static fallback in styles.css.

   `lit` is deliberately three times `step`: at one step per ring the four rings
   read as four separate blinks, and the light has to still be on the stone above
   when the one below takes it or there is no wave, only a queue.

   THE KEYSTONE NEVER MOVES. It is the one stone carrying weight (see SPANS note
   1) and a light that washes over it too flattens the one thing the mark exists
   to point at. */
const LIVE = { cycle: 5, step: 0.3, lit: 0.9, peak: 0.46, rest: 0.32 };

function liveStyle(rings, o) {
  const pct = (s) => r2((s / o.cycle) * 100);
  const rest = `opacity:${o.rest};fill:${o.ink}`;
  const delays = [];
  for (let r = 2; r <= rings; r++) delays.push(`.r${r}{animation-delay:${r2((r - 1) * o.step)}s}`);
  return '<style>' +
    `@keyframes kd-course{0%{${rest}}` +
    `${pct(o.lit * 0.4)}%{opacity:${o.peak};fill:${ACCENT}}` +
    `${pct(o.lit)}%{${rest}}100%{${rest}}}` +
    `.kl{animation:kd-course ${o.cycle}s ease-in-out infinite}${delays.join('')}` +
    '@media(prefers-reduced-motion:reduce){.kl{animation:none}}' +
    '</style>';
}

function arch(opts = {}) {
  const cut = opts.cut || 'display';
  const ctx = opts.ctx;
  const px = opts.px;
  const ink = ctx === 'deep' ? WHITE : DEEP;
  const display = cut === 'display';
  const c = display
    ? customCourse(100, 98, 56, 80, SPANS.display, 3)
    : customCourse(100, 98, 54, 80, SPANS.text, 5);
  const size = px ? ` width="${px}" height="${r2(px * 0.52)}"` : '';
  /* `bare` is tileLockup placing this geometry inside the icon: an app icon
     that pulses is a different object, and the PNG exports would catch it
     mid-wave anyway. */
  const live = opts.live && !opts.bare
    ? { ...LIVE, ...(opts.live === true ? {} : opts.live), ink }
    : null;
  const mid = (c.length - 1) / 2;
  const stones = c.map((v) => v.key
    ? `<path d="${v.d}" fill="${ACCENT}"/>`
    : `<path d="${v.d}" fill="${ink}" opacity="0.32"${live ? ` class="kl r${Math.abs(v.i - mid)}"` : ''}/>`).join('');
  const fs = display ? 16 : 18;
  const y = display ? 85 : 86;
  const face = opts.embedFont && !opts.bare ? fontFace(opts.embedFont) : '';
  const anim = live ? liveStyle(mid, live) : '';
  const body = `${anim}${stones}` +
         `<text x="100" y="${y}" text-anchor="middle" font-family="${WM_STACK}" font-weight="700" ` +
         `font-size="${fs}" letter-spacing="-0.6" fill="${ink}">kaymen<tspan fill="${ACCENT}">.dev</tspan></text>`;
  if (opts.bare) return body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 104"${size}>${face}${body}</svg>`;
}

/* THE APP ICON AT 64 AND UP: the lockup itself, set on the tile, rather than a
   second drawing that merely resembles it. Ohav's split is by size, not by
   purpose: three stones on the small icons, the name inside the arch on the
   large ones.

   Done by transforming the real lockup into the tile's coordinate space instead
   of re-deriving it at 32 units, so "pixel perfect against the logo" is a
   property of the code rather than a thing to check by eye.

   CONTENT is the lockup's real ink bounds and has to be recomputed whenever the
   drawing changes, or the tile silently goes off centre. Halving the springing
   stones stopped the course at 10 degrees rather than 0, which pulled both the
   width and the height in; leaving the old 20..180 by 18..98 box in place would
   have hung the arch high in the tile with a dead band underneath. Derived, not
   guessed: x is 100 +/- 80*cos(10deg), the top is the apex at 98-80, and the
   bottom is the descender of the y rather than any stone. */
const CONTENT = { x0: 21.2, x1: 178.8, y0: 18, y1: 88.5 };

function tileLockup(opts = {}) {
  const kind = opts.kind || 'deep';
  const px = opts.px;
  const size = px ? ` width="${px}" height="${px}"` : '';
  const bg = kind === 'accent' ? ACCENT : DEEP;
  const rx = opts.radius == null ? 7.4 : opts.radius;
  /* 26 of 32 units, not 30. At 30 the springing stones touched the tile edge,
     which reads as a crop rather than as a logo with a margin. */
  const s = 26 / (CONTENT.x1 - CONTENT.x0);
  const tx = r2((32 - 26) / 2 - CONTENT.x0 * s);
  const ty = r2((32 - (CONTENT.y1 - CONTENT.y0) * s) / 2 - CONTENT.y0 * s);
  /* Always the on-deep ink: the tile supplies a dark ground either way, and the
     accent tile is dark enough that white masonry is still the readable choice. */
  const inner = arch({ cut: 'display', ctx: 'deep', embedFont: opts.embedFont, bare: true });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${size}>` +
         (opts.embedFont ? fontFace(opts.embedFont) : '') +
         `<rect width="32" height="32" rx="${rx}" fill="${bg}"/>` +
         `<g transform="translate(${tx},${ty}) scale(${r2(s)})">${inner}</g></svg>`;
}

module.exports = {
  ACCENT, DEEP, WHITE, WM_STACK,
  seg, course, glyphPaths, glyph, tile, tileLockup, markBare, arch,
};
