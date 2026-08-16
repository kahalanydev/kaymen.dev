# Claude Code Instructions

## On Every New Conversation

- **Always** read `HANDOFF-REDESIGN-2026-08-15.md` first — it is the active build document for
  the site redesign, and it records design decisions that are LOCKED and must not be re-opened
  (palette, the always-labelled glass rail, the wide measure, the page structure).
- Then read `PROGRESS.md` and `APP-MAP.md`.
- Use these files to understand the current state of the project, what has been completed, and the overall application architecture.
- Do not ask the user for context that is already covered in these files.

## Two things that bite here

- **This is not a static site.** The marketing pages are server-rendered at request time by
  `server/render.js` from `content/projects.js`. `index.html` is a template containing a
  `<!--{{WORK}}-->` placeholder — if that placeholder is removed, the work sections silently vanish.
- **`master` is production and auto-deploy is BROKEN.** A `git push` does not deploy; the
  webhook still points at a dead host and returns 200 without building. See
  `HANDOFF-REDESIGN-2026-08-15.md` §4 for the manual trigger.
