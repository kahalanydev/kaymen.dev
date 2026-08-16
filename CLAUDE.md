# Claude Code Instructions

## On Every New Conversation

- **Always** read `HANDOFF-BACKOFFICE-2026-08-16.md` first — it is the **active** build document
  (admin, client portal, outbound email onto the site's design system). It says exactly what is
  done, what is next, and the traps.
- Then read `HANDOFF-REDESIGN-2026-08-15.md`. The redesign it describes is **landed and live**, but
  its §1 holds the LOCKED design decisions that still bind everything — palette, Sora + Inter, the
  always-labelled glass rail, the wide measure, the page structure. Do not re-open them.
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
