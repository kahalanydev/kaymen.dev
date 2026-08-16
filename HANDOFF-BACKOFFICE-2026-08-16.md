# kaymen.dev — back-office redesign handoff

**Written 2026-08-16.** This is the active build document. Read it, then `PROGRESS.md`
and `APP-MAP.md`. `HANDOFF-REDESIGN-2026-08-15.md` is the *previous* handoff — the marketing-site
redesign it describes is **landed and live**; keep it for the LOCKED design decisions in its §1,
which still bind everything here.

**Scope:** put `/admin`, `/portal` and the outbound email onto the locked front-end design system.
This is a visual-layer replacement inside the existing SPAs, not a rewrite. No route, no query and
no API contract changes except where noted below.

---

## 0. State in one line

Email, the admin **dashboard**, the admin **projects console** and the **portal overview** are
done and on the design system. What is left is a sweep, not a rebuild: the admin's Security,
Analytics, Settings, Clients and ticket-detail pages, and the portal's plan, tickets, ticket-detail
and activity pages, all render coherently through their token bridges but still carry inline styles
written against the old dark theme.

---

## 1. Decisions — LOCKED, do not re-open

Everything in `HANDOFF-REDESIGN-2026-08-15.md` §1 still applies: the Kaymen palette, Sora + Inter,
the always-labelled 224px glass rail, the wide measure. On top of that, Ohav picked directions
from `mockup/back-office.html` on 2026-08-16:

| Surface | Direction | Locked |
|---|---|---|
| Admin **dashboard** | **Continuity** — the marketing site, one door further in | 2026-08-16 |
| Admin **projects page** | **Dense console** — two panes, no navigation round-trip | 2026-08-16 |
| Admin — everything else | Continuity's language | 2026-08-16 |
| **Client portal** | **Reassurance** base, plus a "needs you" block from Workspace when the client actually has something to do | 2026-08-16 |
| **Email** | One direction. Shipped. | 2026-08-16 |
| Dark mode | **Dropped**, not deferred | 2026-08-16 |

`mockup/back-office.html` is the reference. It still shows all six panels including the two
rejected admin directions — that is deliberate, it is the record of what was considered.

### Two additions to the palette, declared not smuggled

An operations surface cannot run on one accent: *urgent* and *overdue* have to be legible without
being read, and spending `--accent` on them drains it of meaning. So `admin/styles.css` declares
exactly two more tones, both desaturated to sit with `#2bbcb3` rather than shout over it:

```css
--warn:#a8761c;   --warn-soft:rgba(168,118,28,.09);
--alert:#b8443c;  --alert-soft:rgba(184,68,60,.08);
```

**They are restricted to severity.** Never a heading, never a card edge, never decoration. If Ohav
ever wants to hold the line at one accent, the fallback is weight plus a leading rule.

### The Claude Code chat widget is not being re-skinned

Ohav's call, 2026-08-16: the widget is to be replaced by an agent that scans incoming tickets, so
it is not worth design investment. The Dense console mockup already drops it — the three stacked
grids in `renderProjectDetail` (Milestones + Claude Code, Plan + Tickets, Members + Activity)
collapse into one screen **without** a chat pane. Leave `cc.*` in `admin/app.js` functional but
unstyled; do not spend time on it.

---

## 2. What is done

### Email — `server/utils/email.js` (rewritten)

All eight outbound emails on the mockup's design. **Three of them were not in `email.js` at all** —
they carried their own inline HTML and were found by grepping call sites:

| Was | Now |
|---|---|
| `server/index.js` — contact notification on `#1a1a2e` (older than the theme we replaced) | `sendContactNotification()` |
| `server/routes/auth.js` — SMTP test on `#09090b` | `sendSmtpTestEmail()` |
| `server/routes/admin.js` — bootstrap invite, a *second* invite design competing with `sendWelcomeEmail` | folded into `sendWelcomeEmail({ projectName })` |

Three changes beyond the re-skin, each deliberate:

- **Everything user-supplied is escaped.** A contact-form submitter controls `name` and `message`,
  and those went raw into HTML landing in Ohav's inbox. `esc()` / `escMultiline()`.
- **`text/plain` alternative on every email.** HTML-only mail is a spam signal and the invite is
  the first thing a new client ever receives.
- **The new-ticket email quotes the client's description** (`server/routes/portal.js` now passes
  it). Without it the notification is a link you must open to triage.

One honest deviation from the mockup: the ticket panel reads `bug · urgent`, not
`bug · urgent · unassigned · 1 attachment`. A ticket is always unassigned with zero attachments at
the instant it is created, so the mockup showed state that cannot exist.

**`node scripts/preview-emails.js`** renders all eight to `mockup/email-preview.html`
(gitignored) without sending. It runs the *real* functions — only the config read and nodemailer's
transport are stubbed. The contact sample carries a `<script>` tag on purpose; the script exits
non-zero if it ever renders as markup or if a text part goes missing.

### Admin foundation — `admin/styles.css` (rewritten), `admin/index.html`

- Glass rail replaces the flat sidebar, recipe lifted verbatim from `../styles.css`.
- **Line icons replace the emoji.** Emoji render differently on every OS and cannot take
  `currentColor`, so the active state could never tint them.
- Sora + Inter; ambient washes; light-first `theme-color`.
- **Theme toggle removed** — same grounds the site dropped its own (previous handoff §5). A
  leftover `admin_theme` key is now actively cleared, because it would set `data-theme` on a
  stylesheet that no longer has any `[data-theme]` rules.

### Admin dashboard — "Continuity", `renderDashboard()` in `admin/app.js`

Built and confirmed against a live server with seeded data (recipe in §5). Greeting header, the
flat evidence-strip metrics, needs-attention rows, and the marketing site's `.board`/`.brow`
running board pointed at the `projects` table. Recent activity gained avatar chips; leads absorbed
the old Contact Submissions card.

Two behaviour changes worth knowing:

- **Contact submissions were rendered in two places** — their own card and the leads count.
  Dismissing one left the other showing a lead already dealt with. They are one card now.
- `server/routes/admin.js` dashboard query gained **`p.description`**, so a board row can say what
  the project is actually doing.

### Admin projects → "Dense console", `admin/app.js`

`renderProjects()` and `renderProjectDetail()` are now both one-line wrappers over
`renderConsole(selectedId)`. `#/projects` and `#/projects/:id` render the same two-pane screen;
picking a project in the left list swaps **only** the right pane. That is the whole direction, so
the mechanism matters:

- Selection moves the hash with **`history.replaceState`, not `location.hash =`**. Assigning the
  hash fires `hashchange`, which re-enters the router and rebuilds the screen — exactly the
  round-trip the direction removes. Verified: `#mainContent` is the same DOM node before and after.
- `renderLayout()` sets `con.mounted = false`. Every other page render goes through it, so the
  console is invalidated for free and can never be re-used stale.
- `#/projects` with no id auto-selects the first project and `replaceState`s the id in, so the
  address bar always names what is on screen.
- The ~400 lines of Claude Code chat widget are **gone** from project detail (§1). `cc.*` itself is
  untouched and still drives the Settings pairing card.

Three deliberate deviations from `mockup/back-office.html`:

- **⌘K filters the project list; it does not search tickets and orgs.** The mockup's premise says
  "jump to any project, ticket or org by name", which is a global command palette and a real
  feature, not a visual-layer replacement. The pill is the filter field, ⌘K/Ctrl-K focuses it,
  Enter takes the first hit. Building the full palette is still open.
- **Milestone rows carry controls the mockup's do not** — a status `<select>` and a hover-revealed
  delete. The mockup's row is read-only; the real one has to be editable. They share the third
  grid column rather than the row growing a fourth, and the delete is always visible under
  `@media (hover:none)` so the PWA does not lose it.
- **The plan opens full-width under both panes**, not in the narrow column, which cannot hold a
  340px textarea. View / Edit / History are one panel with one mode at a time.

Two things beyond the re-skin:

- **`open_tickets` was the only ticket signal on the list row, and volume is not severity.** §1
  restricts `--alert` to severity, so the list query gained **`urgent_tickets`** (open or
  in-progress, priority urgent or high) and `.c-li .c.hot` keys off that. This is the second and
  last API change in this work.
- **The plan meta line reads `project_plans.approved_at`,** not an inference from project status.
  A project can be dragged to `in_progress` by hand without the client ever pressing Approve, and
  this line is the only place that difference shows.

Also fixed while in there: dates are formatted with `timeZone:'UTC'`. The `+'Z'` idiom used
elsewhere in `app.js` yields Invalid Date on a bare `2026-08-29`, and local formatting of a
UTC-midnight date reads a day early for anyone west of Greenwich — a target date silently one day
out is worse than no date.

### Login wordmark — admin and portal, all six screens

`renderLogin`, `renderChangePassword` and `renderInvite` in **both** apps emitted the old
`{ kaymen.dev }` brace wordmark while the rails had moved to the K mark. All six now emit
`<span class="mark">K</span>` + `kaymen.dev`; `.login-logo .mark` and
`.login-title{padding-left:46px}` were already in the stylesheets waiting for it.

### Portal — "Reassurance", `portal/styles.css` (rewritten), `portal/app.js`, `portal/index.html`

`portal/styles.css` got the same treatment `admin/styles.css` got: the locked palette, Sora +
Inter, the glass rail, the mobile tabbar, its **own legacy token bridge**, and no dark variant.
`portal/index.html` was loading Inter + JetBrains Mono with a `theme-color` of `#09090b` and no
ambient washes — it now loads Sora, is light-first, and carries the three washes glass needs to
refract. The theme toggle is gone and `portal_theme` is actively cleared, same as admin.

`renderProject()` is now the Reassurance overview:

- **The status sentence is derived on every render, never written.** That is the whole safeguard.
  The direction's own stated cost is that the sentence has to stay true, so `statusSentence()`
  computes it from milestones, dates and tickets: a project running late says *"Running 4 days
  behind on one stage"* in 38px Sora rather than keeping a cheerful string somebody typed in
  August. Every branch of it — proposed, planning, live, completed, maintenance, archived — is
  derived the same way.
- **The "yours to do" block renders only when it has contents.** Workspace's own stated cost is
  that an empty to-do column reads as neglect exactly when things are going well, so with nothing
  to do the block is *absent*, not empty, and the hero sentence carries the screen alone.
- The timeline spine is lit to the real completion figure via a `--lit` custom property. The
  mockup hard-codes 62%; a spine that always reaches the same point is decoration, not status.
- Two calls in parallel: the project response carries only an open-ticket *count*, and both the
  sentence and the to-do block need the tickets themselves.

**"We are blocked on you" is deliberately not built.** It is in the Workspace mockup, but nothing
in the schema records that we are waiting on a client, and inventing the state would put a demand
on a client's screen that nobody actually made. What *is* derivable is a ticket we moved to
`review` — we think it is fixed, they have to say so — and that is what the block shows alongside a
plan awaiting approval. See §6.

`portal/routes.js` gained **`org_name`** on the project detail response, so the rail foot can name
the client's own organisation on a deep link. That is the third and last API change in this work.

Also fixed while in there: **both PWA manifests still declared `#09090b`** for `theme_color` and
`background_color`, so an installed admin or portal flashed the old dark theme on every launch.
Both are `#ffffff` now. And `renderPlan()` passed `'project'` to `renderLayout`, so the rail lit
Overview while you were sitting on the plan.

---

## 3. What is next, in order

1. **Sweep the pages nobody restructured.** Admin: Security, Analytics, Settings, Clients, ticket
   detail, invite. Portal: plan, tickets, new-ticket, ticket detail, activity. They all render
   coherently through their bridges (§4); this is a pass to remove inline styles and old-theme
   leftovers, not a rebuild.

   Two worth doing first, both for the same reason — they are the screens you reach *out* to:
   the admin's **ticket detail** (the only way out of the console) and the portal's
   **new-ticket form** (the "Tell us something" button on the overview goes straight to it, and
   Workspace's argument is that reporting something should cost one action).

2. **Decide on the compose box.** Workspace puts a compose textarea on the portal's landing
   screen; the shipped overview links to the new-ticket page instead. `.compose` CSS was *not*
   ported — writing dead CSS is how the admin ended up with an unused `.c-k` for a day. Decide
   before building.

---

## 4. Traps — read before touching anything

- **The legacy token bridges are load-bearing, in both stylesheets.** `admin/app.js` and
  `portal/app.js` carry inline styles written against the old dark theme's variable names
  (`--surface-3`, `--text-dim`, `--danger`, `--gradient` …). Rather than rewrite every one, the old
  names are kept and pointed at the new palette, so pages that have not been restructured still
  land on the right colours. **Grep the matching `app.js` before deleting a bridge line.**
  The portal's bridge is the more dangerous of the two: `progressRing()` emits
  `stroke="var(--surface-3)"` and `fill="var(--text)"` *inside SVG*, where a missing variable
  renders as nothing at all rather than as an obviously wrong colour.
- **Class-name collisions are silent and expensive.** The icon-chip tone class `alert` picked up
  the `.alert` message-box rule and its `padding:13px 16px`, squeezing the glyph out of a 26px box.
  Nothing errored; the icon was simply gone. Tone classes are `t-alert` / `t-warn` / `t-ok` now.
  The mockup could not have caught this — it has no `.alert` component.
- **`.metrics-grid` uses `auto-fit`, not `repeat(6)`.** The dashboard emits six metrics, Security
  four, Analytics one. It also uses `order:` so DOM order does not matter — the dashboard emits
  value-first, the older pages label-first, and both render correctly.
- **The console's selection must not go through `location.hash =`.** Assigning the hash fires
  `hashchange`, the router re-enters, and the whole screen rebuilds — which is the round-trip the
  Dense console exists to remove. Use `history.replaceState`. The cost, accepted knowingly: Back
  does not step through project selections, it leaves the console. Trade the other way and the
  direction is gone.
- **`con.mounted` is cleared inside `renderLayout()`, not by the console.** That is what makes it
  correct: `renderLayout` is the thing that wipes the shell, so anything that renders a different
  page invalidates the console automatically. Do not move that line into `renderConsole`.
- Everything in `HANDOFF-REDESIGN-2026-08-15.md` §4 still holds: **`master` is production and
  auto-deploys**, confirm with Ohav before pushing, and the `<!--{{WORK}}-->`, `<!--{{FLEET}}-->`,
  `<!--{{LIVE}}-->` placeholders must survive any `index.html` rewrite.

---

## 5. Reviewing the panels — one command

`--screenshot` cannot log in, so the panels need a real server holding real rows. The previous
handoff described that recipe in prose and said not to re-derive it — but prose is exactly the
thing that gets re-derived, so it is now a script:

```bash
node scripts/seed-preview.js
```

It boots `server/index.js` against `.preview-data/` (gitignored, never `data/`), seeds five orgs,
five projects with milestones / two plan versions / tickets / members, four client users and a
lead, and writes `admin/_preview.html` + `portal/_preview.html` — token-planting redirects that get
you past the login screen. Both are gitignored and both are deleted when you Ctrl-C the script.

The fixtures are the mockup's, on purpose: the same overdue milestone and the same urgent ticket,
so the console can be read against the panel it was designed from. They are the only two things on
screen that exercise `--alert`.

Four things it encodes that cost time to find:

- **A new client user gets an invite token, not a temp password.** The only route to a working
  client login is `POST /api/auth/invite/:token/accept`. The whole token is in the creation
  response's `invite_url`; it is the *users list* that truncates it.
- **Plan approval has to come from the client over the portal API** — that is the only thing that
  writes `project_plans.approved_at`, which the console's plan meta now reads.
- **`POST /api/contact` is rate-limited to 1/min per IP**, in memory. One lead is all you can seed
  over HTTP, and weakening a real defence to make a preview look busier is not worth it.
- **Tickets are org-scoped**, so a PCG client filing against CIS gets a 404. One client per org.

Path traps, still true:

- **Chrome is a Windows binary.** `file:///tmp/...` is a MinGW path and gives `ERR_FILE_NOT_FOUND`.
- Same for `fs.readFileSync('/tmp/...')` in Node — it resolves to `C:\tmp\...`. The script uses
  `.preview-data/` for exactly this reason, and deliberately not `os.tmpdir()`, which follows
  whatever `TEMP` the parent process happened to set.

A flat screenshot cannot show that a click swapped a pane rather than rebuilding the page. For
that, launch Chrome with `--remote-debugging-port=9222` and drive it over CDP — Node 24 has a
global `WebSocket`, so no dependency is needed. That is how the console's no-round-trip claim,
its plan panel, and its inline status dropdowns were actually verified.

Plus the two from the previous handoff §6: `--screenshot` always captures from the top of the
document, and the window will not go below 500px wide (use CDP's
`Emulation.setDeviceMetricsOverride`, or an iframe).

---

## 6. Open — needs a decision

- **The mockup's rail has a Tickets item; there is no tickets index page.** Only ticket *detail*,
  reached through a project. Either build the page or the rail keeps its existing six items. Left
  at six.
- **⌘K is a filter, not the palette the mockup promised.** It filters the project list — real, and
  the pill CSS was written for it — but the mockup's premise says "jump to any project, ticket or
  org by name", which needs a search endpoint spanning three tables and an overlay. That is a
  feature, not a re-skin, so it was left out rather than half-built. Worth deciding: build it, or
  amend the mockup's premise to match what shipped.
- **"We are blocked on you" has no data behind it.** Workspace's second to-do card is a question
  the team is waiting on the client to answer, and nothing in the schema records that state. The
  portal shows what *is* derivable — a plan awaiting approval, and tickets we moved to `review` —
  which covers the shape but not that case. Making it real is a small schema decision: either a
  `blocked_on_client` flag on tickets, or a ticket status like `waiting_on_you`. Worth doing; the
  card is already designed and the CSS is already there.
- **The portal's rail has no Milestones item**, where the mockup's has one. Milestones live on the
  overview timeline and there is no separate page. Either build one or leave the rail at five.
  Left at five.
- **Ohav's main-site rail tweaks are still queued** and were called "the number one design tweak I
  need" before the back-office work was prioritised. Three parts, none started:
  1. Centre the rail in the gutter — it should sit exactly midway between the screen edge and the
     text. **Cause is diagnosed:** at wide viewports `.wrap` auto-centres inside the padded column
     but the rail stays pinned at `clamp(26px,3.4vw,68px)`, so the gap grows on the content side
     only. At 1440px it is already near-centred; at 1920px it is ~94px too far left. The fix is to
     derive the rail's `left` from the same expression as the text edge:
     `left: calc((var(--text-left) - var(--rail-w)) / 2)`.
  2. Move it up a little — a `--rail-lift` token on `top:calc(50% - var(--rail-lift))`.
  3. **Mobile: a collapsed dot rail.** Closed by default showing one dot per section with the
     current section marked; tapping opens the full labelled rail. This *replaces* the bottom
     tabbar on the main site. Note it contradicts `HANDOFF-REDESIGN-2026-08-15.md` §1's "below
     900px it becomes a bottom glass tabbar" — Ohav asked for it directly, so it is an amendment,
     not a sweep. The desktop no-hover-collapse rule is untouched.
     When this lands, roll the same pattern into `/admin` and `/portal`, which currently keep the
     re-skinned bottom tabbar so there are not two mobile navs.
- **`server/db.js` is its own track, not part of this work.** It holds the whole database in memory
  and rewrites the entire file on a 1-second debounce plus a 30-second interval. Fine at 286KB;
  not fine once `events` holds a year of 30-second visitor heartbeats. Raised 2026-08-16, not
  scoped, deliberately excluded from the re-skin.
