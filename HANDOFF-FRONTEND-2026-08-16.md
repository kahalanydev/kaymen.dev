# Handoff — front end, 2026-08-16

**Read this after `HANDOFF-BACKOFFICE-2026-08-16.md`.** That one covers admin,
portal and outbound email. This one covers the marketing site: the hero, the
pricing section, the mark, and the mobile pass. Everything here is **landed,
pushed and verified live** unless it appears under *Open*.

22 commits, `ed6917f` … `76b5eac`.

---

## 1. The page structure changed

`#need` and `#price` were **merged into one section**. They asked the same
question — "which of these are you" — and both ended in a price, so the homepage
asked it twice for 2,046px, 29% of the page. One section now does both, at
~835px, and it **keeps `id="price"`** so case-study cost blocks can go on linking
to `/#price`.

The page now reads: hero → `#price` → `#running` → `#work` → `#terms` → `#talk`.

**Two lists must be changed together** or the sub-pages get a nav the homepage
does not have. This bit twice in one day:
- `index.html` rail + tabbar markup
- `server/render.js` `RAIL_ITEMS`, `TAB_SECS`, `TAB_ICONS`

`render.js` owns the nav for **every page except the homepage**. A dead `/#need`
link survived a day on `/work`, all six case studies and the 404 because the one
file that was checked was the one file that was already correct.

---

## 2. The hero

Replaced "We build it. Then we run it." — it described the business model to
someone who came to find out what they get, and any shop could copy it.

Now: **"Own your software. Stop ~~renting~~ it."** argued through the pain — five
subscriptions each doing half a job, someone reconciling by hand, a bill that
rises with every hire, none of it theirs. Then the offer: one system that does
all of it, and it scales for free.

Six blocks say **what they get**, not what the competition withholds. Arguing
against competitors immediately after the offer reads as a second complaint.

### The comparison panel
Server-rendered by `rentPanel()` in `server/render.js`, from `RENT_STACK` in
`content/pricing.js`. **Server-rendered, not drawn by `script.js` like the
picker, because it is above the fold.**

It does **not** claim to be cheaper — year one is not, and that claim dies the
moment a buyer opens a spreadsheet. It claims *you are already spending this and
own none of it*, which is true and gets truer as they grow.

Figures are **researched** (Aug 2026 list prices, team of five, mid-tier), not
felt. Each line has a cheaper option named in the comment beside it. **Google
Workspace is deliberately excluded** — at $14/seat it would add $70 and flatter
the total, but email and docs are not a business system doing half a job.

### Headline sizing
Two lines is a hard requirement and the numbers are why it holds:
"Own your software." needs 596px at 64px. The column is 668px at 1440 but only
**469px at 1280**, because the rail takes 224px plus gaps first. So the hero grid
goes two-column at **1280, not 1040** — at 1040 the column was 247px and the
headline ran to four lines. Verified 2 lines at eleven widths, 390 → 2560.

### The mesh — read this before touching it
`#heroNet`, drawn in `script.js`. One source (the circular mark, embedded as a
data URI) spreading outward; every node descends from it and arrives attached.

**Four separate causes were fixed before it filled the screen. If it looks wrong
again, check them in this order:**

1. **`overflow:hidden` on `.hero`** — this was the real one. `.hero-fx` cancels
   the page padding with negative left/right to reach the edges; the clip removed
   exactly that. **It survived three rounds of testing because the canvas element
   still measures 0..1920** — `getBoundingClientRect` reports the extended box and
   the clip only affects paint. **Test rendered pixels, not element rects.**
2. **`grow()` picked a random parent** and threw outward. Once the middle filled,
   almost every random parent was interior, so candidates landed in occupied
   space. It now samples the whole canvas and attaches to the nearest node.
3. **Fixed 52 nodes** — fine at 1440, ~200px apart at 2560. Now scales with area.
4. **Source placed as a % of canvas width** — the canvas is full-bleed, the
   content is capped at 1120px, so past ~1500px it slid behind the panel. It is
   now **measured from the live layout**.

Also: only **leaves** are ever retired (degree one is the one deletion that
cannot split a connected graph), and dying nodes must fade **faster** than their
edges or they outlive them and float alone. A BFS from the source reports 0
orphans across ten samples over 40 seconds.

`html` carries `overflow-x:clip` — **clip, not hidden**; hidden makes it a scroll
container and breaks smooth scrolling and sticky.

---

## 3. Pricing

`content/pricing.js` is the **single source of truth**, read by both the browser
(`window.KD_PRICING`) and the server (`require`). Its header claimed that for
weeks before it was true; `script.js` carried a second copy that had to be kept
in step by hand. That copy is gone.

The picker **opens on the $2,500 rung**, not the $6,500 one — the first number a
visitor sees decides whether they keep reading.

That rung has been worded three times. The first two described the **work**
("one job you still do by hand", "the job that comes back every week") and framed
$2,500 as the price of a chore, which is never worth $2,500. It now names the
**thing**: *Your first real system* — a real database with logins that they own.

**BridgeMortgage was retagged `platform` → `stack`.** At `platform` it quoted
$19,000, tipped past `PARTNER_AT`, and rendered "year one $42,000" against an
agency figure of $15,600–20,800 — the page argued against us. It is a
two-to-three-seat brokerage; the tag was simply wrong.

---

## 4. The mark

Geometry lives in `content/logo.js`; **everything else is generated**:
- `scripts/build-icons.js` → favicons, app icons, `.ico`, lockups, `assets/brand/`
- `scripts/build-og.js` → the eight social cards, copy read from `index.html`

**The lockup (arch with the name under it) is the brand**, not the tile. The tile
is only for 48px and under, where the wordmark stops being type.

Two traps, both already paid for:
- **Every generated PNG was flattened onto white.** `background:transparent` does
  nothing for a screenshot; it needs `setDefaultBackgroundColorOverride`.
  `kaymen-lockup-white.png` was arriving essentially blank. There is now an
  assertion on the PNG colour type.
- **The social cards went stale twice.** `build-og.js` fixes itself, but only when
  run. **Editing the hero means running it in the same commit.**

---

## 5. Mobile

- **Brand chip** (`.brandbar`) — the rail is hidden under 900px and was the only
  thing carrying the mark, so mobile had no logo at all. It is `position:fixed`,
  so it covered content for the whole scroll; it now retracts down, returns up.
- **Mesh** — kept at **45% opacity**, source moved to the top-right corner. Hiding
  it outright was too blunt; it landed on a benefit block before.
- **Tabbar order** now matches the page.

---

## 6. The screenshot strip

`SHOTS` in `server/render.js` carries **three, and it stays three**: BridgeMTG,
Thrive and Horse & Harmony. The section claims "still running", and a business
doing its work on one of these proves that better than a product we built for
ourselves.

It shipped at six for about an hour — the client back ends *plus*
predictable/kartov/davenen — and Ohav killed that on sight. Six doubled a strip
already too small to read on a phone, and diluted the claim. The three retired
JPEGs are still in `assets/shots/`, so changing the mix is four lines and needs
no re-shoot. **Do not let it grow back.**

### Nothing in these shots is real, and it must stay that way

The Thrive screenshot originally supplied held **six real students by name**, an
intake queue, a staff member and a university. Consent to name the **client** is
not consent to publish the **people inside their system**, and no client gave the
second one. BridgeMTG holds borrowers; Horse & Harmony holds riders, most of them
children, with guardian phone numbers and health-fund membership.

So every shot is taken from a **local instance against a freshly seeded database
of invented data** — `@example.com` addresses, the reserved `555` phone ranges,
fabricated names. Never production. Never a dev database that has been synced
from production. **BridgeMTG's own seeded staff were renamed too** — its
`seeds/009_staff_users.ts` creates the real people with their `@bridgemtg.com`
addresses, and employees are not covered by client naming consent either.

### Re-taking them

`scripts/shoot-app.js` drives installed Chrome over the DevTools protocol (same
approach as `build-icons.js` and `build-og.js`, no new dependency) and writes a
900×562 JPEG — asserting those exact dimensions, because the markup hard-codes
`width=900 height=562` and nothing downstream would catch a wrong one.

```
node scripts/shoot-app.js --url=<local url> --out=assets/shots/<name>.jpg \
  [--login-url=… --fill='SEL::VALUE' --click=SEL] [--scroll-to=SEL] [--settle=MS]
```

Each back end needs its own database standing up first; all three are documented
in their own repos. Two things cost an hour each and will do so again:

- **Type, don't assign.** `el.value = x` fills the box on screen and leaves
  React's `useState` and Livewire's component state empty, so the form submits
  blank and the submit button never enables. The script types with
  `Input.insertText`, which needs `Emulation.setFocusEmulationEnabled` — headless
  pages are never focused, so without it every keystroke goes nowhere.
- **Next.js `dev` did not hydrate at all** (no React fiber on any element, HMR
  websocket failing in a loop). `next build && next start` fixed it, and a
  production build is the more honest screenshot anyway.

Also: **BridgeMTG deals are invisible without a `deal_assignees` row** — the
pipeline query scopes to the signed-in user, so a seeded deal with no assignee
renders as "No deals yet".

## 7. Pricing, after Ariel's review

Three changes, and **two of them are one change** — do not undo either alone.

### The hero panel now prices the person, not just the licences

`.swork` in `rentPanel()`. The panel used to stop at $290 of subscriptions, which
was its weakest point: $290 is not a frightening number, and §2 already concedes
the page does not claim to be cheaper in year one. Ariel's note — *"we dont
necessarily save u money on the saas fee but we save u money on manpower"* — is
the argument that survives a spreadsheet, because the person reconciling between
five tools costs an order of magnitude more than the tools.

The published figure is a **break-even, not a salary**: `reconcileBreakEven()`
divides the licence total by four hours a week, so it is arithmetic a reader can
check rather than a claim about their payroll. Four hours is the low end on
purpose. Computed, never typed, same as `rentTotal()`.

The hours are said in words ("half a day a week") rather than printed from
`reconcileMonthly()`, because that rounds to 17 and *"17 hours a month"* sitting
beside *"$17 an hour"* read as one number written twice.

### The entry rung went $200 → $300 a month

Ariel: *"$200 a month is low."* The ladder's own evidence agrees — a light live
system runs ~5 h/mo, so $200 was an effective **$40/hr** against a published
**$125/hr** overflow rate.

**This is the half that cannot stand alone.** $200 sat under the $290 rent total
and the panel put them side by side, so raising it inverts the one juxtaposition
the panel had. It only works because the labour line landed in the same commit:
the comparison is no longer $290 vs $200, it is $290 *plus the person* vs $300
flat. No case study moved — every one is `stack` or `platform`, none is `tool`.

### All four rungs now show what they include

`#askAll`, rendered by `script.js`. The picker showed one rung at a time, so
comparing meant clicking and remembering.

It is deliberately **not** a tier table. Ordered by the situation you are in, the
money is a small muted line at the **foot** of each card, and it is a *third way
into the same `askSel` state* — the sentence and the pills were already two, and
the rule that none of them owns the state is what stops them drifting. Promote
the price to the card heading and this becomes the rental frame the whole page
argues against, with $15,000 on screen before anyone has read what it is for.

Two things that are easy to undo by accident:

- **`.ask-ticks` at the top only renders for "Not sure yet".** The grid carries
  every rung's ticks, so showing both printed the same three lines twice about
  250px apart. But the pilot is deliberately not in the grid — it is not a
  package, and `quote()` does not know about it either — so its ticks would have
  nowhere else to go. Hence the conditional, not a deletion.
- **Below 560px the grid is a horizontal swipe.** Stacked, four cards were 949px
  on a 390px phone — longer than the whole section was before they existed;
  swiping brings it back to 294px. The selected card is centred by setting the
  strip's own `scrollLeft`, **not** `scrollIntoView`, which is entitled to scroll
  the page vertically and would yank a first-time visitor down the page on load.
  `askReady` guards the first render for the same reason.

`#price` is now 1,149px at 1440 (was ~835px), and 1,485px at 390px. Still far
below the 2,046px the merge in §1 was undoing.

## Open

- The strip **swipes below 820px now** (`.shots`, same pattern as `.ask-grid`),
  which was the length problem: it was 963px of stacked screenshot at 390px and
  1,671px at 768px, now 295px and 471px. It does **not** make a back office
  legible at 320px and does not try to — on a phone these exist to show that real
  systems with real interfaces are behind the claim, and one card plus a peek
  says that. Real legibility needs mobile-specific crops, i.e. a second set of
  assets shot at a tighter frame. Still open, but no longer urgent.
- **BridgeMTG and Horse & Harmony being pictured is settled** — Ohav cleared it
  on 2026-08-16 ("its ok") after being shown that neither business is recorded as
  having agreed. Do not re-open it.
- Neither BridgeMTG nor Horse & Harmony has a **demo-data seeder** of its own;
  the fixtures for these shots were written as throwaway scripts. If the strip is
  ever re-taken, that work repeats.
- The pricing headline runs to **four lines on mobile**; a shorter mobile variant
  would tighten that section.
- The mobile hero is **cramped** — six blocks, two paragraphs and two buttons
  above the fold.
- `unified-memory/projects/kaymen-group/retainer-pricing-ladder.md` was rewritten
  and marked ratified. Numbers live in `content/pricing.js`; that file records
  reasoning only.
- Add-on increments (+$5,000 store app, +$3,500 multi-tenant) remain the least
  evidenced numbers in the ladder. They are why the homepage **names** add-ons
  without pricing them.
