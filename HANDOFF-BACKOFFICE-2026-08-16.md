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

Email is **done and shipped-ready**. The admin **dashboard** is done. The admin **projects page**
and the whole **portal** are not started. Nothing is committed or pushed.

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
  the project is actually doing. That is the only API change in this work.

---

## 3. What is next, in order

1. **Admin projects page → Dense console.** `renderProjects()` + `renderProjectDetail()` in
   `admin/app.js` become one two-pane screen: project list left, selected project entire on the
   right. Pass `{ wide: true }` to `renderLayout` — `.main.wide` exists for exactly this. All the
   CSS is already written and unused: `.c-top .c-panes .c-list .c-li .c-detail .c-dh .c-stats
   .c-cols .c-blk .c-ms .c-m .c-tb .c-sel .c-log .c-lr`. Drop the Claude Code pane (§1).
   The inline ticket-status `<select>` already exists in the current code — it becomes the main
   way tickets move.
2. **Portal.** `portal/styles.css` is untouched and still the old dark theme — it needs the same
   treatment `admin/styles.css` got, including its own legacy token bridge. Then the overview
   screen: Reassurance's status sentence and timeline, with a Workspace "yours to do" block that
   appears only when the client has a pending plan, a blocked question, or open tickets.
   `portal/app.js` still has its theme toggle at lines ~347–408 — remove it, same as admin.
3. **Sweep the pages nobody restructured** — Security, Analytics, Settings, Clients, ticket detail,
   invite, login. They already render coherently through the bridge (§4); this is a pass to remove
   inline styles and old-theme leftovers, not a rebuild.

---

## 4. Traps — read before touching anything

- **The legacy token bridge in `admin/styles.css` is load-bearing.** `admin/app.js` carries several
  hundred inline styles written against the old dark theme's variable names (`--surface-3`,
  `--text-dim`, `--danger`, `--gradient` …). Rather than rewrite every one, the old names are kept
  and pointed at the new palette, so pages that have not been restructured still land on the right
  colours. **Grep `app.js` before deleting a bridge line.** `portal/styles.css` will need its own.
- **Class-name collisions are silent and expensive.** The icon-chip tone class `alert` picked up
  the `.alert` message-box rule and its `padding:13px 16px`, squeezing the glyph out of a 26px box.
  Nothing errored; the icon was simply gone. Tone classes are `t-alert` / `t-warn` / `t-ok` now.
  The mockup could not have caught this — it has no `.alert` component.
- **`.metrics-grid` uses `auto-fit`, not `repeat(6)`.** The dashboard emits six metrics, Security
  four, Analytics one. It also uses `order:` so DOM order does not matter — the dashboard emits
  value-first, the older pages label-first, and both render correctly.
- Everything in `HANDOFF-REDESIGN-2026-08-15.md` §4 still holds: **`master` is production and
  auto-deploys**, confirm with Ohav before pushing, and the `<!--{{WORK}}-->`, `<!--{{FLEET}}-->`,
  `<!--{{LIVE}}-->` placeholders must survive any `index.html` rewrite.

---

## 5. Reviewing the panels — the recipe that works

`--screenshot` cannot log in, so the panels need a real server with real data. This took a while to
work out; do not re-derive it.

```bash
# 1. boot against a throwaway data dir so production data is never touched
DATA_DIR=/tmp/kdadmin PORT=8099 node server/index.js > /tmp/srv.log 2>&1 &
#    the seeded admin password is printed to that log on first boot

# 2. log in over the API, clear must_change_password, seed orgs/projects/
#    milestones/plan/client-user/tickets/leads — all over the public API

# 3. the invite token is truncated in API responses; read it from the DB:
#    sql.js on /tmp/kdadmin/analytics.db, SELECT invite_token FROM users WHERE role='client'

# 4. drop a TEMPORARY admin/_preview.html that does
#      localStorage.setItem('admin_token', '<jwt>'); location.replace('/admin/#/dashboard');
#    screenshot http://localhost:8099/admin/_preview.html, then DELETE THE FILE
```

Two path traps, both cost time today:

- **Chrome is a Windows binary.** `file:///tmp/...` is a MinGW path and gives `ERR_FILE_NOT_FOUND`.
  Use `file:///C:/Users/<you>/AppData/Local/Temp/...`.
- Same for `fs.readFileSync('/tmp/...')` in Node — it resolves to `C:\tmp\...`.

Plus the two from the previous handoff §6: `--screenshot` always captures from the top of the
document, and the window will not go below 500px wide (use an iframe to test phone layouts).

---

## 6. Open — needs a decision

- **The mockup's rail has a Tickets item; there is no tickets index page.** Only ticket *detail*,
  reached through a project. Either build the page or the rail keeps its existing six items. Left
  at six.
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
