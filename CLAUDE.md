# Claude Code Instructions

## On Every New Conversation

- **Always** read `HANDOFF-REDESIGN-2026-08-15.md` first — it is the active build document for
  the site redesign, and it records design decisions that are LOCKED and must not be re-opened
  (palette, the always-labelled glass rail, the wide measure, the page structure).
- Then read `PROGRESS.md` and `APP-MAP.md`.
- Use these files to understand the current state of the project, what has been completed, and the overall application architecture.
- Do not ask the user for context that is already covered in these files.

## Three things that bite here

- **This is not a static site.** The marketing pages are server-rendered at request time by
  `server/render.js`. `index.html` is a template carrying three placeholders —
  `<!--{{WORK}}-->`, `<!--{{FLEET}}-->` and `<!--{{LIVE}}-->`. Remove one and that block
  silently vanishes; only `server/index.js` logs it.
- **`master` IS production, and it now auto-deploys.** The webhook was repointed to
  `admin.kaymen.dev` on 2026-08-15, so a push to `master` builds and goes live in ~10–20s.
  There is no staging branch — that is a documented exception, not an oversight. Confirm with
  Ohav before pushing. If a push ever stops deploying, the manual trigger is in
  `HANDOFF-REDESIGN-2026-08-15.md` §4.
- **The homepage numbers are generated, not written.** The fleet sparklines, the live-systems
  count and the stats band all come from `content/stats.js`, which
  `scripts/refresh-stats.js` writes from real git history and the Coolify API. Never hand-edit
  either the generated file or the numbers in the markup — re-run the script:
  `COOLIFY_TOKEN=... node scripts/refresh-stats.js`
