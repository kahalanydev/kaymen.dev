# Handoff — the back office as a business system, 2026-08-20

**Read this first, then `HANDOFF-SECURITY-2026-08-17.md`.** This one is the *active*
thread: the marketing site work below is finished and live, and the open work is the back
office — making it manage the money as well as the delivery.

---

## 0. State in one line

The marketing site is done and verified live; the back office manages **delivery** completely
and **money** not at all; production's client tables are **empty**; and the database it would
all live in is **not backed up and rewrites itself in place** — which is why the next step is
durability, not schema.

**Working tree was clean at handoff. `master == origin/master`. Nothing uncommitted.**

---

## 1. What landed today (all live, all verified against production)

Three commits, in order:

| Commit | What |
|---|---|
| `8785c84` | Four packages you can actually tell apart |
| `beb7fe9` | Make the price ladder readable to machines, and stop the cards jumping |
| `786571a` | Hold the page still while you pick a package |

### The packages (Ariel: "i dont see the difference in pacakges here honestly")

The cause was never the layout. A ShipStation-style matrix was built (`mockup/matrix-option.html`)
and **rejected** — Ohav: *"what we got now on the site i think looks so much better"*, and he was
right; it changed the container when the problem was the contents. The cards stayed. Three
content faults were fixed:

- **Heading is `product`, not `chip`.** A chip names the PROBLEM, which reads correctly in the
  pill row and inverts above a price — "Tools that do not talk · from $6,500" read as paying
  $6,500 *for* tools that do not talk.
- **Four parallel `axes`** replaced twelve freely-chosen ticks: Covers / Replaces / Reporting /
  Changes, same order every card.
- **`UNIVERSAL` lifted into a band above.** Listing "backups verified" on card one implied the
  other three had none, and "no per-seat fee" appeared on two cards as though it distinguished
  them.

### The pricing was invisible to every crawler

`#askChips`, `#askAll`, `#askBuild`, `#askMonthly` were **empty divs** in the served HTML;
`script.js` built the ladder on load. The one figure that leaked was a single
`$2,500 once, then $300/mo` from the scale chart's own row — while that same chart put
**$12,000, $21,000, $63,000, $47,383** of *competitors'* costs in front of any machine, with
nothing marking whose was whose. Ariel: *"the pricing is not readable for bots"*.

`askSection()` in `server/render.js` now server-renders the whole section behind a new
`<!--{{ASK}}-->` token, plus JSON-LD `Offer`s from the same ladder. `script.js` binds and
mutates; **it no longer builds any of that markup, and must not start again.**

Also found and fixed: **the entire page body was blank without JavaScript** (`.rv{opacity:0}`
until JS adds `.in`). `<noscript>` fallback now in both heads.

### The jump

Two separate causes, and fixing the first did not touch the second.

1. **The scroll** — clicking a card ran `scrollIntoView` on `.ask-out` every time. Removed.
2. **The reflow** — the sentence and note sit *above* the pills and are a different height per
   rung, so picking a pill moved the pill row out from under the thumb. Viewport-relative on the
   live page at 390px: `running -79px`, `platform -47px`, `not sure +73px`. **0px at 1400px**,
   which is why it was invisible on a desktop.

Fixed by `askAnchor()` — measure the pill row before and after, give back the difference. It
costs no layout space, which is why it replaced two rejected `min-height` versions that left a
110–180px hole under the heading on a phone.

---

## 2. Where we stopped — the money model

Ohav, 2026-08-20: *"this system is going to be both our client management base plus each cleints
plan monthly added so it has to manage both component of the business the serbicing business and
the money part."* Then: *"hey coming back to the back end now what do u suggest?"*

**A recommendation was delivered and is awaiting a go. No code has been written for it.**

### Verified facts behind the recommendation

Do not re-derive these; they were checked on production, not read from a doc.

- **`organizations`, `projects`, `tickets`, `milestones`, `project_plans`, `contact_submissions`
  are all EMPTY in production.** Two `admin` users, nothing else.
- **There is no money anywhere in the system.** `organizations` holds name / logo / email / notes
  and nothing more. A grep of the whole server and both SPAs for invoice / billing / retainer /
  subscription / payment returns **one** hit, and it is marketing copy in `server/render.js`.
- **`server/db.js:79` rewrites the live database file in place** — `fs.writeFileSync(DB_PATH, …)`
  on a 1s debounce and a 30s interval. No temp file, no rename, no fsync. A crash mid-write
  leaves `analytics.db` **truncated, not stale**.
- **It is not backed up.** The host's nightly 03:00 `/opt/backups/backup.sh` covers MySQL and
  Coolify's Postgres, and writes a *list* of Docker volume names "for reference during restore".
  It never copies the volume contents. There is no copy of `analytics.db` anywhere.

### The recommended order

1. **Durability first — before any financial record exists.** Temp file → fsync → `rename`
   (atomic; a crash leaves the old file or the new one, never a broken one), plus a rolling daily
   copy so a bad migration is recoverable too. ~30 lines in `server/db.js`. It protects the
   traffic, security and contact data already in there, so it earns its keep either way.
2. **Load the real clients into what already works.** No code. The delivery side is finished and
   unused; filling it gives Ariel something to show and tells us what the money layer needs
   before we guess. Adding agreements later does not mean re-entering any of it.
3. **Then the money layer.**

### The shape (three tables, not three columns on `organizations`)

The money attaches to the **project**, not the org — one client can have two systems, each with
its own build fee and monthly. And a single typed-in `monthly` would drift, because the monthly
is *composed* from rung + add-ons.

- **`agreements`** — one per project. Rung, add-ons, `build_fee`, `monthly_fee` (**snapshotted at
  signature** — when the ladder rises an existing client's price must not move), `billing_starts_on`
  (go-live, not project start), `signed_on`, `dpa_signed_on`, `committed_months`,
  `min_term_ends_on`, `notice_given_on`, `ends_on`, status draft → proposed → active → notice → ended.
- **`charges`** — kind `build` / `monthly` / `change` / `addon` / `passthrough` / `pilot`. Amount,
  `due_on`, `milestone_id` (so "50% on go-live" fires when the milestone does), `approved_at`
  (clause 2.4: nothing billable without written approval), `credits_charge_id`, `evidence_url`.
- **`invoices`** — number, issued, due, status draft / sent / paid / overdue / **disputed** / void.
  Disputed is first-class because clause 2.5 protects it.

Plus a Money view: live monthly, outstanding, overdue, disputed.

Most of it is **wiring what already exists**: build instalments hang off `milestones`, and a
change order is a `project_plans` version with a price.

### The four decisions, taken as defaults (Ohav delegated: "what do u suggest")

All cheap to reverse.

1. **Pass-through infra** — a `passthrough` charge kind with an evidence URL, excluded from every
   revenue total. A field, not a module. Clause 2.3 makes us holding an account the exception.
2. **Partnership (clause 8.5)** — two columns, no separate code path. It is an agreement with the
   build fee at zero.
3. **Pilot credit** — model it. One `kind` plus a nullable `credits_charge_id`. By hand means the
   first pilot→build conversion invoices wrong.
4. **Invoice numbers** — `KD-2026-001`, sequential per year, **stored not derived**, format in
   config. Derived numbering renumbers history the moment a row is voided.

**Deliberately out of scope:** no ledger, no tax, no payment collection (Ohav avoids paid API
keys, and clause 2.2 is invoiced-in-advance — invoicing is not collecting), and **no automated
suspension** (clause 2.5 forbids degrading a live system over money without 30 days' notice).

### Two things that must be handled when this lands

- **`RETENTION` in `content/legal.js` has no row for client or financial records.** Financial
  records need years for tax, which sits against the delete-on-request posture on the privacy
  page. The page needs a line **before** this data exists — same class of miss as the Google
  Fonts entry found while writing the DPA.
- If `/admin` is ever shown to a prospect on a call, **every real client name in it is on screen.**

---

## 3. The verifier suite — run these, do not eyeball

All take a URL and default to `:8080`. Start the server on a free port first
(`PORT=8123 node server/index.js`) — and **kill by port, never `pkill -f`**, or a stale process
serves old code and you will misdiagnose correct work.

| Script | Checks | What it exists to catch |
|---|---|---|
| `scripts/verify-crawl.js` | 34 | The served HTML, **no browser**. Fails if the ladder stops reaching machines. Asserts against `content/pricing.js`, so a price rise cannot fail it and cannot let it pass while the page lies. |
| `scripts/verify-ask.js` | 39 | The picker: `product` not `chip`, parallel axes, no universal inside a card, no jump on screen at three widths. |
| `scripts/verify-scale.js` | 17 | The three-year comparison. |
| `scripts/verify-proof.js` | 10 | Consent flags and the no-JS flip. |
| `scripts/verify-hero.js` | — | Two headline lines at eleven widths. |

---

## 4. Traps

- **`content/pricing.js` is served to the browser as a plain script, so its comments ship.**
  Three times now, comments quoting removed copy have reached view-source. Check before writing
  reasoning into that file or into `index.html`.
- **`html{scroll-behavior:smooth}` (`styles.css:108`) applies to programmatic scrolling.** Any
  `scrollBy`/`scrollTo` that must not animate needs `behavior:'instant'` in the object form. A
  correction that animates is a jump followed by a slide — worse than the jump.
- **Measure the viewport, not the document, when asking "did the page move?"** `rect.top +
  scrollY` fails a page that is behaving, because `askAnchor()` moves the document on purpose.
  And wait for the scroll to land, or you measure mid-animation and pass a page that slides.
  Both mistakes were made here today.
- **`<!--{{ASK}}-->` is required.** Remove it and the pricing section renders as a bare heading
  and the site stops quoting a price to anyone. Only `server/index.js` logs it.
- **Do not reintroduce a client-side builder for the picker markup**, not even as a fallback. A
  second generator for the same markup is the drift `content/pricing.js` exists to prevent.
- **Heredocs are unreliable in this shell** for anything with backticks or `${}` — several
  patches silently failed today. Use Write/Edit for multi-line changes.
- **`process.exit()` on a live websocket or an open `fetch` pool makes libuv assert on Windows**
  and the run dies *after* every check passed. `verify-proof.js` uses `finish()`;
  `verify-crawl.js` closes the undici global dispatcher.

---

## 5. Open — carried forward, needs Ohav

- **The `tool` card says changes are "quoted as they come"** while the other three include them.
  Faithful to the recorded terms — it is the only rung whose monthly never promised change work,
  and it is half the reason $300 sits below $450. **Commercial call, deliberately not guessed.**
- **Rotate the Torah Tracker demo password.** `scripts/seed-torahtracker-demo.js` has it
  hardcoded and **the GitHub repo is public**. The account holds only invented data (449
  sessions, 235 days — the filler finished), so exposure is low, but it is a live credential. Take
  the web and app screenshots, then rotate; the script should then read it from an env var.
- **A static `/pricing` page.** Currently 404. Ariel asked for one and a canonical URL helps
  assistants cite you — but it creates a second pricing surface, which the section was
  deliberately built not to be. If built, render it from `askSection()` rather than writing it
  again. ~20 minutes.
- **Two phone numbers on the contact page** — 561 vs the 862 WhatsApp one.
- **Consent to name BridgeMTG, Horse & Harmony, Richmount.** They render anonymously via
  `publish:false` until then. Consent to name a *client* is not consent to publish the *people
  inside their system*.
- **Self-host Google Fonts** (privacy + speed; also a subprocessor on the privacy page).
- **Six `LEGAL_OPEN` items**; no legal page is lawyer-reviewed.
- **Remaining seeding:** PCG (Laravel seeders exist — recommended next), Autotask/MSP, ShipHero,
  TapSend, OLAMI-MASTER-MANAGER, BKH-Advocacy. **Back-office screenshots must come from a local
  instance on freshly seeded invented data — never production, never a dev DB synced from it.**
- **`/opt/backups/backup.sh` on the host has the MySQL root password in plaintext.** Not urgent on
  a single-admin box, but that host runs client systems; worth an env file with `chmod 600`.
- **Gallery / "See more"** — parked by Ohav's decision until the content is settled.
