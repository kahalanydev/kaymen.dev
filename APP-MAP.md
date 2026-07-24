# kaymen.dev — Application Map

## Overview
Portfolio/showcase website for kaymen.dev (Kaymen Group LLC) — a custom software development practice. Node.js/Express backend with SQLite analytics database, admin panel, client portal, and visitor tracking. Deployed via Docker on Coolify. Showcases 19 project cards with CSS device mockups, project filtering, and responsive design. Both admin and portal are installable PWAs with mobile-first bottom navigation.

- **Live URL**: https://kaymen.dev (also https://kahalany.dev — legacy, parallel)
- **Repo**: https://github.com/kahalanydev/kahalany.dev
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
- **Fonts** — Inter (body) + JetBrains Mono (code/accents) via Google Fonts
- **Deployment** — Node.js Docker container on Coolify (Hetzner VPS)
- **SSL** — Let's Encrypt via Traefik (auto-provisioned)
- **Domain** — kaymen.dev on Cloudflare (DNS only, wildcard A record)
- **Email** — hello@kaymen.dev via Cloudflare Email Routing → kahalanydev@gmail.com
- **SMTP** — Nodemailer for outbound email (admin-configurable SMTP settings stored in DB)
- **File Uploads** — Multer with UUID filenames, MIME whitelist, extension blacklist
- **PWA** — Installable web apps for admin and portal (manifests, service workers, iOS meta tags)

## File Structure
```
Kahalany.Dev Site/
├── index.html              # Main site (single-page, 6 sections + 9 portfolio cards)
├── styles.css              # All styles including CSS device mockups
├── script.js               # Main site interactions: nav, filters, counters, animations, contact form
├── tracker.js              # Lightweight analytics tracker (scroll, clicks, sections)
├── favicon.svg             # Branded "K" favicon (SVG)
├── server/
│   ├── index.js            # Express entry point (port 8080), routes + static serving, contact form with spam protection
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
│       └── email.js        # Nodemailer SMTP email (welcome, password reset, contact, ticket notifications)
├── admin/
│   ├── index.html          # Admin panel shell (PWA-enabled, loads Chart.js + app.js)
│   ├── styles.css          # Admin dark/light theme styles + mobile card tables + bottom nav
│   ├── app.js              # Admin SPA (dashboard, security, analytics, settings, projects, clients, tickets, Claude Code chat)
│   ├── manifest.json       # PWA manifest (standalone, dark theme)
│   └── sw.js               # Service worker (cache strategies, OAuth passthrough)
├── portal/
│   ├── index.html          # Client portal shell (PWA-enabled)
│   ├── styles.css          # Portal dark/light theme styles + mobile card tables + bottom nav
│   ├── app.js              # Portal SPA (login, dashboard, projects, tickets, plans, activity)
│   ├── manifest.json       # PWA manifest (standalone, dark theme)
│   └── sw.js               # Service worker (cache strategies)
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
  ├── /                    → static index.html + assets
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

### 3. Portfolio (Work)
- **Filter bar**: All / Web Apps / Mobile / AI·ML / WordPress (tracked)
- **19 project cards** (flagship Thrive first), each with CSS device mockup, tech tags, status badge
- "View Live" links for deployed projects (tracked)
- Filter uses `data-tags` attributes, JS toggles `.hidden` class

### 4. Capabilities
- 6 cards in 3-column responsive grid

### 5. Process ("How We Work")
- 4-step vertical timeline

### 6. Contact ("What Do You Want to Build?")
- "Describe your idea" form: name, email, "What are you building?" (optional), message textarea
- Honeypot + timing-based spam protection (invisible to users)
- Submissions stored in DB + email notification sent to hello@kahalany.dev
- Rate limited: 1 submission per minute per IP
- "Or reach out directly" divider with:
  - WhatsApp link (wa.me/18623005027)
  - Email link: hello@kahalany.dev (tracked)

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
- **Contact notifications**: New contact form submissions emailed to hello@kahalany.dev
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

### Project View
- **Phase indicator bar**: 6-step horizontal bar (Planning → Proposed → Approved → In Progress → Review → Completed) with checkmarks for passed phases, glowing blue for current
- **SVG progress ring** (120px) with 4 stat cards: milestones done, open tickets, days active, days remaining
- **Ticket action buttons** (View Tickets / Create Ticket) in top-right of stats overview card
- **Side-by-side grid** (1.4fr 1fr):
  - **Left**: Visual milestone timeline with vertical connected nodes (green checkmark = completed, pulsing blue = in progress, hollow gray = upcoming, green connector line up to current)
  - **Right**: Compact activity feed with collapsed duplicates

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

### Projects Page
- Project list with progress bars, status badges, org assignment
- Create project form with org selection
- Project detail in 3 grid rows: Milestones + Claude Code | Plan + Tickets | Members + Activity

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

### Claude Code Integration (Project Detail)
- Chat widget in grid-2 right column (next to Milestones) on every project detail page
- Connects to Claude Code Desktop server (`code.kahalany.dev`) via CORS + JWT auth
- Pairing flow: 6-digit code from Claude Code Desktop startup
- Folder mapping: select local project folder from CC server's folder list
- Real-time streaming: WebSocket connection for `claude:stream`, `claude:tool-use`, `claude:done` events
- Chat features: markdown rendering, tool use badges, send/stop/reset, in-memory history
- **Auto-refresh**: Tickets table refreshes automatically after Claude Code completes a response
- Architecture: Browser ↔ Cloudflare Tunnel ↔ localhost:3141 (Claude Code server) ↔ Claude CLI

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
- **Dark/light mode** across all three frontends (main site, admin, portal)
- CSS custom properties with `[data-theme="light"]` overrides
- Theme toggle buttons on each frontend
- Persistence via localStorage (separate keys: `theme`, `admin_theme`, `portal_theme`)
- Default: dark theme

## Deployment
- **Docker**: `node:20-alpine` runs Express on port 8080
- **Coolify**: public repo, auto-deploys via GitHub webhook
- **Traefik**: routes `kahalany.dev` → container:8080, auto-SSL
- **Persistent storage**: Docker volume `kahalany-dev-data` mounted at `/app/data` (configured in Coolify DB, survives redeploys)
- **SMTP**: Gmail via App Password, configured in admin Settings (stored in DB, not in code)
- **First run**: check Coolify deployment logs for the initial admin password
- **Deploy workflow**: commit + push to GitHub → Coolify auto-deploys via webhook (manual_webhook_secret_github)
