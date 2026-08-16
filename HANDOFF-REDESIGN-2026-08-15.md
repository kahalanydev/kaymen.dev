# kaymen.dev — redesign build handoff

**Written 2026-08-15.** Read this plus `PROGRESS.md` and `APP-MAP.md` before touching the site.
Canonical memories: `kaymen-group/offer-is-build-and-run`, `kaymen-group/retainer-pricing-ladder`,
`kahalany-dev-site/kahalany-dev-site-deploy`, `kahalany-dev-site/site-rebuild-2026-08-13`.
Strategy and pricing rationale live in `C:\KDEV\Personal\Kaymen Group LLC\marketing\HANDOFF-2026-08-15.md`.

---

## 0. Where this work lives — decided

**It lives here, in this repo. Do not create a new folder under `Personal\`.**

The question was whether to start `Personal\KaymenDev site\` fresh. The answer is no, and it is
not close. This folder is not a static marketing page that can be forked off — it is the whole
product:

| | |
|---|---|
| Repo | `github.com/kahalanydev/kaymen.dev`, branch `master` (no staging branch) |
| Runtime | Express (`server/index.js`), Node 20, `Dockerfile` → port 8080 |
| Marketing site | **Server-rendered** at request time by `server/render.js` from `content/projects.js` |
| Also serves | `/admin` analytics panel, `/portal` client portal, `/api/*` routes |
| State | SQLite via `sql.js` → `data/analytics.db`, plus `data/uploads/tickets` |
| Deployed | Coolify app `zcco40skss0o8wwocs40k4gs` on `admin.kaymen.dev` (box `178.156.245.71`) |
| Live at | kaymen.dev (and kahalany.dev) |

A new folder would separate the front end from its own renderer, its analytics DB, its portal,
its Dockerfile and its Coolify app — and then need all of them rebuilt. The redesign is a
**visual-layer replacement inside this repo**, not a new project.

### On the folder name — DONE 2026-08-15

The folder is now **`C:\KDEV\Personal\Kaymen.Dev Site`**, and the GitHub repo is
**`kahalanydev/kaymen.dev`**. Both were renamed after the redesign shipped, per
`REBRANDING-PLAN.md` Plan A. What was done, in order:

1. Folder renamed. `unified-memory/_aliases.yaml` updated — `canonical_path` plus the new
   `C--KDEV-Personal-Kaymen-Dev-Site` slug, old slugs kept — then `node generate.js` re-run from
   `C:\KDEV\unified-memory`.
2. Repo renamed with `gh repo rename`. GitHub keeps the webhook (same id) and redirects the old
   URL, but the local remote was repointed anyway rather than left on a redirect.
3. Coolify's `git_repository` PATCHed to `kahalanydev/kaymen.dev` and the app renamed to
   "Kaymen Dev Site". **This is the step that actually matters** — the redirect would have masked
   a stale value until the day GitHub stopped honouring it.

**The canonical memory ID is still `kahalany-dev-site`, deliberately.** Renaming it would orphan
`unified-memory/projects/kahalany-dev-site/` and every memory under it, which is the exact
failure the alias map exists to prevent. Folder name and canonical ID are allowed to disagree.

Still on the old name: the GitHub **account** `kahalanydev` (renaming a personal account touches
every repo under it — its own decision), and the Docker volume `kahalany-dev-data` (renaming it
risks the analytics DB; not worth it).

---

## 1. Design decisions — LOCKED, do not re-open

Two full option sweeps were already spent and rejected (4 structures, 5 palettes). Everything
below is settled. If something here feels wrong, raise it — do not quietly sweep it again.

| Decision | Value | Locked |
|---|---|---|
| **Palette** | The Kaymen Group one, verbatim | 2026-08-15 |
| **Display face** | Sora (body: Inter) | 2026-08-15 |
| **Navigation** | Floating glass rail, **always labelled** | 2026-08-15 |
| **Rail side** | Left | default |
| **Measure** | **Wide** — `--w-page: 1120px`, `--w-prose: 760px` | 2026-08-15 |
| **Structure** | Hero · routing · running board · case studies · pricing · no-hostages · contact | 2026-08-14 |

### The palette

Lifted from `C:\KDEV\Personal\Kaymen Group LLC\styles.css` so the two properties match by
construction rather than by taste:

```css
--accent:#2bbcb3;  --accent-dark:#229e96;  --accent-soft:rgba(43,188,179,.08);
--ink:#1a1b1e;     --muted:#5f6368;
--bg:#ffffff;      --bg-alt:#f4f5f7;       --line:#e2e4e8;
--deep:#16303d;    /* the ONE dark band — from that site's card gradients */
```

One accent. One dark band on the whole page. That restraint is the point — the previous round
was rejected as *"too much."*

### The rail

Always 224px, always labelled, floating `clamp(26px, 3.4vw, 68px)` off the screen edge. Hover-to-
collapse was built and then **deliberately deleted** — do not reintroduce it. A sliding lozenge
follows the active section via IntersectionObserver, and a hairline down the outer edge tracks
scroll depth. Below 900px it becomes a bottom glass tabbar.

The glass recipe (blur + saturate + specular top highlight + inner hairline) came from
`C:\KDEV\Personal\Kartov\mockups\tabbar-glass.html` — that is the Apple-accurate one. Reuse it,
do not re-derive it.

**Consequence to remember:** because the rail is permanently 224px, the content column has to
clear `rail-offset + rail-width + gap` or it slides underneath at ~1440px. That is why `.page`
uses a computed `padding-left` rather than a fixed one.

---

## 2. The reference build

**`mockup/v3-quiet.html`** — one self-contained file, both decisions baked in, dev toggles removed.
This is the target. It is a mockup, not shippable code: real content, placeholder data in one
place (see §5), images inlined as base64 because the Claude Code UI serves one file with no
siblings.

Superseded, keep only for reference: `mockup/directions-v2.html` (where the structure came from),
`mockup/hybrid-palettes.html` (**dead** — all five rejected), `mockup/site-mockup.html`.

---

## 3. Build plan — LANDED 2026-08-15

**All six steps below are done and live on kaymen.dev.** Kept as the record of what was intended
and why, not as a to-do list. See the 2026-08-15 entry in `PROGRESS.md` for what actually
shipped, including the places the implementation deliberately departed from this plan.

Two departures worth knowing before you read on: the contact form was **kept** (the mockup's
contact buttons were `href="#"` placeholders and `/api/contact` is real), and the fleet panel is
**server-rendered from generated data** rather than drawn client-side — see §5, which is resolved.

The uncommitted 2026-08-13 round rebuilt the **content layer**, which is good and stays. The
visual layer is what gets replaced.

### Keep — do not touch
- `content/projects.js`, `content/demos.js` — the content model is sound.
- `server/render.js`, `server/index.js` — SSR is correct and deliberate (crawlers and
  social-card scrapers get the same HTML a browser does). `index.html` is a template with a
  `<!--{{WORK}}-->` placeholder; `renderHome()` substitutes it with a **function** replacement,
  because rendered content contains `$` runs that a string replacement would eat.
- `admin/`, `portal/`, `server/routes/*`, `tracker.js`, `data/`.

### Replace
1. **`styles.css`** — port the mockup's CSS. It is currently written for the old dark palette
   and the 19-card/practice-area layout. Take the mockup's token block wholesale, then the rail,
   fleet panel, shot strip, board, cases, plans, terms.
2. **`index.html`** — the shell: rail markup, mobile tabbar, hero two-column grid, and the
   sections that are not server-rendered. Keep `<!--{{WORK}}-->` exactly where the running board
   and case studies should land.
3. **`server/render.js`** — update the emitted markup to the new class names. The data going in
   does not change; only the HTML around it does.
4. **`script.js`** — add the scroll-spy, lozenge, scroll-progress, reveal and routing-question
   handlers from the mockup. Keep the existing theme toggle only if a dark mode is still wanted —
   the new palette is light-first and dark mode is **not** designed yet.

### Then
5. Swap the inlined base64 screenshots for real files under `assets/shots/` served normally —
   base64 was only for the single-file mockup.
6. Regenerate OG images. `assets/og/*.png` are all in the **old dark palette** and now clash.
   `_tools/showcase/gen-og.mjs` builds them.
   *Done 2026-08-15.* The generator was redesigned onto `--deep` + the one accent + Sora, and each
   card now carries **one** figure rather than three — the note that they "read as mini-brochures"
   was right, and three numbers at feed thumbnail size means none of them survives. Case-study
   cards lead with their strongest figure and their hard-part title. Run it with the site path:
   `node C:/KDEV/_tools/showcase/gen-og.mjs "C:/KDEV/Personal/Kaymen.Dev Site"`

---

## 4. Do not break these

- **Auto-deploy was FIXED on 2026-08-15.** The repo's GitHub webhook (id 603404325) used to POST
  to the dead `admin.kahalany.dev`, return 200 and build nothing. It now points at
  `https://admin.kaymen.dev/webhooks/source/github/events/manual` with the app's existing
  `manual_webhook_secret_github`, and a push to `master` builds and goes live in ~10–20s —
  verified end to end, not just by a 200 from the webhook.
  Still verify after pushing (`curl https://kaymen.dev`), because a 200 from the hook never
  proved anything. If it stops working, the manual fallback is
  `POST https://admin.kaymen.dev/api/v1/deploy?uuid=zcco40skss0o8wwocs40k4gs` with a bearer token.
- **`admin.kahalany.dev` is a different, older box** and returns 401. A wrong host is
  indistinguishable from a revoked token, which has cost real time before.
- **`master` is production.** This repo has no staging branch — that is an explicit documented
  exception, not an oversight. Per `ask-before-shared-infra-changes`, confirm before pushing.
- The `<!--{{WORK}}-->`, `<!--{{FLEET}}-->` and `<!--{{LIVE}}-->` placeholders must survive any `index.html` rewrite, or those blocks
  silently vanish (`server/index.js` logs it, nothing else does).

---

## 5. Open — needs work or a decision

**Wire the fleet panel to real data.** The hero graphic draws active-days-per-month per system,
which is the measured series `retainer-pricing-ladder` was derived from — so it renders the
pricing evidence instead of asserting it. **The twelve-month series in the mockup is placeholder
(`FLEET` in the inline script).** Derive it from commit history per repo before this ships;
publishing invented activity numbers next to published prices is exactly the wrong trade.

**Build the seeded demo tenants.** This is now the highest-value asset gap. `_tools/showcase/out/publish/`
holds 25 real PII-verified screenshots, but they are almost entirely **public marketing pages,
not product interiors** — Predictable is the only genuine interior, and both Torah Tracker shots
came out blank. The screenshot that actually sells is a populated admin with data in it, and it
does not exist. The demo tenants were green-lit for exactly this and are still unbuilt.

**Decide client naming per project.** `CHANNEL-PLAN.md` §7 row 4 ("no client branding anywhere")
is superseded — naming is now three tiers, named / shadowed / silent. Two consequences, neither
done:
- `content/projects.js` still has a global `const CLIENT_NAMING = 'anonymous'` plus the gate at
  `_tools/showcase/src/capture.mjs:118`. Both must become a **per-project field**.
- Four usable screenshots are client properties — `olami-herzliya`, `horse-harmony`, `richmount`,
  `joinnode`. **None were used in the mockup**, because that is your call, not mine. The three
  that are in it (Predictable, Kartov, Davenen) are our own and need no consent.

**Dark mode is undesigned.** The old site had a theme toggle. The new palette is light-first and
no dark variant exists. Either design one or drop the toggle — do not ship a half-working one.

---

## 6. Verifying visual work

Headless Chrome is the only browser automation on this machine
(`C:\Program Files\Google\Chrome\Application\chrome.exe`). Two traps, both documented in the
`headless-chrome-page-review` memory:

- `--screenshot` **always captures from the top of the document.** Anchors and `scrollTo` are
  ignored. To photograph a lower section, cut the HTML so that section is the top of the document.
- The window **will not go below 500px wide**, so `--window-size=390,844` silently gives you a
  500px viewport and never tests the phone layout. Put the page in a `<iframe width="390">` and
  screenshot the wrapper — an iframe has its own layout viewport with no floor.
