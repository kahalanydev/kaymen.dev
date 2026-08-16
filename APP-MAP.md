# kaymen.dev — Application Map

## Overview
Portfolio/showcase website for kaymen.dev (Kaymen Group LLC) — a custom software development practice. Node.js/Express backend with SQLite analytics database, admin panel, client portal, and visitor tracking. Deployed via Docker on Coolify. Both admin and portal are installable PWAs with mobile-first bottom navigation.

**Marketing site restructured 2026-08-13** (per `Kaymen Group LLC/marketing/MARKETING-PLAN.md` §7): the 19 flat project cards with CSS device mockups and a filter bar were replaced by **3 practice areas + 6 deep case studies** at `/work/<slug>`. Case studies are **server-rendered from `content/projects.js`** so crawlers and social scrapers get real HTML and real per-page OG tags. The old "Capabilities" section ("Whatever the stack, we've built with it") was removed — breadth-as-the-pitch was the specific thing the restructure set out to fix.

**Client naming is an interlock, not a style choice.** `CLIENT_NAMING` in `content/projects.js` is `'anonymous'`, per CHANNEL-PLAN.md §7 decision 4: no client name, logo, domain or product name appears anywhere. That decision is what removes the need for client consent — flipping the switch re-opens the consent question.

- **Live URL**: https://kaymen.dev (also https://kahalany.dev — legacy, parallel)
- **Repo**: https://github.com/kahalanydev/kaymen.dev
- **Coolify UUID**: `zcco40skss0o8wwocs40k4gs`

## Domains & Subdomains

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `kaymen.dev` | `178.156.245.71` (A) | Main site + admin + portal |
| `kahalany.dev` | `178.156.245.71` (A) | Legacy domain (parallel, to be retired) |
| `nodeai.kaymen.dev` | wildcard A | NodeAI app |
| `predictable.kaymen.dev` | wildcard A | Predictable stock analysis |
| `davenen.kaymen.dev` | wildcard A | Davenen prayer partner app |
| `shipai.kaymen.dev` | wildcard A | ShipHero AI warehouse assistant |
| `pcg.kaymen.dev` | wildcard A | Passaic Clifton Gemach |
| `torahtracker.kaymen.dev` | wildcard A | Torah Tracker |
| `torahtracker.app` | A record | Torah Tracker (primary domain) |
| `davenen.org` | external | Davenen (primary domain) |
| `code.kaymen.dev` | Cloudflare Tunnel | Claude Code Desktop server |
| `admin.kahalany.dev` | A record | Coolify dashboard |

### DNS (Cloudflare — kaymen.dev zone)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `178.156.245.71` | DNS only |
| A | `*` | `178.156.245.71` | DNS only |
| CNAME | `code` | `[tunnel-id].cfargotunnel.com` | Proxied (auto) |
| MX | `@` | Cloudflare Email Routing | — |

### Email

| Address | Forwards To |
|---------|-------------|
| `hello@kaymen.dev` | kahalanydev@gmail.com |
| `hello@kahalany.dev` | kahalanydev@gmail.com |

### Coolify App Registry

| App | UUID | Domain(s) |
|-----|------|-----------|
| Main site | `zcco40skss0o8wwocs40k4gs` | `kahalany.dev, kaymen.dev` |
| NodeAI | `gw840cgk8gscowck8kc80wo8` | `nodeai.kahalany.dev, nodeai.kaymen.dev` |
| Predictable | `og8w4kkkccw4ckcsgw4ws8sw` | `predictable.kahalany.dev, predictable.kaymen.dev` |
| Davenen | `cco0kccokg08okwsw8cssk48` | `davenen.kahalany.dev, davenen.kaymen.dev` |
| ShipHero AI | `o00gossow4c8s888ws48okso` | `shipai.kahalany.dev, shipai.kaymen.dev` |
| PCG | `nwg0s00oc8k8owo0sggkgkgg` | `pcg.kahalany.dev, pcg.kaymen.dev` |
| Torah Tracker | `dc4ccksssskkww0ckc00sg4s` | `torahtracker.app, torahtracker.kahalany.dev, torahtracker.kaymen.dev` |

## Tech Stack
- **Frontend** — vanilla HTML/CSS/JS, no framework, no build step
- **Backend** — Node.js + Express
- **Database** — SQLite via sql.js (WASM, pure JS — no native deps)
- **Auth** — JWT tokens + bcrypt password hashing
- **Charts** — Chart.js 4.x (CDN) in admin panel
- **Fonts** — Sora (display) + Inter (body) via Google Fonts. JetBrains Mono was dropped with the
  2026-08-15 redesign; code/monospace now uses the system stack.
- **Deployment** — Node.js Docker container on Coolify (Hetzner VPS)
- **SSL** — Let's Encrypt via Traefik (auto-provisioned)
- **Domain** — kaymen.dev on Cloudflare (DNS only, wildcard A record)
- **Email** — hello@kaymen.dev via Cloudflare Email Routing → kahalanydev@gmail.com
- **SMTP** — Nodemailer for outbound email (admin-configurable SMTP settings stored in DB)
- **File Uploads** — Multer with UUID filenames, MIME whitelist, extension blacklist
- **PWA** — Installable web apps for admin and portal (manifests, service workers, iOS meta tags)

## File Structure
```
Kaymen.Dev Site/
├── index.html              # Homepage TEMPLATE — contains <!--{{WORK}}--> placeholder
├── styles.css              # All styles (incl. legacy CSS device mockups, now unused on the homepage)
├── script.js               # Main site interactions: nav, theme, counters, animations, contact form
├── tracker.js              # Lightweight analytics tracker (scroll, clicks, sections)
├── favicon.svg             # Branded "K" favicon (SVG)
├── content/
│   └── projects.js         # SINGLE SOURCE OF TRUTH — practice areas, 6 case studies,
│                           # long tail, evidence strip, CLIENT_NAMING policy switch
├── assets/
│   └── og/                 # Generated 1200x630 OG cards (committed; see README there)
├── server/
│   ├── index.js            # Express entry point (port 8080), routes + static serving, contact form with spam protection
│   ├── render.js           # SSR for homepage sections, /work, /work/:slug, and the HTML 404
│   ├── db.js               # SQLite init, schema (17+ tables), wrapper, admin seeding, helpers
│   ├── middleware/
│   │   └── auth.js         # Auth: requireAuth, requireRole, enforceOrgScope, requireDevAuth, rateLimit
│   ├── routes/
│   │   ├── auth.js         # POST /api/auth/login, /change-password, GET/POST/DELETE /api/auth/users, SMTP config, Google OAuth
│   │   ├── track.js        # POST /api/track/visit, /api/track/event
│   │   ├── admin.js        # Admin API: dashboard, security, analytics, orgs, projects, milestones, tickets, plans, dev-keys, diagnostics
│   │   ├── portal.js       # Portal API: dashboard, projects, tickets, comments, activity, plan approval
│   │   ├── dev.js          # Dev API: bootstrap, sync, progress, project update, bulk milestones, ticket resolution (HMAC-signed)
│   │   └── uploads.js      # File upload/download/delete with auth-gated access
│   └── utils/
│       ├── detection.js    # Bot detection, rate tracking, suspicious activity logging
│       └── email.js        # ALL outbound email — one skinned wrapper + 8 templates.
│                           # Rewritten 2026-08-16: escapes user input, ships a
│                           # text/plain part. Route files must NOT hand-roll email
│                           # HTML; three of them did and drifted a whole palette behind.
├── admin/
│   ├── index.html          # Admin panel shell (PWA-enabled, loads Chart.js + app.js)
│   ├── styles.css          # Admin — locked design system, no token bridge (deleted 2026-08-16)
│   ├── app.js              # Admin SPA (dashboard, security, analytics, settings, projects console, clients, tickets)
│   ├── manifest.json       # PWA manifest (standalone, light-first)
│   └── sw.js               # Service worker (cache strategies, OAuth passthrough)
├── portal/
│   ├── index.html          # Client portal shell (PWA-enabled)
│   ├── styles.css          # Portal — locked design system, no token bridge (deleted 2026-08-16)
│   ├── app.js              # Portal SPA (login, dashboard, Reassurance overview, tickets, plans, activity)
│   ├── manifest.json       # PWA manifest (standalone, light-first)
│   └── sw.js               # Service worker (cache strategies)
├── scripts/
│   ├── refresh-stats.js    # Writes content/stats.js from git history + the Coolify API.
│   │                       # Every homepage number comes from here — never hand-edit them.
│   ├── seed-preview.js     # Boots server/index.js on a throwaway .preview-data/ and seeds
│   │                       # orgs/projects/milestones/plans/tickets/clients, then writes
│   │                       # token-planting _preview.html files. The only way to review
│   │                       # /admin and /portal — --screenshot cannot log in.
│   ├── preview-emails.js   # Renders all 8 outbound emails without sending
│   ├── build-mockup.js     # Builds mockup/back-office.html
│   └── build-directions.js
├── data/
│   └── analytics.db        # SQLite database (gitignored, persisted via Docker volume)
├── package.json            # Node.js deps: express, sql.js, bcryptjs, jsonwebtoken, helmet, etc.
├── Dockerfile              # node:20-alpine, port 8080
├── .dockerignore           # Excludes node_modules, data, .git, *.md
├── .gitignore              # Excludes node_modules/, data/
├── nginx.conf              # Legacy reference (no longer used — Express serves everything)
├── CLIENT-PORTAL-PLAN.md   # Full client portal architecture & implementation plan
├── APP-MAP.md              # This file
├── PROGRESS.md             # Development log
└── CLAUDE.md               # Claude Code instructions
```

## Architecture

### Request Flow
```
Client → Traefik (SSL) → Express (:8080)
  ├── /                    → SSR: index.html with {{WORK}} replaced by content sections
  ├── /work                → SSR: case study index
  ├── /work/:slug          → SSR: one case study (real HTML + per-page og:image)
  ├── /admin               → admin SPA (admin/index.html)
  ├── /portal              → client portal SPA (portal/index.html)
  ├── /api/auth/*          → auth routes (JWT login, user management, SMTP config, Google OAuth)
  ├── /api/track/*         → tracking endpoints (visits, events)
  ├── /api/admin/*         → admin data API (requires JWT + admin/staff role)
  ├── /api/portal/*        → portal data API (requires JWT + org-scoped access)
  ├── /api/dev/*           → dev API (requires HMAC signature, for Claude Code sync)
  ├── /api/uploads/*       → file upload/download/delete (auth-gated)
  ├── /api/contact         → contact form submission (rate-limited, honeypot + timing protected)
  └── 404                  → suspicious activity logger
```

### Contact Form Spam Protection
- **Honeypot field**: Hidden `_hp` input — bots filling all fields get a silent success (no error signal)
- **Timing check**: Form sends `_t` (ms since page load) — submissions under 2 seconds silently succeed
- **Lead tracking**: `project_name` field, `converted_at`/`converted_org_id` columns for future lead-to-client pipeline

### Database Schema (SQLite — 17 tables)

**Core (existing)**:
- **config** — key/value store (JWT secret, SMTP settings, Google OAuth config)
- **users** — all accounts: admin, staff, client (email, bcrypt hash, role, org_id, google_id, avatar_url)
- **visits** — visitor sessions (IP, UA, geo, device, referrer, bot flag)
- **events** — tracking events (pageview, click, section_view, heartbeat, leave)
- **suspicious_activity** — flagged events (rate spikes, scanner paths, bot UAs)
- **geo_cache** — IP geolocation cache (from ip-api.com)
- **contact_submissions** — contact form entries (name, email, message, ip, created_at)
- **contact_dismissals** — tracks which contact submissions have been dismissed by admin

**Client Portal (new)**:
- **organizations** — client companies
- **projects** — with lifecycle status machine (planning → proposed → approved → in_progress → review → completed → maintenance → archived). Portal phase indicator renders all 7 active phases.
- **project_members** — user-project assignments with roles
- **milestones** — project phases with status and sort order
- **tickets** — bug reports, feature requests, tasks, modifications, questions
- **ticket_comments** — with `is_internal` flag for admin-only notes
- **ticket_attachments** — file uploads (original name, stored UUID filename, MIME, size, uploader)
- **activity_log** — immutable audit trail for all state changes
- **project_plans** — versioned plans for client approval
- **dev_keys** — HMAC keys for Claude Code dev API
- **refresh_tokens** — prepared for token refresh flow

### Auth System
- JWT tokens (24h expiry), secret auto-generated and stored in DB
- First admin seeded on startup with random password (printed to console logs)
- `must_change_password` flag forces password change on first login
- Admins can add/remove other admins via Settings page
- **Role-based access**: `admin` (full access), `staff` (project management), `client` (portal only)
- **Org-scoped isolation**: Clients only see their own organization's data (returns 404 not 403)
- **Rate limiting**: In-memory per-IP limiting (60 req/min portal, configurable per endpoint)
- **HMAC dev API**: Prepared for Claude Code integration (SHA-256 signatures, 60s replay window)

### Tracker (tracker.js)
- Respects Do Not Track (DNT) header
- Generates session ID (sessionStorage)
- Tracks: page visits, scroll depth, section visibility, clicks on `data-track` elements
- Sends heartbeat every 30s, leave event on page unload
- Uses `sendBeacon` API for reliability

### Suspicious Activity Detection
- In-memory rate tracking per IP (>30/min = medium, >60/min = high)
- Bot user agent pattern matching (scanners, crawlers, automated tools)
- Scanner path detection (wp-admin, .env, phpmyadmin, etc.)
- All 404s logged with IP and UA for analysis

## Site Sections

### 1. Navigation
- Fixed top nav with blur backdrop on scroll
- Logo: `{ kahalany.dev }` in JetBrains Mono
- Links: Work, Capabilities, Process, Let's Talk (CTA)
- Theme toggle button (moon/sun icons) — switches between dark and light themes
- Mobile: hamburger → fullscreen overlay menu
- All nav links have `data-track` attributes

### 2. Hero
- Rotating text animation: "ships" / "scales" / "works" / "lasts"
- Green pulse "Available for new projects" badge
- Animated counters: 20+ Production Apps, 8 Tech Stacks, 12+ Live Platforms
- Two CTAs: "See Our Work" / "Start a Project" (tracked)
- Subtle grid background + radial glow

### 3. Evidence strip *(server-rendered)*
- 4 checkable facts, no adjectives. Replaces the old hero vanity counters — "8 Tech Stacks" was
  the clearest freelancer signal on the page and is gone deliberately.

### 4. Practice areas *(server-rendered)*
- 3 equal-weight cards: Platforms / Integrations / Apps. Equal weight is decision 1 (generalist);
  the nonprofit wedge is **not** the lead.
- Each card: promise, detail, 3 proof points, stack chips.

### 5. Selected work *(server-rendered)*
- 6 case-study teaser cards, uniform 3×2 grid → `/work/<slug>`
- Each teaser surfaces its **"The hard part"** title on the card. That section is the
  differentiator: it is what a portfolio of screenshots cannot fake.

### 6. Long tail *(server-rendered)*
- 12 further projects inside a collapsed `<details>`, grouped by practice area.
- Breadth is real and worth showing — it just must not be the pitch, so it is below the fold
  and closed by default.

### 7. Process ("How we work")
- 4-step vertical timeline

## Case Study Pages (`/work/<slug>`)

Template per MARKETING-PLAN.md §7: problem → constraints → what we built → **the hard part** →
outcome → stack. The hard-part block is the most visually distinct element on the page (accent
left border, elevated card, its own "What it taught us" aside) because it is the section that
does the selling. Each page carries prev/next navigation and a closing CTA band.

### 6. Contact ("What Do You Want to Build?")
- "Describe your idea" form: name, email, "What are you building?" (optional), message textarea
- Honeypot + timing-based spam protection (invisible to users)
- Submissions stored in DB + email notification sent to hello@kaymen.dev
- Rate limited: 1 submission per minute per IP
- "Or reach out directly" divider with:
  - WhatsApp link (wa.me/18623005027)
  - Email link: hello@kaymen.dev (tracked)

### 7. Footer
- Logo, nav links, copyright

## Admin Panel Pages

### Login
- Email/password form, JWT stored in localStorage
- Force password change on first login

### Dashboard (Command Center)
- **Top metrics row**: Active Projects, Open Tickets, Pending Approvals, New Leads, Visitors Today, This Month
- **Needs Attention card**: Urgent/high tickets, overdue milestones, pending plan approvals — each clickable to detail page. Green "all clear" state when empty.
- **Active Projects**: Progress bars, status badges, open ticket counts, clickable rows
- **Recent Activity**: Unified feed across all projects with user names and timestamps
- **Recent Visitors**: Slim 8-row table (IP, location, device, time) with link to Analytics
- **Contact Submissions**: Name, email, message preview, dismiss button, "new" badge count

### Security
- Alert banner for high-severity events
- Metrics: Human vs Bot counts, Suspicious events, Unique IPs
- Suspicious Activity log table (severity, IP, reason, details)
- Top IPs table with bot/human badges
- Flagged IPs table (aggregated incidents)
- Full Visitor Log with ISP info

### Analytics
- Visitors line chart (last 30 days, Chart.js)
- Section engagement horizontal bar chart
- Visits by hour bar chart
- Device breakdown doughnut chart
- Click tracking table
- Referrer sources table
- Browser breakdown table
- Average scroll depth metric

### Settings (sectioned layout)
- **Account & Security**: Change password form + Google OAuth configuration (client ID, secret, enable/disable)
- **Integrations**: Claude Code (server URL, pairing, connection status) + Notifications (SMTP config, ticket webhook URL)
- **Dev Tools**: Dev Keys management (create, revoke HMAC keys) + Dev API Diagnostics (active keys, recent resolutions, open tickets, "Run Check" button)
- **Team Management**: All users table with role badges (admin/staff/client), status, reset PW, remove, add new admin form

### Email & Notification System
- **Nodemailer** with admin-configurable SMTP (settings stored in `config` table)
- **Welcome emails**: Sent when admin creates new admin/staff/client user — includes invite link
- **Password reset emails**: Sent when admin resets a user's password
- **Contact notifications**: New contact form submissions emailed to hello@kaymen.dev
- **Ticket notifications**: Email all admin/staff when a client creates a ticket
- **Ticket webhook**: Configurable POST webhook (JSON payload) on ticket creation
- **Graceful fallback**: If SMTP not configured, logs to console instead of failing

## Client Portal Pages

### Login
- Email/password form, JWT stored in localStorage as `portal_token`
- Accepts client, admin, and staff roles (admin/staff can preview portal by adding themselves as project members)

### Dashboard
- Smart welcome banner with project summary ("2 projects active, 1 awaiting your approval")
- **Hero project cards** with SVG circular progress rings (animated fill)
- Milestone dot indicators (green = done, gray = pending) and "Up next: [milestone]" preview
- Countdown to target date or "X days overdue" warning in red
- **2-column widget grid** below hero cards:
  - **Left column**: Milestone Spotlight (active/upcoming milestones with status indicators) + Ticket Summary (open/in-progress/closed counts, recent tickets list) + Quick Actions (create ticket per project)
  - **Right column**: Compact Activity Feed (8 items, collapsed duplicates with multiplier badges)

### Project Overview — "Reassurance" (`renderProject`)
Rebuilt 2026-08-16. A client logs in a couple of times a month for one reason: is my thing on
track, and does anyone still care about it. The screen answers that in a sentence, then shows the
evidence.

- **Status sentence** in 38px Sora, DERIVED on every render by `statusSentence()` from milestones,
  dates and tickets — never a stored string. A late project says so. The lead paragraph underneath
  assembles only facts it can prove: stages done, current stage and whether it is late, the
  pressing ticket by number, the last stage's date.
- **"Yours to do"** (`buildTodo`) — rendered **only when it has contents**, because an empty
  to-do column reads as neglect exactly when things are going well. Two derivable items: a plan in
  `proposed` awaiting approval (hero card), and tickets in `review` that need the client to confirm
  the fix. "We are blocked on you" is *not* built — no schema field records it (handoff §6).
- **Timeline** (`.tl`), spine lit to the real completion figure via a `--lit` custom property.
- **Ring** (132px) with stages done, days in and target date.
- **"What has happened"** — the activity feed as dated prose rather than icon rows.
- Two API calls in parallel: the project response carries only an open-ticket *count*, and both the
  sentence and the to-do block need the tickets themselves.

The phase indicator bar, the 4-stat overview card and the older node timeline still exist in
`portal/app.js` and `portal/styles.css`; the overview no longer uses them.

### Plan View
- Project plan content display
- Approve button (only for `proposed` status projects)
- Approval triggers project start + first milestone activation

### Tickets
- Filter tabs: All, Open, In Progress, Closed
- Type and priority filters
- Create new ticket form (types: task, bug, feature_request, modification, question)
- Ticket detail with comment thread and reply form
- Internal comments hidden from clients

### Activity Feed
- Paginated activity log for project
- Filters out internal actions automatically

## Admin Panel Extensions (Client Portal)

### Projects Console (`renderConsole`)
One two-pane screen, not a list page plus a detail page. `#/projects` and `#/projects/:id` both
render it; picking a project swaps only the right pane.
- **Left pane**: projects grouped by status (in progress → review → approved → proposed → planning
  → maintenance → completed → archived), each row carrying org, open-ticket count and progress bar.
  The count turns alert-toned only when `urgent_tickets > 0` — severity, not volume.
- **Right pane**: header with inline status `<select>`, five-figure stat strip (progress,
  milestones, open tickets, days active, days remaining), milestones with inline status + delete,
  plan meta, member chips, ticket table with inline status, activity log.
- **Plan panel** opens full-width beneath both panes: View / Edit / History, one mode at a time.
- **⌘K / Ctrl-K** focuses a filter over the project list (not a global palette — see handoff §6).
- Selection uses `history.replaceState`, so the router is never re-entered. `renderLayout()` clears
  the console's `mounted` flag, so any other page render invalidates it.
- Create project form with org selection, above the panes.
- The Claude Code chat pane is **not** part of this screen (removed 2026-08-16).

### Clients Page
- Organization list with user counts
- Create organization form
- Add client users with invite link (email sent automatically)
- Cross-org user assignment: adding a user from another org creates `project_members` entries
- User table per org with Reset PW and Remove buttons
- Cross-org badge for users from other organizations

### Ticket Management
- **Inline status change**: Project detail ticket rows have dropdown for instant status change without navigation
- Status/priority/assignment controls on ticket detail page
- Comment thread with internal note option (yellow-bordered)
- Post as public or internal comment
- Auto-notifications on creation (email + webhook)
- **Dev API resolve** accepts both UUID and ticket number (with `project_id` fallback)

### Claude Code Integration — widget removed 2026-08-16
The chat widget that used to sit in the project-detail grid is **gone**: Ohav's call is that the
widget is to be replaced by an agent that scans incoming tickets, so it was dropped rather than
re-skinned when the projects page became the Dense console.

What remains and still works:
- The `cc` client module in `admin/app.js` — token management, pairing, folder map, WebSocket.
- The **Settings → Claude Code card**: server URL, 6-digit pairing code, connection status,
  disconnect. Pairing against the Claude Code Desktop server still works from there.
- Architecture, unchanged: Browser ↔ Cloudflare Tunnel ↔ localhost:3141 ↔ Claude CLI.

The ticket-resolution pipeline never went through this widget — it runs over the HMAC dev API and
the Desktop portal-sync service, both untouched.

### Portal Sync Service (Claude Code Desktop)
- Polls every 5 min + startup sync for ticket/milestone changes
- **Scaffolds projects** with `.portal.json`, `.portal/tickets/`, `.portal/scripts/resolve-ticket.js`, and `CLAUDE.md`
- **Resolve script**: Node.js helper (`resolve-ticket.js`) handles HMAC signing natively — Claude Code runs it via `node .portal/scripts/resolve-ticket.js`
- **Push sync**: Pushes dirty milestone updates + locally resolved tickets (falls back to ticket number when UUID missing)
- **Credential refresh**: Updates `.portal.json` API credentials from Desktop store on every sync cycle

## Dev API Endpoints (`/api/dev/*` — all HMAC-signed)
- `POST /api/dev/bootstrap` — Create org + project in one call (idempotent)
- `GET /api/dev/sync` — Pull changes since last sync (milestones, tickets, comments)
- `GET /api/dev/projects/pending` — List approved but unscaffolded projects
- `POST /api/dev/projects/:id/scaffolded` — Mark project as scaffolded, start first milestone
- `POST /api/dev/projects/:id/update` — Update project metadata (status, dates, tech_stack, etc.)
- `POST /api/dev/projects/:id/milestones` — Bulk create milestones (with optional `replace: true`)
- `POST /api/dev/progress` — Push milestone updates with auto-progress recalculation
- `POST /api/dev/tickets/:id/resolve` — Close ticket (accepts UUID or ticket number + project_id)
- `GET /api/dev/tickets/:id/full` — Complete ticket detail with all comments
- `POST /api/dev/activity` — Log dev events (code_pushed, deploy_triggered, etc.)

## Mobile & PWA

### Mobile Layout (≤768px)
- **Card tables** (`.mobile-cards`): Tables transform into card-per-row layout. `thead` hidden, each `td` becomes flex row with column header via `content: attr(data-label)`
- **Bottom navigation**: Fixed bottom bar with 5 main nav items (icon + label), replaces sidebar. Press feedback via `scale(0.88)` on `:active`. iPhone notch-safe via `env(safe-area-inset-bottom)`
- **Mobile top bar**: Fixed top-right with theme toggle, settings gear, logout button
- **Metrics grid**: Forces 2 columns on mobile (was single column)

### PWA
- **Manifests**: `display: standalone`, dark theme colors, favicon as icon
- **Service workers**: Navigation passthrough (for OAuth), network-first API calls, stale-while-revalidate static assets
- **iOS meta tags**: apple-mobile-web-app-capable, black-translucent status bar, viewport-fit=cover
- **Theme-color sync**: Meta tag updates to match current dark/light theme

## Theming

**Light-first, single theme. Dark mode was dropped, not deferred** — see
`HANDOFF-REDESIGN-2026-08-15.md` §5. Do not ship a half-working one.

| Surface | State |
|---|---|
| Main site | Light only. Toggle removed in the 2026-08-15 redesign. |
| Admin | Light only. Toggle removed 2026-08-16; a stale `admin_theme` key is actively cleared on boot. |
| Portal | Light only. Toggle removed 2026-08-16; a stale `portal_theme` key is actively cleared on boot. |

Both PWA manifests declare `#ffffff` for `theme_color` and `background_color`. They carried the old
`#09090b` until 2026-08-16, which made an installed admin or portal flash dark on every launch.

Admin and portal stylesheets **used to carry a legacy token bridge** — the old dark theme's variable
names (`--surface-3`, `--text-dim`, `--danger` …) remapped onto the new palette, because the SPAs
carried several hundred inline styles written against them. **Both bridges were deleted in the
2026-08-16 sweep**: those inline styles are classes now, and
`grep 'var(--surface|--text-dim|--danger|--border)' admin/app.js portal/app.js` returns nothing.
Do not reintroduce a bridge name to make a new inline style work — add a class to the stylesheet.

Each sheet instead carries a small **utility layer** (`.hint .row .meta .divide .in .mono .mt-s
.field-label`) plus real components for the pages that earned them — admin ticket detail and clients
(`.t-head .att .drop .cmt .org-user`), which the portal's ticket detail reuses.

The last holdouts were inside the portal's `progressRing()`, which drew with
`stroke="var(--surface-3)"` and `fill="var(--text)"` *inside SVG* — where a missing variable renders
as nothing at all rather than as an obviously wrong colour. Worth remembering before putting a CSS
variable inside an SVG attribute again.

## Deployment
- **Docker**: `node:20-alpine` runs Express on port 8080
- **Coolify**: public repo, auto-deploys via GitHub webhook
- **Traefik**: routes `kahalany.dev` → container:8080, auto-SSL
- **Persistent storage**: Docker volume `kahalany-dev-data` mounted at `/app/data` (configured in Coolify DB, survives redeploys)
- **SMTP**: Gmail via App Password, configured in admin Settings (stored in DB, not in code)
- **First run**: check Coolify deployment logs for the initial admin password
- **Deploy workflow**: commit + push to GitHub → Coolify auto-deploys via webhook (manual_webhook_secret_github)
