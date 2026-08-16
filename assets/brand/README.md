# kaymen.dev brand assets

Generated. Do not hand-edit anything in this folder, and do not redraw the mark
in a design tool: it is defined by geometry in `content/logo.js` and every file
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
| Favicon, modern browsers | `../../favicon.svg` (root) |
| Favicon, bare `/favicon.ico` requests | `favicon.ico` |
| iOS home screen | `../../apple-touch-icon.png` (root, 180px) |
| Android / PWA manifest | `../../icon-192.png`, `../../icon-512.png` (root) |
| App icon, any other size | `kaymen-icon-{16,32,48,180,192,512}.png` |
| In-app icon on a coloured tile | `kaymen-mark-white.svg` |
| Icon on a light background, no tile | `kaymen-mark-deep.svg` |
| Print, embroidery, stamps, one colour | `kaymen-mark-mono.svg` |
| Signature, 140px and up | `kaymen-lockup.svg` / `-white.svg` |
| Signature, 56 to 140px | `kaymen-lockup-text.svg` / `-white.svg` |
| Email header | `email-mark.png` |

## Sizes, because one drawing does not cover the range

- **140px and up** — `kaymen-lockup.svg`. Nine segments.
- **56 to 140px** — `kaymen-lockup-text.svg`. Five segments and a wider gap.
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
Request the face, wait for it, then draw. `kaymen-lockup*.svg` already carries a
fallback chain, but a page that redraws the lockup in script must wait as well.

**Outlook does not render SVG at all**, because it draws through Word, and Gmail
strips CSS background images. Email uses `email-mark.png` as a plain `<img>` for
this reason. Do not "improve" it to an inline SVG.

## Clear space and minimum size

Keep clear space of one pier width on all sides. Minimum size is 16px for the
tile and 56px wide for the text lockup. Do not recolour the keystone, do not
stretch either axis independently, and do not place the white mark on a light
background: use `kaymen-mark-deep.svg` instead.
