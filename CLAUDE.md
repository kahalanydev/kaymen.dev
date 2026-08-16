# Claude Code Instructions

## On Every New Conversation

- **Always** read `HANDOFF-FRONTEND-2026-08-16.md` first — it is the most recent
  build document (hero, pricing section, the mark, the mobile pass). It says what
  landed, what is open, and the four things about the hero mesh that will
  otherwise be rediscovered the hard way.
- Then read `HANDOFF-BACKOFFICE-2026-08-16.md` — it is the **active** build document
  (admin, client portal, outbound email onto the site's design system). It says exactly what is
  done, what is next, and the traps.
- Then read `HANDOFF-REDESIGN-2026-08-15.md`. The redesign it describes is **landed and live**, but
  its §1 holds the LOCKED design decisions that still bind everything — palette, Sora + Inter, the
  always-labelled glass rail, the wide measure, the page structure. Do not re-open them.
- Then read `PROGRESS.md` and `APP-MAP.md`.
- Use these files to understand the current state of the project, what has been completed, and the overall application architecture.
- Do not ask the user for context that is already covered in these files.

## Four things that bite here

- **This is not a static site.** The marketing pages are server-rendered at request time by
  `server/render.js`. `index.html` is a template carrying three placeholders —
  `<!--{{WORK}}-->`, `<!--{{FLEET}}-->` and `<!--{{LIVE}}-->`. Remove one and that block
  silently vanishes; only `server/index.js` logs it.
- **`master` IS production, and it now auto-deploys.** The webhook was repointed to
  `admin.kaymen.dev` on 2026-08-15, so a push to `master` builds and goes live in ~10–20s.
  There is no staging branch — that is a documented exception, not an oversight. **Ohav
  pre-authorized pushing straight to prod on 2026-08-16** ("we aren't famous yet"), so ship
  without asking — but always verify the change is actually live rather than trusting the push.
  If a push ever stops deploying, the manual trigger is in `HANDOFF-REDESIGN-2026-08-15.md` §4.
- **The homepage numbers are generated, not written.** The fleet sparklines, the live-systems
  count and the stats band all come from `content/stats.js`, which
  `scripts/refresh-stats.js` writes from real git history and the Coolify API. Never hand-edit
  either the generated file or the numbers in the markup — re-run the script:
  `COOLIFY_TOKEN=... node scripts/refresh-stats.js`
- **The mark and the social cards are generated too, from different sources.** The mark is geometry
  in `content/logo.js`, and `node scripts/build-icons.js` writes every favicon, app icon, `.ico`,
  lockup and the whole `assets/brand/` handoff set from it. The OG cards in `assets/og/` come from
  `node scripts/build-og.js`, which reads its copy out of `index.html`, `content/projects.js` and
  `content/stats.js` rather than holding any of its own. **Change the homepage hero copy and the
  social card is stale until you re-run it** — that is exactly how `default.png` spent a day
  advertising a sentence the site no longer said. Never hand-edit anything in `assets/brand/` or
  `assets/og/`; the next run silently reverts it.
