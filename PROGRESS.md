# Kahalany.Dev Site — Progress Log

> Portfolio/showcase site for Kahalany.Dev custom software practice.
> Live at: https://kahalany.dev
> Repo: https://github.com/kahalanydev/kaymen.dev

---

## 2026-03-25 — Initial Build & Launch

### Context
Reviewed the entire C:\KDEV project directory (~12 projects) to assess readiness for offering custom software development services. Conclusion: ready — the portfolio spans full-stack web, mobile, desktop, AI/ML, WordPress, and infrastructure. Built and deployed a portfolio site to showcase the work.

### Phase 1: Portfolio Assessment
- Scanned all 12+ project folders in C:\KDEV
- Read PROGRESS.md, CLAUDE.md, and APP-MAP.md files across all projects
- Verified 4 live sites: nodeai.kahalany.dev, predictable.kahalany.dev, davenen.kahalany.dev, torahtracker.app
- Confirmed kahalany.dev root domain was returning 503 (available for deployment)

### Phase 2: Site Build
- Created `Kahalany.Dev Site/` directory with vanilla HTML/CSS/JS (no framework, no build step)
- **index.html** — single-page site with 5 sections: Hero, Portfolio (8 projects), Capabilities (6 categories), Process (4 steps), Contact
- **styles.css** (~1400 lines) — dark theme, CSS custom properties, responsive breakpoints at 1024/768/480px
- **script.js** — scroll animations (IntersectionObserver), animated counters, rotating hero text, project filtering, hamburger menu
- **favicon.svg** — branded "K" icon with gradient

#### Hero Section
- "We build software that ships" with rotating words (ships/scales/works/lasts)
- Green pulse "Available for new projects" badge
- Animated stat counters: 12+ Production Apps, 6 Tech Stacks, 5 Live Platforms

#### Portfolio Section
- Filter bar: All / Web Apps / Mobile / AI·ML / WordPress
- 8 project cards with full descriptions, tech tags, feature tags, and status badges
- "View Live" links for 4 deployed projects

#### CSS Device Mockups
Built unique CSS-only visual representations for each project (no screenshots needed):
- **NodeAI**: Browser frame — sidebar, stat cards, map with glowing pins, data table
- **Predictable**: Browser frame — dark theme, SVG stock chart with gradient fill, verdict score circle, score cards
- **OLAMI**: Browser frame — purple sidebar, stat counters (48/12/156), check-in grid with green checkmarks
- **Torah Tracker**: **Phone frame** — notch, SVG progress ring at 75%, flame streak bar, session list with colored dots, bottom nav
- **ShipHero AI**: Browser frame — red sidebar, chat bubbles (user/AI), tool call indicator, chat input
- **Davenen**: Browser frame — indigo hero with CTA, partner cards with avatars and "Day 18/40" / "Day 32/40" counters
- **Gemach**: Browser frame — "$12,450" balance hero, amber metric cards, SVG balance line chart
- **Claude Code UI**: Browser frame — magenta file tree sidebar, tab bar, code block, git diff (red deletions / green additions)

All mockups use the `m-` CSS namespace prefix and are built from pure CSS shapes/gradients.

#### Other Sections
- **Capabilities**: 6 cards (Full-Stack, Mobile, AI/ML, WordPress, DevOps, Desktop) in responsive grid
- **Process**: 4-step vertical timeline (Understand → Architect → Build → Deploy & Support)
- **Contact**: code block visual (`new-project.ts` with syntax highlighting), email link

### Phase 3: Email Setup
- User configured `hello@kahalany.dev` via Cloudflare Email Routing
- Forwards to kahalanydev@gmail.com
- MX records configured and locked

### Phase 4: Deployment
- Initialized git repo in `Kahalany.Dev Site/`
- Set git identity: Kahalany Dev / kahalanydev@gmail.com
- Created GitHub repo: https://github.com/kahalanydev/kahalany.dev (public)
- Initial commit + push with all 6 files
- Updated Dockerfile and nginx.conf from port 80 → 8080 (Coolify standard)
- Created Coolify app via API:
  - UUID: `zcco40skss0o8wwocs40k4gs`
  - Build pack: Dockerfile
  - Domain: https://kahalany.dev
  - Auto-deploy: on push to master
- Triggered deployment via Coolify API — completed successfully
- Verified 200 response from server
- DNS already pointed (A record: kahalany.dev → 178.156.245.71, DNS only / grey cloud)
- SSL via Let's Encrypt + Traefik

### Files Created
| File | Purpose |
|------|---------|
| `index.html` | Single-page site shell (726 lines) |
| `styles.css` | All styles including CSS mockups (1445 lines) |
| `script.js` | Interactions and animations (112 lines) |
| `favicon.svg` | Branded favicon |
| `Dockerfile` | nginx:alpine, port 8080 |
| `nginx.conf` | Gzip, caching, security headers |
| `APP-MAP.md` | Application architecture documentation |
| `PROGRESS.md` | This file |

### Infrastructure
- Docker image: nginx:alpine (minimal, ~5MB)
- No database, no backend, no build step
- Coolify auto-deploys on push to master
- Traefik handles routing + SSL

---

## 2026-03-29 — Admin Panel & Analytics System

### Context
Added a full admin panel with security monitoring, visitor analytics, and engagement tracking. The site is no longer purely static — it now has a Node.js/Express backend with SQLite database.

### Architecture Changes
- **Backend**: Node.js + Express replaces nginx as the server (still port 8080)
- **Database**: SQLite via sql.js (pure JS/WASM, no native compilation needed)
- **Auth**: JWT-based login system with bcrypt password hashing
- **Dockerfile**: Changed from `nginx:alpine` to `node:20-alpine`

### What Was Built

#### Server (`server/`)
- `index.js` — Express entry point, static file serving, security headers (helmet), compression
- `db.js` — SQLite initialization, schema creation, admin seeding, sql.js wrapper providing better-sqlite3-like API
- `middleware/auth.js` — JWT token verification middleware
- `routes/auth.js` — Login, password change, admin user CRUD (add/remove admins)
- `routes/track.js` — Visit recording (with UA parsing, bot detection, geo IP lookup via ip-api.com)
- `routes/admin.js` — Dashboard, security, and analytics data aggregation queries
- `utils/detection.js` — Bot UA pattern matching, rate tracking, scanner path detection, suspicious activity logging

#### Admin Panel (`admin/`)
- Single-page app (vanilla JS, no framework)
- Dark theme matching main site (green accent, Inter + JetBrains Mono fonts)
- **Login page** — email/password, forced password change on first login
- **Dashboard** — active visitors, daily/weekly/monthly counts, avg time on site, recent visitors, top referrers
- **Security** — suspicious activity log, bot vs human metrics, top IPs, flagged IPs, full visitor log with ISP/geo
- **Analytics** — visitors over time chart (Chart.js), section engagement, hourly distribution, device/browser breakdown, click tracking, referrer sources, avg scroll depth
- **Settings** — change password, manage admin users (add/remove), new admins get random temp password

#### Tracker (`tracker.js`)
- Lightweight, privacy-respecting (honors DNT)
- Tracks: visits, scroll depth, section visibility (IntersectionObserver), clicks on `data-track` elements, heartbeats (30s), leave events
- Uses `sendBeacon` API for reliable unload tracking

#### Tracked Elements (data-track attributes added to index.html)
- Nav links: `nav-work`, `nav-capabilities`, `nav-process`, `nav-contact`
- Hero CTAs: `cta-see-work`, `cta-start-project`
- Project filters: `filter-all`, `filter-web`, `filter-mobile`, `filter-ai`, `filter-wordpress`
- Project links: `project-nodeai`, `project-predictable`, `project-torahtracker`, `project-davenen`
- Contact: `contact-email`

### Auth System
- First admin: ohavkahalany@gmail.com (seeded on first startup)
- Random password generated at runtime, printed to console logs (nothing hardcoded)
- Must change password on first login
- Can add more admins from Settings page (each gets a random temp password)

### Database Tables
- `config` — JWT secret (auto-generated)
- `users` — admin accounts
- `visits` — visitor sessions with IP, UA, geo, device info, bot flag
- `events` — all tracking events (pageview, click, section_view, heartbeat, leave)
- `suspicious_activity` — flagged security events
- `geo_cache` — IP geolocation cache

### Files Created
| File | Purpose |
|------|---------|
| `server/index.js` | Express server entry point |
| `server/db.js` | SQLite database layer (sql.js wrapper) |
| `server/middleware/auth.js` | JWT authentication middleware |
| `server/routes/auth.js` | Auth & user management API |
| `server/routes/track.js` | Visitor tracking API |
| `server/routes/admin.js` | Admin dashboard data API |
| `server/utils/detection.js` | Bot detection & suspicious activity |
| `admin/index.html` | Admin panel HTML shell |
| `admin/styles.css` | Admin panel dark theme styles |
| `admin/app.js` | Admin panel SPA (all pages) |
| `tracker.js` | Client-side analytics tracker |
| `package.json` | Node.js dependencies |
| `.gitignore` | Excludes node_modules/ and data/ |
| `.dockerignore` | Docker build exclusions |

### Files Modified
| File | Changes |
|------|---------|
| `index.html` | Added `data-track` attributes to nav, CTAs, filters, project links, contact email; added tracker.js script tag; added `id="hero"` to hero section |
| `Dockerfile` | Changed from nginx:alpine to node:20-alpine, runs Express |
| `APP-MAP.md` | Complete rewrite reflecting new architecture |

### Deployment Notes
- **IMPORTANT**: Configure a persistent volume mount for `data/` in Coolify so the SQLite database survives container restarts
- On first deployment, check Coolify logs for the initial admin password
- Admin panel accessible at https://kahalany.dev/admin

---

## 2026-03-29 — Client Portal System (Phase 1: Core Infrastructure)

### Context
Built a full client portal system allowing clients to view project progress, submit tickets, communicate through comments, and approve project plans. Phase 1 covers all server-side infrastructure and both admin/portal frontends.

### Architecture & Security
- **Role-based access control**: `admin`, `staff`, `client` roles with middleware guards
- **Org-scoped data isolation**: Clients only see their own organization's projects (enforced server-side, returns 404 not 403 to prevent enumeration)
- **Internal comments**: Admin/staff can post comments hidden from clients (`is_internal` flag)
- **UUID-based IDs**: All client-facing entities use UUIDs to prevent enumeration attacks
- **Rate limiting**: In-memory per-IP rate limiting (60 req/min for portal, configurable per endpoint group)
- **HMAC-signed dev API**: Prepared for Claude Code integration (replay-protected, time-bounded)
- **Immutable audit trail**: All state-changing actions logged to `activity_log` table

### Database Schema (11 new tables)
- `organizations` — client companies
- `projects` — with lifecycle status (planning → proposed → approved → in_progress → review → completed → maintenance → archived)
- `project_members` — user-project assignments with roles
- `milestones` — project phases with status and sort order
- `tickets` — bug reports, feature requests, tasks, questions
- `ticket_comments` — with `is_internal` flag for admin-only notes
- `ticket_attachments` — prepared for Phase 4 file uploads
- `activity_log` — immutable audit trail
- `project_plans` — versioned project plans for client approval
- `dev_keys` — HMAC keys for Claude Code dev API
- `refresh_tokens` — prepared for token refresh flow

### Server Changes

#### `server/db.js` (modified)
- Added all 11 tables with indexes
- Added ALTER TABLE migrations for users table (org_id, login_attempts, locked_until, last_login_at)
- Added helpers: `generateId()`, `logActivity()`, `slugify()`, `nextTicketNumber()`

#### `server/middleware/auth.js` (rewritten)
- Extended `requireAuth` to include org_id in user query
- Added `requireRole(...roles)` middleware factory
- Added `enforceOrgScope` — verifies project belongs to user's org
- Added `requireDevAuth` — HMAC-SHA256 signature verification (60s replay window)
- Added `rateLimit(maxRequests, windowMs)` with in-memory Map and periodic cleanup

#### `server/routes/admin.js` (major extension)
- Organization CRUD: GET/POST/PATCH `/api/admin/clients`, POST/GET client users
- Project CRUD: GET/POST/PATCH `/api/admin/projects`, GET project detail
- Propose endpoint: POST `/api/admin/projects/:projectId/propose`
- Milestone CRUD with auto-progress recalculation
- Plan management: POST `/api/admin/projects/:projectId/plan`
- Ticket management: GET list, GET detail, PATCH status/priority/assignment
- Comments with internal flag: POST `/api/admin/tickets/:ticketId/comments`
- Dev key management: GET/POST/DELETE `/api/admin/dev-keys`

#### `server/routes/portal.js` (new)
- Client-facing API with `requireAuth` + `rateLimit(60, 60000)`
- Dashboard: projects + recent activity for client's org
- Project detail: milestones, progress, activity (org-scoped)
- Plan viewing + approval (sets status to approved, starts first milestone)
- Ticket list with filters, creation (clients can't set urgent priority)
- Ticket detail with PUBLIC comments only (is_internal = 0)
- Client comment posting (always public)
- Activity feed (filters out internal actions)

#### `server/index.js` (modified)
- Added portal routes (`/api/portal`)
- Added portal static file serving (`/portal`)

### Portal Frontend (`portal/`)
- `index.html` — SPA shell matching admin pattern
- `styles.css` (~400 lines) — same design system as admin (dark theme), portal-specific components (project cards, progress bars, milestone timeline, ticket detail, comments, activity feed)
- `app.js` (~500 lines) — full SPA with hash routing:
  - Login (validates role === 'client', redirects admins to /admin)
  - Dashboard with project cards + recent activity
  - Project view with milestone timeline + progress bar
  - Plan view with approve button
  - Ticket list with filter tabs + creation form
  - Ticket detail with comment thread + reply
  - Activity feed with pagination

### Admin Frontend (`admin/app.js` extended)
- **Projects page**: Project list with create form, progress bars, org select, status management
- **Project detail**: Status dropdown, milestone management (add/edit/delete), plan editor with "Send to Client" button, tickets table, activity log
- **Ticket detail**: Status/priority selects, comment thread with internal note styling (yellow border), post public vs internal comments
- **Clients page**: Organization list with user management, create org form, add client user with temp password display

### Testing Results
- Full end-to-end test: admin login → create org → create client user → create project → add milestones → create plan → propose → client login → view dashboard → view project → approve plan → create ticket → add comments → verify internal comment isolation
- **Critical security verified**: Admin sees 2 comments (1 public + 1 internal), client sees only 1 (public)
- All API endpoints return proper error codes and role-based access works correctly

### Files Created
| File | Purpose |
|------|---------|
| `portal/index.html` | Portal SPA shell |
| `portal/styles.css` | Portal dark theme styles (~400 lines) |
| `portal/app.js` | Portal SPA application (~500 lines) |
| `server/routes/portal.js` | Portal API routes (~255 lines) |
| `CLIENT-PORTAL-PLAN.md` | Full architecture plan (~700 lines) |

### Files Modified
| File | Changes |
|------|---------|
| `server/db.js` | 11 new tables, indexes, helper functions |
| `server/middleware/auth.js` | Complete rewrite with RBAC, org scope, rate limiting, HMAC auth |
| `server/routes/admin.js` | ~400 lines added for project/org/ticket management |
| `server/index.js` | Portal routes + static serving |
| `admin/app.js` | ~400 lines added for projects/clients/ticket management |
| `APP-MAP.md` | Updated with portal architecture |
| `PROGRESS.md` | This entry |

### Remaining Phases
- **Phase 3**: Project Plans & Approval flow polish (plan versioning, markdown editor)
- **Phase 4**: File Uploads & Polish (Multer, email notifications, mobile)
- **Phase 5**: PCG Pilot (real client onboarding)

---

## 2026-03-29 — Google OAuth + Dev API & Claude Integration (Phase 2)

### Google OAuth Infrastructure
- Server-side OAuth2 flow using native `fetch` (no extra npm dependencies)
- Admin configures Google Client ID/Secret in Settings > Google OAuth section
- OAuth config stored in `config` table (key-value): `google_client_id`, `google_client_secret`, `google_oauth_enabled`
- Public status endpoint: `GET /api/auth/oauth/status` — frontend checks if Google sign-in is available
- OAuth flow: `GET /api/auth/google?target=portal|admin` → Google consent → `/api/auth/google/callback`
- CSRF protection via cryptographic state tokens (5-min TTL, in-memory Map)
- Role validation: portal requires `client` role, admin requires `admin/staff`
- Google profile data (`google_id`, `avatar_url`) stored on user record
- "Sign in with Google" button on both portal and admin login pages (conditional on config)
- Admin Settings shows the redirect URI for Google Cloud Console setup
- **Security**: Only works for pre-existing users (admin must create accounts first, no self-registration)

### Dev API (`server/routes/dev.js`)
All endpoints require HMAC-signed auth (`requireDevAuth` middleware).

- `GET /api/dev/sync` — Pull everything changed since last sync for a project (milestones, new/updated/closed tickets with latest comments)
- `GET /api/dev/projects/pending` — List approved but unscaffolded projects (with plan content and milestones)
- `POST /api/dev/projects/:id/scaffolded` — Mark project as scaffolded, set status to `in_progress`, start first milestone
- `POST /api/dev/progress` — Push milestone updates with auto-progress recalculation; auto-advances next milestone on completion; projects move to `review` when all milestones complete
- `POST /api/dev/tickets/:id/resolve` — Close ticket with resolution notes (adds public comment)
- `GET /api/dev/tickets/:id/full` — Complete ticket detail with ALL comments (including internal)
- `POST /api/dev/activity` — Log dev events (code_pushed, deploy_triggered, repo_created, etc.)

### Portal Sync Service (in Claude-Code-Desk-Mobile)
Background service in the Claude Code UI server that keeps local project folders in sync.

**File**: `claude-code-ui-mobile/server/portal-sync.js`

- HMAC-signed API client for kahalany.dev dev endpoints
- Polls every 5 minutes + startup sync (5s delayed)
- **Scaffolding**: Creates project folder in `C:\KDEV\{slug}`, writes `CLAUDE.md` (with plan, milestones, workflow), `.portal.json`, `.portal/tickets/`
- **Pull sync**: Fetches new tickets → writes `.portal/tickets/{number}.md` files; removes closed ticket files; updates `.portal.json` milestone statuses
- **Push sync**: Reads `.portal.json` for dirty milestone updates → pushes to server → clears dirty flags
- **Settings API**: `GET/PATCH /api/settings/portal` for dev API key config, `POST /portal/sync` for manual trigger, `POST /portal/test` for connection test
- Wired into server startup (auto-starts if configured) and graceful shutdown

### CLAUDE.md Template Generator
Generates project-specific `CLAUDE.md` with:
- Project info (portal ID, client, tech stack)
- "On Every Conversation" instructions (read .portal.json, check tickets, update milestones)
- Full project plan content
- Milestone checklist with status indicators
- Workflow instructions for Claude Code

### Files Created
| File | Purpose |
|------|---------|
| `server/routes/dev.js` | Dev API endpoints (~283 lines) |
| `Claude-Code-Desk-Mobile/.../portal-sync.js` | Portal sync service (~300 lines) |

### Files Modified
| File | Changes |
|------|---------|
| `server/routes/auth.js` | Google OAuth flow, config API, status endpoint (~170 lines added) |
| `server/db.js` | Added scaffolded_at column to projects, google_id/avatar_url to users |
| `server/index.js` | Added dev routes |
| `admin/app.js` | Google OAuth settings card in Settings page, "Sign in with Google" on login |
| `portal/app.js` | "Sign in with Google" button on login page with error handling |
| `Claude-Code-Desk-Mobile/.../settings.js` | Portal sync settings endpoints |
| `Claude-Code-Desk-Mobile/.../index.js` | Portal sync startup and shutdown |

---

## 2026-03-29 — Project Plans & Approval Flow (Phase 3)

### Plan Versioning
- New `plan_versions` table stores complete history of every plan edit
- On every save, the current plan content is archived before being overwritten
- Admin endpoints: `GET /plan/versions` (list), `GET /plan/versions/:id` (detail), `POST /plan/restore/:id` (restore)
- Restoring a version saves the current plan as a new version first, then replaces content

### Markdown Rendering
- Lightweight regex-based markdown renderer (no dependencies)
- Supports: headings (h1-h4), bold, italic, code blocks, inline code, lists (ordered/unordered), checkboxes, links, horizontal rules
- Admin plan editor has Write/Preview tabs with live markdown preview
- Portal plan view renders markdown (was previously raw text)

### Approval Workflow Polish
- Portal plan page now shows "Approve Project" and "Request Changes" side by side
- "Request Changes" opens inline feedback form that creates a ticket (type: `modification`) for the team
- Plan nav item added to portal sidebar for easy access
- Admin can re-propose plans after making changes ("Re-send to Client")
- Save button shows inline version badge feedback (`Saved (v3)`) without page reload
- Admin version history panel: view any previous version, restore with one click

### Files Modified
| File | Changes |
|------|---------|
| `server/db.js` | Added `plan_versions` table |
| `server/routes/admin.js` | Version history, view, restore endpoints; versioned save |
| `admin/app.js` | Markdown renderer, Write/Preview tabs, version history panel |
| `portal/app.js` | Markdown renderer, "Request Changes" feedback form, Plan nav item |

### Remaining Phases
- **Phase 4**: File Uploads & Polish (Multer, email notifications, mobile)
- **Phase 5**: PCG Pilot (real client onboarding)

---

## 2026-03-29 — File Uploads & Attachment UI (Phase 4)

### File Upload System
- Installed `multer` for multipart file handling
- `server/routes/uploads.js` — full CRUD file upload API (~200 lines)
  - **POST /api/uploads/tickets/:ticketId** — upload files with org-scope verification
  - **GET /api/uploads/tickets/:ticketId** — list attachments with uploader name
  - **GET /api/uploads/download/:attachmentId** — auth-gated download with Content-Disposition
  - **DELETE /api/uploads/:attachmentId** — admin/staff or uploader can delete

### Security
- UUID-based stored filenames (prevents path traversal while keeping original name in DB)
- MIME whitelist: images, PDFs, Office docs, text, CSV, ZIP
- Extension blacklist: executables, scripts, DLLs (defense-in-depth)
- 10MB per file limit, 10 files per ticket limit
- Downloads forced via `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`
- Auth-gated downloads (JWT required via fetch + blob URL)

### Attachment UI
- **Admin ticket detail**: Attachments card with file list (icon, name, size, uploader, date), drag-and-drop upload zone, download via authenticated fetch, delete with confirmation
- **Portal ticket detail**: Same attachment card (hidden upload zone when ticket is closed), clients can only delete their own uploads
- File type icons based on MIME type (images, PDFs, docs, spreadsheets, archives, generic)
- `formatFileSize()` helper added to both admin and portal apps

### Files Created
| File | Purpose |
|------|---------|
| `server/routes/uploads.js` | File upload/download/delete API |

### Files Modified
| File | Changes |
|------|---------|
| `server/index.js` | Added upload routes |
| `admin/app.js` | Attachment section in ticket detail, formatFileSize helper |
| `portal/app.js` | Attachment section in ticket detail, formatFileSize helper |
| `package.json` | Added multer dependency |

### Remaining Phases
- **Phase 5**: PCG Pilot (real client onboarding)

---

## 2026-03-29 — Email Notifications, Contact Form, Light Theme (Phase 4 cont.)

### Email System (Nodemailer)
- Created `server/utils/email.js` — SMTP transport via Nodemailer, config read from DB
- Functions: `sendEmail()`, `sendWelcomeEmail()`, `sendPasswordResetEmail()`, `getSmtpConfig()`
- Branded HTML email templates (dark theme styling, Kahalany.Dev branding)
- Graceful fallback: logs to console if SMTP not configured (no hard failures)
- **Welcome emails**: Auto-sent when admin creates new user (admin, staff, or client) — includes credentials + login URL
- **Password reset emails**: Auto-sent when admin resets a user's password
- **Contact form notifications**: New submissions emailed to hello@kahalany.dev
- Admin SMTP settings: `GET/PUT /api/auth/smtp/config`, `POST /api/auth/smtp/test` (send test email)

### Contact Form ("Describe Your Idea")
- Replaced old contact section with "What do you want to build?" form
- Fields: name, email, idea/message textarea
- `POST /api/contact` endpoint — rate-limited (1/min per IP), stores in `contact_submissions` table
- Email notification sent to hello@kahalany.dev on each submission
- "Or reach out directly" divider with WhatsApp link (wa.me/18623005027) + email button

### Light/Dark Theme Toggle
- **All three frontends** (main site, admin, portal) now support light mode
- CSS: `[data-theme="light"]` overrides all `:root` custom properties
- Main site: moon/sun toggle button in nav bar
- Admin: theme toggle button in sidebar bottom
- Portal: theme toggle button in sidebar
- Persistence: `localStorage` with separate keys (`theme`, `admin_theme`, `portal_theme`)
- Default: dark theme

### Files Created
| File | Purpose |
|------|---------|
| `server/utils/email.js` | Nodemailer email utility (welcome, reset, generic send) |

### Files Modified
| File | Changes |
|------|---------|
| `server/index.js` | Added `POST /api/contact` endpoint with rate limiting |
| `server/db.js` | Added `contact_submissions` table |
| `server/routes/auth.js` | Added SMTP config endpoints, welcome/reset email on user creation/reset |
| `server/routes/admin.js` | Added welcome email on client user creation |
| `index.html` | New contact form section, theme toggle button in nav |
| `styles.css` | Light theme variables, `.idea-form` styles, `.theme-toggle` styles, `.contact-divider` |
| `script.js` | Contact form submit handler, theme toggle handler |
| `admin/app.js` | SMTP settings card, theme toggle in sidebar |
| `admin/styles.css` | Light theme variable overrides, `.theme-toggle-btn` styles |
| `portal/app.js` | Theme toggle in sidebar |
| `portal/styles.css` | Light theme variable overrides, `.theme-toggle-btn` styles |
| `package.json` | Added `nodemailer` dependency |

---

## 2026-03-29 — Persistent Volume & Deployment Fix

### Problem
Every Coolify redeploy wiped the SQLite database because no persistent volume was mounted. Admin password, SMTP config, OAuth settings, all users — lost on every deploy.

### Fix
- Added Docker volume `kahalany-dev-data` via Coolify's internal PostgreSQL database:
  ```sql
  INSERT INTO local_persistent_volumes (name, mount_path, resource_type, resource_id)
  VALUES ('kahalany-dev-data', '/app/data', 'App\Models\Application', 13)
  ```
- Volume mounts at `/app/data` inside the container
- Verified mount: `/var/lib/docker/volumes/kahalany-dev-data/_data` → `/app/data`
- Database, uploaded files, and all config now survive redeploys

### Deploy Workflow (established)
1. Make changes locally
2. `git add` + `git commit` + `git push origin master`
3. Auto-deploys via GitHub webhook to Coolify
4. Container rebuilds from GitHub, volume persists data

### SMTP Configuration
- Configured via Admin Panel → Settings → Notifications
- Gmail App Password (2FA required, generated at myaccount.google.com → Security → App Passwords)
- Settings stored in SQLite `config` table (not in code)

---

## 2026-03-30 — Cross-Org Users, Ticket Notifications, Auto-Deploy, Bug Fixes

### Settings Page Fix
- GET /api/auth/users now returns ALL users (not just admins) with proper role badges
- Role badges: admin (blue), staff (purple), client (green)
- Status: pending (yellow) vs active (green)

### Client User Management
- Clients page now shows users in a table with Reset PW and Remove buttons
- Cross-org badge displayed for users from other organizations
- DELETE endpoint handles both direct org members (deletes user) and cross-org members (removes project_members only)

### Cross-Org User Assignment
- Adding a user who already belongs to another org now adds them as `project_members` instead of blocking
- All projects in the target org get the cross-org user added
- Audit trail via `cross_org_member_added` activity log entry
- Fixed: `project_members` table missing `id` field on INSERT and `added_by` column migration

### Coolify Auto-Deploy
- Set `manual_webhook_secret_github` on the Coolify app (source_id was 0, not linked to GitHub App)
- Created GitHub webhook pointing to Coolify's webhook endpoint
- Set `fqdn` to `https://kahalany.dev` (was previously None)
- Production now auto-deploys on push to master

### Project Plans Populated
- Seeded detailed project plans for PCG and ShipHero AI via POST /api/admin/projects/:id/plan
- Plans visible in both admin Project Detail and client portal Plan page

### Ticket Notifications
- **Email**: When a client creates a ticket, all admin/staff users receive a themed email notification via `sendTicketNotification()` in email.js
- **Webhook**: Configurable webhook URL (Slack, Discord, custom) fires a JSON POST on ticket creation
- Admin Settings: "Notifications" card with SMTP config + Ticket Webhook URL field
- Both fire asynchronously after the ticket response (don't block the client)

### SPA Navigation Bug Fix
- Fixed double-render bug: sidebar click handler was calling `render()` AND setting `window.location.hash` (triggering hashchange → second render)
- Two async renders raced, destroying event handlers (add user, etc. didn't work without page refresh)
- Fix: removed explicit `render()` from sidebar click, letting hashchange handle it exclusively

### Files Modified
| File | Changes |
|------|---------|
| `server/routes/auth.js` | All-users listing, webhook config save |
| `server/routes/admin.js` | Cross-org user assignment, client user delete, reset PW |
| `server/routes/portal.js` | Ticket notification (email + webhook) after creation |
| `server/utils/email.js` | Added `sendTicketNotification()`, exported `emailWrapper` |
| `server/db.js` | `safeAlter` for project_members.added_by column |
| `admin/app.js` | Settings users card, notifications card, clients table, nav fix |

---

## 2026-03-30 — Claude Code Chat Widget Integration

### Overview
Embedded a native Claude Code chat interface directly into admin panel project pages. Allows admins to interact with Claude Code AI scoped to each project's local folder, without leaving the admin panel.

### Architecture
```
Admin Panel (kahalany.dev)          Claude Code Server (code.kahalany.dev)
  Browser JS ──────────────────────── Cloudflare Tunnel ──── localhost:3141
    │                                      │
    ├─ POST /api/auth/pair (pairing)       ├─ JWT auth (RS256)
    ├─ POST /api/claude/send (messages)    ├─ Claude CLI process pool
    ├─ WSS /ws (streaming)                 ├─ WebSocket broadcast
    └─ GET /api/projects (folder list)     └─ Project folder listing
```

### Claude Code Client Module (`admin/app.js`)
- `cc` object: token management, authenticated fetch with auto-refresh, pairing flow, WebSocket connection with auto-reconnect
- Token refresh with dedup (`_refreshPromise`), proper error propagation on non-2xx responses
- Methods: `pair()`, `disconnect()`, `send()`, `stop()`, `reset()`, `isRunning()`, `listProjects()`
- In-memory chat state: `cc.chats[projectId]`, `cc.streaming[projectId]`

### Settings Page — Claude Code Card
- Server URL input (default: `https://code.kahalany.dev`)
- 6-digit pairing code input (from Claude Code Desktop startup)
- Connection status badge (Connected/Not connected)
- Disconnect button when connected

### Project Detail — Chat Widget (grid-2 right column)
- Positioned next to Milestones in the primary grid (Project Plan moved below)
- **Not connected**: Shows "Configure in Settings" link with lightning icon
- **Connected, no folder mapped**: Fetches project folders from CC server, dropdown to select matching local folder
- **Connected + mapped**: Full chat interface:
  - Messages area (scrollable, min 280px) with user bubbles (blue, right) and assistant bubbles (left, markdown-rendered)
  - Tool use badges showing which tools Claude uses (Read, Edit, Bash, etc.)
  - Real-time streaming via WebSocket (`claude:stream`, `claude:tool-use`, `claude:done`)
  - Send on Enter, Stop button during generation, Reset conversation button
  - Change folder mapping button
  - "Thinking..." animation with animated dots

### Claude Code Server CORS
- Added `https://kahalany.dev` to allowed origins in `Claude-Code-Desk-Mobile/claude-code-ui-mobile/server/index.js`
- Required for cross-origin API calls from admin panel browser to CC server via Cloudflare tunnel

### CSS
- `.cc-card` with accent border
- `.cc-messages` scrollable container (dark bg, rounded)
- `.cc-msg-user-bubble` (blue accent) and `.cc-msg-assistant-bubble` (surface bg with border)
- `.cc-tool-badge` monospace tool indicators
- `.cc-thinking::after` animated dots (width-based animation)

### Files Modified
| File | Changes |
|------|---------|
| `admin/app.js` | CC client module (~130 lines), Settings card, chat widget in project detail (~150 lines) |
| `admin/styles.css` | Chat widget styles (~100 lines) |
| `Claude-Code-Desk-Mobile/.../server/index.js` | CORS origin whitelist |

### Setup Instructions
1. Restart Claude Code Desktop (picks up CORS change)
2. Admin → Settings → Claude Code card → enter server URL + pairing code → Connect
3. Open any project → Claude Code chat appears in grid next to Milestones
4. Select matching local folder from dropdown
5. Chat with Claude scoped to that project

---

## 2026-03-30 — Admin Dashboard Rebuild & Client Portal Visual Upgrade

### Admin Dashboard — Command Center
Replaced the visitor-only dashboard with a full business command center.

- **Top metrics**: Active Projects, Open Tickets, Pending Approvals, New Leads (contact submissions), Visitors Today, This Month
- **Needs Attention**: Aggregates urgent/high tickets, overdue milestones, and pending plan approvals into a single priority card. Each item is clickable. Shows green "all clear" when empty.
- **Active Projects**: Compact rows with progress bars, status badges, open ticket counts
- **Recent Activity**: Unified feed across all projects with user names and timestamps
- **Recent Visitors**: Slimmed to 8 rows (moved Top Referrers to Analytics page)
- **Contact Submissions**: Name, email, message preview with dismiss button
- New `contact_dismissals` table to track dismissed contacts
- New `POST /api/admin/contacts/:id/dismiss` endpoint

### Admin Project Detail — Grid Layout
Reorganized from stacked cards to side-by-side grids:
- Row 1: Milestones | Claude Code
- Row 2: Project Plan | Tickets
- Row 3: Project Members | Recent Activity

### Claude Code Chat Widget Fix
- Limited history to last 20 messages (was loading entire conversation)
- Fixed scroll: always starts at bottom of chat (latest messages visible)
- Added `max-height: 350px` with proper overflow scroll
- Removed `flex:1` inline style that caused unbounded widget growth

### Markdown Renderer Rewrite
Replaced regex-and-`<br>` approach with proper block parser for both admin and portal:
- Emits semantic `<p>`, `<ul>`, `<ol>`, `<pre>` tags instead of `<br><br>` everywhere
- Added `.md-rendered` CSS class with tight spacing for headings, lists, paragraphs, code blocks
- Project plans now render as clean, compact documents

### Client Portal — Visual Redesign

#### Dashboard
- **Hero project cards** with SVG circular progress rings (animated stroke)
- Milestone dot indicators (green filled = done, gray = pending)
- "Up next: [milestone name]" preview on each card
- Countdown to target date or "X days overdue" warning in red
- Smart welcome banner ("2 projects active, 1 awaiting your approval")
- Activity feed upgraded with per-action-type icons

#### Project View
- **Phase indicator bar**: 6-step horizontal progress (Planning → Proposed → Approved → In Progress → Review → Completed) with checkmarks for completed phases, glowing blue dot for current
- **SVG progress ring** (120px) alongside 4 stat cards: milestones done, open tickets, days active, days remaining
- **Visual milestone timeline**: Vertical connected nodes:
  - Green circle + checkmark = completed
  - Pulsing blue circle (CSS animation) = in progress
  - Hollow gray circle = upcoming
  - Connector line is green up to current milestone, gray after
- Activity feed with action-type icons

#### Portal API Enrichment
- Dashboard: milestones_total, milestones_done, next_milestone, days_remaining per project
- Project detail: days_since_start, days_remaining

### Files Modified
| File | Changes |
|------|---------|
| `server/routes/admin.js` | Dashboard API rewrite (business metrics, attention items, contacts), dismiss endpoint |
| `server/routes/portal.js` | Enriched dashboard + project detail responses |
| `server/db.js` | Added `contact_dismissals` table |
| `admin/app.js` | Dashboard command center, chat widget fixes, markdown rewrite, grid layout |
| `admin/styles.css` | `.md-rendered` styles, `.dash-attention-row` hover, chat widget max-height |
| `portal/app.js` | Hero cards, progress ring, phase indicator, timeline, markdown rewrite, activity icons |
| `portal/styles.css` | Hero cards, progress ring, phase bar, timeline, stat cards, responsive rules, `.md-rendered` |

---

## 2026-03-30 — Ticket Resolution Pipeline Fix

### Problem
Tickets resolved via Claude Code in the admin chat widget were never actually closed in the database. The admin dashboard, project detail page, and client portal all continued showing the ticket as "open" even after Claude Code reported it as resolved.

### Root Cause (3 bugs stacking)

1. **Unreliable HMAC bash script in CLAUDE.md** — The scaffolded CLAUDE.md told Claude Code to resolve tickets using a complex bash script requiring `python3`, `sha256sum`, and `openssl dgst`. These tools aren't reliably available on Windows/MINGW. Claude Code skipped the script and instead just marked the local ticket file with `_resolved: true`, saying the sync service would handle it.

2. **Missing `ID:` field in ticket file** — Claude Code wrote the ticket file itself (not via the sync service), so it only had `Ticket: #1` but no `ID:` (UUID) field. The portal sync's push mechanism searched for `^ID:` to find the ticket UUID and silently skipped resolution when it wasn't found.

3. **Empty API credentials in `.portal.json`** — The dev API key was configured in the Claude Code Desktop store *after* the project was scaffolded. The `.portal.json` captured empty `key_id`/`secret` at scaffold time and was never updated, so even the resolve-ticket script would have failed.

### Fixes

#### Kahalany.Dev Site (server)
- **`server/routes/dev.js`** — Resolve endpoint now accepts ticket number + `project_id` as a fallback when UUID lookup fails. `ticketId` param can be a UUID or a ticket number (e.g. `1`).
- **`admin/app.js`** — Auto-refreshes the tickets table 2 seconds after `claude:done` event fires. The admin no longer needs to manually reload the page to see updated ticket status.

#### Claude Code Desktop (portal-sync.js)
- **New resolve-ticket.js script** — Simple Node.js script scaffolded into `.portal/scripts/resolve-ticket.js` on project creation. Handles HMAC signing natively using Node.js `crypto` module — no bash/python/openssl dependencies.
- **CLAUDE.md template simplified** — Replaced the 15-line bash HMAC script with a single command: `node .portal/scripts/resolve-ticket.js "<ticketId>" "<client message>"`.
- **Sync fallback for missing ID** — When `ID:` field is missing, sync now falls back to `Ticket: #N` number extraction + `project_id` for the API call.
- **Body resolution extraction** — Also searches for `Resolution:` in the ticket body (after frontmatter), not just in frontmatter fields.
- **Credential auto-refresh** — On every sync cycle, `.portal.json` credentials are updated from the Desktop store if they've changed, fixing projects scaffolded before the dev key was configured.

### Files Modified
| File | Changes |
|------|---------|
| `server/routes/dev.js` | Ticket number + project_id fallback on resolve endpoint |
| `admin/app.js` | Auto-refresh tickets table after `claude:done` |
| `Claude-Code-Desk-Mobile/.../portal-sync.js` | Resolve script generator, CLAUDE.md template rewrite, sync fallback logic, credential refresh |

### Ticket Resolution Flow (after fix)
```
Claude Code resolves a ticket →
  Option A (preferred): runs `node .portal/scripts/resolve-ticket.js` → hits dev API directly → DB updated immediately
  Option B (fallback): marks ticket file with _resolved: true → sync service picks up on next cycle (≤5 min) → resolves via API using ticket number fallback
  → Admin panel auto-refreshes tickets table after claude:done
  → Client portal shows updated status on next page load
```

---

## 2026-03-30 — Portal Dashboard & Project View Redesign

### Dashboard Redesign
Replaced the full-width activity feed with a 2-column widget layout below the hero project cards.

- **Left column**: Milestone Spotlight (active/upcoming milestones across all projects with status indicators) + Ticket Summary (open/in-progress/closed counts, recent tickets list with links) + Quick Actions (create ticket shortcuts per project)
- **Right column**: Compact Activity Feed (8 items max, collapsed duplicate entries)
- **Activity collapsing**: Sequential identical actions by the same user within 1 hour are collapsed with a multiplier badge (e.g. "code pushed x3")

### Project View Redesign
- **Ticket buttons** moved from standalone row to top-right of the progress/stats overview card
- **Milestones + Activity** now sit side-by-side in a `1.4fr 1fr` grid instead of each taking a full row
- Activity feed uses compact styling with collapsed duplicates

### Dashboard API Enrichment
- `GET /api/portal/dashboard` now returns `activeMilestones` (current/upcoming per project), `recentTickets` (top 5 across all projects), and `ticketStats` (open/in_progress/closed counts)

### Mobile Responsive
- Both dashboard widgets grid and project content grid collapse to single column at 768px
- Ticket buttons in overview card switch to horizontal row on mobile

### CSS Added
- `.dashboard-widgets` — 2-column grid container
- `.milestone-spotlight-list`, `.spotlight-item` — milestone spotlight cards with status indicators
- `.ticket-stats-row`, `.ticket-stat` — ticket count summary with color-coded numbers
- `.recent-tickets-list`, `.recent-ticket-item` — clickable ticket links
- `.quick-actions`, `.quick-action-btn` — per-project ticket creation shortcuts
- `.activity-list.compact` — smaller activity items for side panels
- `.activity-count` — collapsed duplicate multiplier badge
- `.project-content-grid` — milestones + activity side-by-side
- `.project-overview-actions` — ticket buttons in stats card

### Files Modified
| File | Changes |
|------|---------|
| `server/routes/portal.js` | Dashboard API enriched with milestones, tickets, stats |
| `portal/app.js` | Dashboard 2-col layout, project view grid, activity collapsing |
| `portal/styles.css` | All new widget/grid styles + mobile breakpoints |

---

## 2026-03-30 — Dev API Expansion & Inline Ticket Management

### Dev API New Endpoints (`server/routes/dev.js`)
- **`POST /api/dev/bootstrap`** — Creates an organization + project in one HMAC-authenticated call. Idempotent: returns existing org/project IDs if names match. Allows Claude Code or automation scripts to onboard a new client without the admin panel.
- **`POST /api/dev/projects/:id/update`** — Updates project metadata (status, progress, dates, description, tech_stack, live_url). Whitelist-based field filtering. Logs `project_status_changed` activity.
- **`POST /api/dev/projects/:id/milestones`** — Bulk creates milestones with optional `replace: true` to wipe and rebuild. Auto-recalculates project progress. Returns created milestones + new progress percent.

### Admin Ticket Inline Status Change
- Project detail ticket table now has `<select>` dropdowns for instant status change (open → in_progress → review → completed → closed) without navigating to ticket detail
- Fires `PATCH /api/admin/tickets/:id` immediately on change, rolls back on failure
- Row-click navigation blocked when interacting with the dropdown

### Dev API Diagnostics (`admin/app.js` + `server/routes/admin.js`)
- New `GET /api/admin/dev-api-status` endpoint: returns active dev keys, recent ticket resolutions, and open tickets
- "Dev API Diagnostics" card in admin Settings: shows active key count (with red warning if zero), per-key usage timestamps, recent resolutions with time-ago labels, open ticket list with clickable links
- "Run Check" button for on-demand verification of the dev API pipeline

### Ticket Update Verification
- PATCH endpoint now returns `500` when `result.changes === 0` instead of silently succeeding
- Returns full updated ticket object for frontend verification

### Files Modified
| File | Changes |
|------|---------|
| `server/routes/dev.js` | Bootstrap, project update, bulk milestones endpoints (~130 lines added) |
| `server/routes/admin.js` | Dev API status endpoint, ticket update verification |
| `admin/app.js` | Inline ticket status, Dev API Diagnostics card |

---

## 2026-03-30 — Maintenance Phase & Portal Fixes

### Maintenance Phase
- Added `maintenance` as the 7th project lifecycle phase (after `completed`) in portal phase indicator
- Phase bar now renders: Planning → Proposed → Approved → In Progress → Review → Completed → Maintenance
- Status and type badge maps updated for maintenance

### Portal Plan Page Fix
- Removed `white-space: pre-wrap` from `.plan-content` — plan content is now markdown-rendered into proper HTML, the pre-wrap was causing raw line-break formatting instead of clean document layout

### Files Modified
| File | Changes |
|------|---------|
| `portal/app.js` | Maintenance phase in phaseSteps array, badge maps |
| `portal/styles.css` | Removed pre-wrap from `.plan-content` |

---

## 2026-03-30 — Mobile Overhaul & PWA Support

### Mobile Card Tables
- New `.mobile-cards` CSS pattern: at ≤768px, tables transform into card-per-row layout
- `thead` hidden, each `td` becomes `display: flex` row with column header prepended via `content: attr(data-label)` pseudo-element
- Applied to all tables in admin and portal (users, tickets, visitors, etc.)
- `data-label` attributes added to all `<td>` elements

### Bottom Navigation Bar
- Fixed bottom nav replacing the sidebar on mobile (≤768px)
- 5 main nav items with icon + label, stacked vertically per item
- Active state: accent color, `scale(1.1)` icon animation
- Press feedback: `transform: scale(0.88)` on `:active` for tap response
- `env(safe-area-inset-bottom)` padding for iPhone notch safety
- `-webkit-tap-highlight-color: transparent` to suppress iOS blue flash
- Settings accessible via gear icon in the mobile top bar (not in bottom nav)

### Mobile Top Bar
- Fixed top-right bar (hidden on desktop) with theme toggle, settings gear, and logout button

### Layout Fixes
- `html, body { overflow-x: hidden; max-width: 100vw }` to prevent horizontal scroll bleed
- `-webkit-text-size-adjust: 100%` to prevent iOS text auto-resize
- Filter tabs: `overflow-x: auto` with `-webkit-overflow-scrolling: touch`
- Admin metrics grid: forces 2 columns at ≤768px (was collapsing to single column)

### PWA Support
- **Manifests**: `admin/manifest.json` and `portal/manifest.json` with `display: standalone`, dark theme colors, favicon as icon
- **Service workers**: `admin/sw.js` and `portal/sw.js` with cache strategies:
  - Navigation requests: pass through untouched (critical for OAuth redirects)
  - API/auth calls: network-first with cache fallback
  - Static assets: stale-while-revalidate
- **HTML meta tags**: viewport-fit=cover, theme-color, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-mobile-web-app-title
- **Theme-color sync**: `applyTheme()` updates `<meta name="theme-color">` to match current theme
- **OAuth fix**: Service worker initially intercepted OAuth callback navigations — fixed to skip all navigate requests entirely

### Files Created
| File | Purpose |
|------|---------|
| `admin/manifest.json` | PWA manifest for admin panel |
| `portal/manifest.json` | PWA manifest for client portal |
| `admin/sw.js` | Admin service worker (caching + OAuth passthrough) |
| `portal/sw.js` | Portal service worker (caching) |

### Files Modified
| File | Changes |
|------|---------|
| `admin/index.html` | PWA meta tags, manifest link, viewport-fit |
| `portal/index.html` | PWA meta tags, manifest link, viewport-fit |
| `admin/app.js` | Bottom nav, mobile top bar, data-label attributes, SW registration, theme-color sync |
| `portal/app.js` | Bottom nav, mobile top bar, data-label attributes, SW registration |
| `admin/styles.css` | `.mobile-cards`, `.bottom-nav`, `.mobile-top-bar`, metrics grid 2-col, tap feedback |
| `portal/styles.css` | `.mobile-cards`, `.bottom-nav`, `.mobile-top-bar`, tap feedback |

---

## 2026-03-30 — Contact-to-Client Pipeline & Spam Protection

### Honeypot Spam Protection
- Hidden `_hp` field added to contact form — bots filling all fields get a silent `{ success: true }` (no error signal)
- Timing check: form sends `_t` (milliseconds since page load) — submissions under 2 seconds silently succeed (no human can fill the form that fast)

### Contact Form Enhancement
- New optional "What are you building?" text input (`project_name` field)
- Email notification to hello@kahalany.dev now includes project name when provided

### Lead Conversion Tracking (DB schema)
- `contact_submissions` table gained three new columns via `safeAlter`:
  - `project_name TEXT` — what the lead wants to build
  - `converted_at TEXT` — timestamp when lead was converted to a client org
  - `converted_org_id TEXT` — the org ID the lead was converted into
- Prepared for a future "Convert to Client" button in admin dashboard

### Files Modified
| File | Changes |
|------|---------|
| `server/index.js` | Honeypot + timing validation in POST /api/contact, project_name column migration |
| `server/db.js` | safeAlter for project_name, converted_at, converted_org_id columns |
| `index.html` | Hidden honeypot field, timing field, project_name input |
| `script.js` | Capture load time, compute elapsed time, send _hp + _t in POST body |
| `styles.css` | Honeypot field hidden styling |

---

## 2026-03-30 — Portfolio Update: Client Management Platform

### New Portfolio Card
- Added 9th project card: "Client Management Platform" showcasing the admin panel + client portal system built for this site
- Category: Web Apps. Tech tags: Node.js, SQLite, Vanilla JS, JWT
- Status badge: "Live" (purple)
- Feature tags: Admin + Portal, Google OAuth, Visitor analytics, Ticket system, Plan approvals, PWA
- CSS device mockup (`.mockup-cmp`): purple accent, sidebar, 2-column admin layout with metric cards, project table row with progress bar, ticket detail preview

### Hero Stats Updated
- Production Apps counter: 12+ → 15+
- Live Platforms counter: 5 → 6

### Settings Page Reorganization (uncommitted)
- Settings page divided into labeled sections with `.settings-section-label` dividers:
  - **Account & Security**: Change Password + Google OAuth (grid-2)
  - **Integrations**: Claude Code + Notifications/SMTP/Webhook (grid-2)
  - Dev Keys + Dev API Diagnostics (grid-2)
  - **Team Management**: Users table (full-width)
- New `.settings-section-label` CSS: uppercase, letter-spacing, dim color, bottom border

### Files Modified
| File | Changes |
|------|---------|
| `index.html` | CMP portfolio card, hero stat updates (15+, 6) |
| `styles.css` | `.mockup-cmp` CSS device mockup |
| `admin/app.js` | Settings page sectioned layout reorganization (uncommitted) |
| `admin/styles.css` | `.settings-section-label` styles (uncommitted) |

---

## 2026-04-06 — Rebrand: kahalany.dev → kaymen.dev (Plan B)

### Context
Rebranded the dev practice from "Kahalany.Dev" to "kaymen.dev", operating under Kaymen Group LLC. Chose Plan B (frontend-only rebrand) — all user-facing references updated, internal plumbing left as-is. Domain kaymen.dev was already purchased.

### DNS & Infrastructure

#### Cloudflare DNS (kaymen.dev zone)
- Added wildcard A record: `*` → `178.156.245.71` (DNS only)
- Added root A record: `@` → `178.156.245.71` (DNS only)
- Wildcard covers all current + future subdomains automatically

#### Cloudflare Email Routing
- Enabled for kaymen.dev zone
- `hello@kaymen.dev` forwards to Gmail inbox

#### Cloudflare Tunnel
- Added `code.kaymen.dev` as public hostname on existing `claude-code` tunnel
- Routes to `http://localhost:3141` (same as code.kahalany.dev)
- CNAME auto-created by Cloudflare

#### Coolify FQDN Updates (via API)
Added kaymen.dev domains alongside existing kahalany.dev for all 7 production apps:

| App | UUID | Updated FQDN |
|-----|------|-------------|
| Main site | `zcco40skss0o8wwocs40k4gs` | `kahalany.dev, kaymen.dev` |
| NodeAI | `gw840cgk8gscowck8kc80wo8` | `nodeai.kahalany.dev, nodeai.kaymen.dev` |
| Predictable | `og8w4kkkccw4ckcsgw4ws8sw` | `predictable.kahalany.dev, predictable.kaymen.dev` |
| Davenen | `cco0kccokg08okwsw8cssk48` | `davenen.kahalany.dev, davenen.kaymen.dev` |
| ShipHero AI | `o00gossow4c8s888ws48okso` | `shipai.kahalany.dev, shipai.kaymen.dev` |
| PCG | `nwg0s00oc8k8owo0sggkgkgg` | `pcg.kahalany.dev, pcg.kaymen.dev` |
| Torah Tracker | `dc4ccksssskkww0ckc00sg4s` | `torahtracker.app, torahtracker.kahalany.dev, torahtracker.kaymen.dev` |

- All apps restarted via API to trigger Traefik label regeneration + Let's Encrypt cert provisioning
- SSL certs issued by Let's Encrypt (certresolver=letsencrypt) for all kaymen.dev domains

### Code Changes (Plan B — frontend-only, 9 files)

#### index.html
- Page title → `kaymen.dev — Custom Software Solutions`
- Mockup URLs: nodeai, predictable, davenen → `*.kaymen.dev`
- Live link hrefs: nodeai, predictable, davenen → `*.kaymen.dev`
- ShipHero AI: mockup URL → `shipai.kaymen.dev` + added "View Live" link
- PCG: mockup URL → `pcg.kaymen.dev` + added "View Live" link
- Contact email display + mailto → `hello@kaymen.dev`
- Footer logo → `{ kaymen.dev }`
- Copyright → `© 2026 Kaymen Group LLC`

#### admin/app.js
- 4 login/sidebar logo instances → `kaymen.dev`
- Device name → `Kaymen Admin Panel`
- Claude Code server URL → `code.kaymen.dev`

#### portal/app.js
- 4 login/sidebar logo instances → `kaymen.dev`

#### admin/index.html + portal/index.html
- Page titles → `kaymen.dev`

#### admin/manifest.json + portal/manifest.json
- PWA names → `kaymen.dev Admin` / `kaymen.dev Portal`
- PWA descriptions → `kaymen.dev`

#### server/utils/email.js
- Email HTML logo: `kahalany` → `kaymen`
- Invite subject: `kaymen.dev`
- Password reset subject: `kaymen.dev`

#### server/routes/dev.js
- Default org email → `hello@kaymen.dev`
- Portal URL → `https://kaymen.dev/portal`

### What Was Left As-Is (Plan B scope)
- Code comments in 5 files (nobody sees these)
- package.json/package-lock.json name (internal npm identifier)
- GitHub repo/org name (internal, redirects work)
- server/index.js contact form `to:` email (forwards regardless of brand)
- server/routes/auth.js SMTP test subject (admin-only)
- admin/app.js SMTP placeholder text (admin-only)
- Docker volume name (renaming risks data loss)
- server/db.js admin seed email (personal Gmail)

### Still TODO
- [ ] Update SMTP "From" field in Admin → Settings → Integrations to `"kaymen.dev" <hello@kaymen.dev>`
- [ ] Phase 4: Retire old kahalany.dev domain (301 redirects via Cloudflare when ready)
- [ ] Optional: Plan A internal cleanup (comments, package.json, GitHub rename)
- [ ] Update Claude Code Desktop allowed origins to include kaymen.dev

---

## 2026-07-23 — Portfolio Refresh (Q2/Q3 developments)

### Context
The public portfolio content had not been updated since the 2026-04-06 rebrand. A workspace-wide survey found ~10 projects that shipped or materially changed since April. Refreshed the `index.html` project grid to reflect the current state of the practice.

### Hero stats
- Production Apps: 15+ → **20+**
- Tech Stacks: 6 → **8**
- Live Platforms: 6 → **12+** (now shows a `+`)

### New project cards (7)
Placed with the flagship first, then interleaved by category:
- **Thrive Platform** *(flagship, first card)* — multi-tenant Laravel/Filament/PostgreSQL CRM that replaced the 135K-line legacy OLAMI Master Manager WordPress plugin. Powers the live OLAMI mobile app; productized per client (OLAMI Herzliya, Nitzavim). Live link → olamiherzliya.org. New teal accent + `.mockup-thrive` (org switcher + stat cards + table + activity, reuses shared primitives).
- **BridgeMortgage** — Next.js bilingual (EN/HE RTL) mortgage-broker CRM; Kanban deal pipeline, 6-step journey, digital application, doc vault; 310 clients / 313 deals imported. "Launching Soon" badge, **Preview** link → staging.bridgemtg.kaymen.dev. New `.mockup-kanban`.
- **Kartov** — React Native + Gemini shared shopping-list & meal-planning app (Snap & Add, scan-a-list, recipe parsing); iOS/Android/web freemium. Live → kartov.kaymen.dev. New `.mockup-kartov` (shopping list + floating snap button).
- **Temani Chacham** — React Native smart Yemenite (Baladi) siddur with dynamic prayer assembly, zmanim, Jerusalem compass, offline, dedications. Live → temani.kaymen.dev. New `.mockup-temani` (RTL siddur + zmanim bar + compass).
- **Horse & Harmony** — Astro/Express bilingual equine-therapy booking site (availability calendar, weekly templates, hebcal holiday blocking, R2 media). Live → horseandharmonyil.com (real prod domain confirmed 200; the `staging.horseharmony.kahalany.dev` URL from the survey was dead — wrong domain). New `.mockup-calendar`.
- **MSP Metrics Portal** — FastAPI dashboard syncing the Autotask REST API (technician billable/compliance metrics, per-engineer status, alerts). Live → autotask.kaymen.dev (login page, same pattern as ShipHero). New `.mockup-metrics` (bar chart + status list) + cyan accent.
- **Richmount Capital** — static marketing site for a U.S.-equities investment firm. Live → richmountcapital.com. New `.mockup-richmount` (marketing hero) + gold accent.

### Updated existing cards (4)
- **NodeAI** — repositioned as a same-day, on-demand **multi-carrier courier rate-shop** (Uber Direct + DoorDash Drive + Nash), dynamic Shopify checkout pricing, human-in-the-loop approval gate, iPad Node Terminal PWA.
- **Predictable** — search-grounded AI (Gemini news + Grok/X social) and the new **Polymarket calibration probe** (Brier / skill score).
- **Claude Code UI** — now a **desktop + mobile PWA** companion (Whisper voice transcription, live model picker, named multi-window sessions, remote over Cloudflare tunnel). Badge → "Desktop · PWA".
- Kept **OLAMI Master Manager** card as-is (per request) — it remains a legitimate WordPress capability showcase; Thrive tells the migration story alongside it.

### App Store apps surfaced (same session)
- **OLAMI Herzliya** — new dedicated card for the live React Native/Expo app (App Store `id6769781161` + Google Play), Thrive-backed, featuring location-based auto check-in. New `.mockup-olami-app` phone mockup (magenta `#B41F51`). Store URL resolved via Apple's `itunes.apple.com/lookup?bundleId=com.olami.herzliya`.
- **Davenen** — existing card upgraded from web-only to web + mobile: added the `mobile` filter tag, Expo/iOS tech tags, native-app copy, and an **App Store** link (`id6761419326`) beside the web link.
- Grid is now **19 cards**.

### Global
- Added Open Graph / Twitter share meta tags + canonical + theme-color to `<head>` (long-standing TODO).
- All new "View Live"/Preview links verified reachable before wiring (Horse & Harmony's dead staging URL caught and left unlinked).

### Files Modified
| File | Changes |
|------|---------|
| `index.html` | 7 new cards, 4 updated cards, hero counters (20/8/12), OG/social `<head>` tags |
| `styles.css` | New mockup components (kanban, calendar, shopping list, siddur, metrics bars, marketing hero), teal/cyan badge + accent variants |
| `APP-MAP.md` | Portfolio count + hero stats + tech stack updated |
| `PROGRESS.md` | This entry |

### Not yet on the site (candidates for later)
Nitzavim (folded into Thrive copy), Finplan, TapSend, Sefaradidur, Kaymen Group LLC holding site. All CSS mockups reuse the `m-` system (accent-recolored) — real screenshots remain a future enhancement.

---

## Future Enhancements
- [ ] Add real screenshots alongside or replacing CSS mockups
- [x] ~~Add more contact methods (phone, WhatsApp, Calendly)~~ — Added WhatsApp + contact form
- [ ] Add OG meta tags + OG image for social sharing
- [x] ~~Add light theme toggle~~ — Added to all three frontends
- [ ] Consider adding a blog/case-studies section
- [x] ~~Add analytics (Plausible or similar privacy-respecting)~~ — Built custom analytics system
- [ ] Add IP blocking capability from admin panel
- [ ] Add email alerts for high-severity suspicious activity
- [ ] Add data export (CSV) from admin panel
- [ ] Add real-time WebSocket updates to admin dashboard
- [ ] Convert lead to client button in admin dashboard (schema ready)
- [x] ~~Add PWA support~~ — Added manifests + service workers for admin and portal
- [x] ~~Mobile responsive overhaul~~ — Card tables, bottom nav, mobile top bar

---

## 2026-08-13 — Positioning rebuild: 19 cards -> 3 practice areas + 6 case studies

### Context
`Kaymen Group LLC/marketing/MARKETING-PLAN.md` diagnosed the site as "19 undifferentiated cards
with fake CSS mockups... reads as freelancer who'll build anything, which caps deal size at
freelancer rates." This is §7 of that plan (P0/P1 items) — the site half of the fix. Positioning
calls come from `CHANNEL-PLAN.md` §7, which is the decision record.

### What changed

**Content layer — `content/projects.js` (new).** Single source of truth: 3 practice areas,
6 case studies, 12-item long tail, evidence strip. `CLIENT_NAMING = 'anonymous'` is the one
switch implementing CHANNEL-PLAN §7 decision 4 (no client name/logo/domain/product name
anywhere). Every client project carries both its anonymous shape name and its real identity;
only the anonymous form is ever emitted. **This is an interlock, not a style preference** — the
no-attribution decision is what removes the need for client consent.

**SSR — `server/render.js` (new).** Homepage sections, `/work`, `/work/:slug`, and an HTML 404.
Server-rendered rather than client-hydrated so crawlers and social scrapers get real HTML and
real per-page OG tags. No build step; templates re-read in dev, cached in prod.

**Homepage.** Removed the 19 project cards, the filter bar, and the entire "Capabilities"
section ("Whatever the stack, we've built with it" — the most on-the-nose freelancer line on the
page). index.html went 1357 -> ~200 lines and is now a template with a `<!--{{WORK}}-->`
placeholder. Hero vanity counters removed: "8 Tech Stacks" was breadth-as-the-pitch, which is
the exact thing being fixed. New hero leads capability-first (decision 1: generalist) and closes
on "Every case study below includes the part that went wrong."

**Case studies.** Six, per plan §7: multi-campus engagement platform, community lending ledger,
MSP time-compliance portal, bilingual booking platform, Torah Tracker, Claude Code Desk. Template
is problem -> constraints -> what we built -> **the hard part** -> outcome -> stack. The hard-part
section is written from real memory-file detail (the RLS bootstrap-superuser bypass, the fund-size
accounting basis change, the slot horizon with no error state, the OTA runtime-version mismatch)
and is the most visually distinct block on the page.

**OG images.** 8 generated 1200x630 cards in `assets/og/`, replacing the favicon that every
LinkedIn share was rendering. Generator is `C:/KDEV/_tools/showcase/gen-og.mjs` — lives with the
showcase tool because that is where Playwright is installed, reads `content/projects.js` directly
so cards cannot drift from the case studies. Output is committed; production needs no image
toolchain.

### Correction to the marketing plan

`CHANNEL-PLAN.md` §0 lists "Torah Tracker screenshots come back blank" as an SPA paint-timing bug
fixable with a `waitForSelector`. **That diagnosis is wrong.** Probed it: `torahtracker.app` is
the app, not a marketing site. It opens on a 5-slide first-run onboarding carousel (pale, mostly
whitespace — which is what read as "blank"), and dismissing it lands on a login wall. There is no
public surface, so no wait condition can fix it and tier A was a misclassification. The showcase
registry entry is now tier B, `capture: false`, with the real cause recorded. Enabling it needs
auth against a **seeded demo account**, or App Store listing screenshots instead.

### Still open
- **No case study carries a real screenshot yet.** 4 of 6 are de-branded client platforms that
  need seeded demo tenants (decision 3); Torah Tracker is behind auth (above); Claude Code Desk
  is a local desktop tool. The `shots` array exists on every case study and is wired — it is
  waiting on assets, not on code.
- **Public client marketing sites** (the three whose brand *is* the design) remain the unresolved
  sub-case of decision 4 — CHANNEL-PLAN §7a defaults them to excluded until Ohav says otherwise.
  They are currently excluded here too: no names, no links, no shots.
- Not committed, not pushed.

---

## 2026-08-13 (later) — Case studies became playable, not readable

### Why
Ohav's call on the first pass: "who is going to have the attention span to sit and read all of
this... they don't feel so site-like." Correct — six essays is six essays, and a nicely-typeset
dark portfolio proves nothing a template couldn't. For a software practice the site itself has to
be the proof.

### What changed
Each case study's hard part is now a **playable artifact** instead of four paragraphs. Prose
collapses to one caption; the full write-up moves behind a disclosure.

- **RLS** — toggle between `thrive` (bootstrap superuser) and `thrive_app`. Same query, same
  policies: 8 rows across 4 campuses vs 3 rows from one, with the leaked rows flagged red.
- **Fund basis** — switch counting side; the headline animates $1,633,917.56 -> $1,586,533.86 and
  the $47,383.70 gap relabels itself from "unexplained" to "spent".
- **Slot horizon** — drag days-since-deploy; slots drain to zero while `200 OK` stays lit.
  Detection and repair are deliberately SEPARATE checkboxes: with only the daily job enabled the
  window never empties, so the alarm branch would be unreachable and half the lesson lost.
- **OTA runtime** — two version dials; publish always reports success, reach shows 0%.
- **Ingestion ceiling** — widen the history window until the unbounded query returns nothing at
  all, then switch to bounded backfill + delta sync.
- **Task id keying** — event stream where updates land on keys that don't exist yet; panel sits
  at 0/5 then jumps at turn end.

New files: `content/demos.js` (markup), `assets/demos.js` (behaviour), `assets/demos.css`.
Demos load only on pages that have one. Every value is synthetic — these illustrate a mechanism,
they never display a record.

### Bug found and fixed: script.js was dead on every sub-page
`#rotatingText` is homepage-only, and `script.js` dereferenced it unguarded at what was line 66.
On `/work` and every case study that threw immediately, killing **every script registered after
it** — including the theme toggle and scroll animations. It was masked because the earlier
light-theme check forced `data-theme` manually. All homepage-only elements are now guarded, the
dead project-filter block is gone, and the fade-in selector targets the new components.

Also fixed: `String.replace` with a string replacement interprets `$&` and `$'`. The injected
content contains `$1.58M` / `$1,633,917`, so all generated-content substitutions now use function
replacements.

### Mockup
`node scripts/build-mockup.js` -> `mockup/site-mockup.html`, a SINGLE self-contained file
(276kB). All 8 pages, device-width and theme switching, and in-preview links drive the switcher.
CSS/JS are stored once and substituted per page — inlining them eight times made it 776kB, and
this gets opened on a phone. Generated through the same `server/render.js` the real site uses, so
reviewing the mockup is reviewing the implementation.

Verified with Playwright (`_tools/showcase/demodrive.mjs`, `mockuptest.mjs`): all six demos boot
and produce correct output, all four horizon states reachable, zero JS errors, demos work inside
the mockup's iframe.

### Still not done
- Seeded demo tenants — deferred by Ohav. SSH now works (agent service enabled 2026-08-13), so
  this is executable when picked up.
- Screenshots — deferred; Ohav is supplying them.
- OG cards still read as mini-brochures; they should carry one arresting number, not three.
- Not committed, not pushed.

---

## 2026-08-15 — "Quiet" redesign ported, homepage numbers wired to real sources

### The port
`mockup/v3-quiet.html` landed in the real site. Design decisions per
`HANDOFF-REDESIGN-2026-08-15.md` §1 (LOCKED): Kaymen Group palette, Sora display face, the
always-labelled 224px glass rail, the wide measure, and the hero · routing · running board ·
case studies · pricing · no-hostages · contact structure.

| File | Change |
|------|--------|
| `styles.css` | Rebuilt from the mockup (2700 → ~785 lines). The ~1400 lines of CSS device mockups from the 19-card era are gone. Sub-page components (`/work`, case studies, long tail, CTA band, 404) rewritten in the new language, since they share this stylesheet. |
| `index.html` | New shell — ambient washes, rail, mobile tabbar, hero grid, routing question, pricing, terms, contact, footer. |
| `server/render.js` | Same data in, mockup markup out. Top nav replaced by the rail + tabbar on every page. Homepage practice-areas section dropped (the routing question replaces it); long tail moved to `/work` only. |
| `script.js` | Scroll-spy, sliding lozenge, scroll-progress hairline, reveal, routing question, idea form. Theme toggle removed — the new palette is light-first and no dark variant is designed (handoff §5). |
| `assets/shots/` | The three product screenshots extracted from the mockup's inlined base64. |

Two deliberate departures from the mockup, both noted because the mockup is otherwise the
reference: the contact form was kept (the mockup's contact buttons were `href="#"` placeholders
and `/api/contact` is real, rate-limited and spam-gated), and `.case` is scoped to `.cases .case`
because the case-study *page* also uses `<article class="case">` as its root.

### Numbers: derived, not asserted
Handoff §5 called the hero fleet panel out as placeholder data sitting directly above published
prices. It is now generated.

- **`scripts/refresh-stats.js`** — walks each case study's local repo, counts *distinct days
  carrying a commit* per calendar month (same unit the retainer ladder is priced in), and queries
  the Coolify API on `admin.kaymen.dev` for production apps in a running state. Writes
  `content/stats.js`. The token is read from `COOLIFY_TOKEN`; the generated file carries data only.
- **`content/stats.js`** — generated, committed. Re-run after a month rolls over or the fleet changes.
- The panel is now **server-rendered** from that file, so the numbers are in the HTML a crawler
  sees and there is no client-side array anyone can quietly edit.
- Leading months in which the *whole* fleet was idle are trimmed. These systems are younger than
  twelve months, so a fixed twelve-month axis was half empty and read as "nothing happened"
  rather than "did not exist yet". The rendered caption always states the range it is showing.

`index.html` gained `<!--{{FLEET}}-->` and `<!--{{LIVE}}-->` alongside `<!--{{WORK}}-->`;
`renderHome()` now walks a placeholder table instead of doing one substitution.

The stats band changed with the data. `20+ apps in production` → **19 systems running right now**
(Coolify, non-staging, running). `12+ live platforms` → **commits in the last 12 months** across
the six systems on the board. `4 apps in the App Store & Play` → **3**, which is what the content
model actually marks — Kartov is not badged.

The fleet caption also changed. It claimed maintenance activity at "2–5 days a month — which is
where the plans come from"; the measured series is build-phase work reaching 29 days in a month,
so the pricing derivation was dropped rather than dressed up.

### Auto-deploy fixed
The repo's GitHub webhook (id 603404325) still POSTed to the dead `admin.kahalany.dev`, returned
200 and built nothing. Repointed to `https://admin.kaymen.dev/webhooks/source/github/events/manual`
with the app's existing `manual_webhook_secret_github`. A push to `master` deploys again — the
manual `POST /api/v1/deploy?uuid=…` trigger is now a fallback, not the only path.

`mockup/`, `scripts/` and `_tools/` added to `.dockerignore` — Express serves `.html`/`.js` from
the repo root, so they were publicly reachable in the built image.

### Still not done
- ~~OG cards in `assets/og/*.png` are still the old dark palette~~ — rebuilt later the same day in
  commit `feef1f3`, one figure per card. See handoff §3 step 6.
- Seeded demo tenants — still the highest-value asset gap.
- Per-project client naming (`CLIENT_NAMING` is still a global switch).
- **The back office was never redesigned.** `admin/styles.css` and `portal/styles.css` are both
  still `#09090b` on `#3b82f6`, and `emailWrapper()` in `server/utils/email.js` with them — so a
  client goes from the new site to an invite email and a portal that look like a different
  company. Directions for all three: `mockup/back-office.html` (2026-08-16).

---

## 2026-08-16 — Back office onto the site's design system (email + admin dashboard)

Active build doc: **`HANDOFF-BACKOFFICE-2026-08-16.md`**. Read it before continuing this work —
it carries the locked direction picks, the traps, and the recipe for screenshotting a logged-in
panel. This entry is the record of what landed; that file is the instruction.

### Directions chosen

`mockup/back-office.html` (new, self-contained) offered three admin directions, two portal
directions and the email re-skin, each with a premise / what-changes / **what-it-costs** column.
Ohav picked: **Continuity** for the dashboard, **Dense console** for the projects page,
**Reassurance plus a "needs you" block** for the portal, and dropped the Claude Code chat widget
from the design entirely — it is to be replaced by an agent that scans incoming tickets.

### Email — done

`server/utils/email.js` rewritten. The wrapper was still `#09090b` on `#3b82f6` with JetBrains
Mono while the wordmark said kaymen, so every invite, reset and ticket notification looked like a
different company than the site the client had just left.

**Three more old-theme emails were living outside `email.js`** and only turned up by grepping call
sites: the contact notification in `server/index.js` (on `#1a1a2e` — older than the theme being
replaced), the SMTP test in `server/routes/auth.js`, and a *second* invite design in
`server/routes/admin.js` competing with `sendWelcomeEmail`. All three are now functions in
`email.js`; there is one invite design, not two.

Three changes beyond the re-skin: everything user-supplied is **escaped** (a contact-form
submitter controls `name` and `message`, and those went raw into HTML landing in Ohav's inbox); a
**`text/plain` alternative** on every message, because HTML-only mail is a spam signal and the
invite is the first thing a new client receives; and the new-ticket email now **quotes the client's
description**, without which it is a link you have to open to triage.

`scripts/preview-emails.js` renders all eight to a gitignored file without sending. It calls the
real functions — only the config read and nodemailer's transport are stubbed — and exits non-zero
if the deliberately-hostile `<script>` sample ever renders as markup or a text part goes missing.

### Admin — foundation + dashboard done

`admin/styles.css` rebuilt on the locked palette, Sora + Inter and the glass rail. Emoji nav icons
replaced with line icons: emoji cannot take `currentColor`, so the active state could never tint
them. The dark/light toggle is **gone** on the same grounds the site dropped its own — and a
leftover `admin_theme` key is now actively cleared, since it would set `data-theme` on a stylesheet
with no `[data-theme]` rules left.

The dashboard is the marketing site's own vocabulary pointed at the panel's data: the evidence
strip as the metric row, the no-hostages tick-row inverted to carry a problem, and the running
board as the project list. Verified against a live server with seeded orgs, projects, milestones,
a plan, a client user, tickets and leads — not against mock markup.

Contact submissions had been rendering in **two** places (their own card and the leads count), so
dismissing one left the other showing a lead already dealt with. They are one card now.

`server/routes/admin.js` gained `p.description` in the dashboard projects query — the only API
change in this work.

### The bug worth remembering

The icon-chip tone class `alert` collided with the `.alert` message-box component and inherited its
`padding:13px 16px`, silently squeezing the glyph out of a 26px box. Nothing errored; the icon was
simply absent. Tone classes are `t-alert` / `t-warn` / `t-ok` now. The mockup could not have caught
it — it has no `.alert` component.

### Not done

- **Admin projects page → Dense console.** All the CSS is written and currently unused
  (`.c-panes`, `.c-list`, `.c-detail`, `.c-stats`, `.c-ms`, `.c-tb`, `.c-log` …); `renderLayout`
  already accepts `{ wide: true }` for it.
- **The whole portal.** `portal/styles.css` is untouched and still dark; `portal/app.js` still has
  its theme toggle.
- Security, Analytics, Settings, Clients and ticket detail were not restructured. They render
  coherently through the legacy token bridge, but still carry inline styles.
- Ohav's main-site rail tweaks (gutter-centring, upward nudge, collapsed-dot mobile rail) remain
  queued — cause diagnosed, fix not written. See the handoff §6.
- Not committed, not pushed.

---

## 2026-08-16 — Admin projects page → Dense console

### What shipped

`renderProjects()` and `renderProjectDetail()` in `admin/app.js` collapsed into one two-pane
screen. `#/projects` and `#/projects/:id` render the same console; picking a project in the left
list swaps only the right pane. The three stacked grids the project detail used to be —
Milestones + Claude Code, Plan + Tickets, Members + Activity — are one screen without a chat pane.

The left pane groups projects by status in reading order (moving → waiting → done), each row
carrying its org, its open-ticket count and its progress bar. The right pane carries the header
with an inline status `<select>`, a five-figure stat strip, milestones with inline status and
delete, plan meta, member chips, the ticket table with its inline status dropdown, and the
activity log. The plan opens full-width beneath both panes — View / Edit / History, one mode at
a time — because a 340px textarea does not fit a `.82fr` column.

### The mechanism that matters

Selection moves the hash with **`history.replaceState`**, not `location.hash =`. Assigning the
hash fires `hashchange`, re-enters the router and rebuilds the screen, which is precisely the
navigation round-trip the direction exists to delete. Verified over CDP that `#mainContent` is the
same DOM node before and after a selection.

`renderLayout()` clears the `con.mounted` flag, so every other page render invalidates the console
for free — the console never has to notice it was replaced.

### Deviations from `mockup/back-office.html`, all deliberate

- **⌘K filters the project list rather than searching projects, tickets and orgs.** The palette the
  mockup's premise describes needs a search endpoint over three tables and an overlay; that is a
  feature, not a visual-layer replacement. Left as an open decision in the handoff §6.
- **Milestone rows carry a status select and a hover-revealed delete.** The mockup's row is
  read-only; the real one has to be editable. They share the third grid column so the row does not
  grow a fourth, and the delete is always visible under `@media (hover:none)` so the installable
  PWA does not lose it.
- **The Claude Code pane is gone** (~400 lines), per Ohav's call that the widget is to be replaced
  by a ticket-scanning agent. `cc.*` is untouched and still drives the Settings pairing card.

### Beyond the re-skin

- `GET /api/admin/projects` gained **`urgent_tickets`** (open or in-progress, priority urgent or
  high). The list row's hot count was keyed off `open_tickets`, but the two extra palette tones are
  restricted to *severity* and four low-priority tickets are not an emergency.
- The plan meta line reads **`project_plans.approved_at`** instead of inferring approval from
  project status. A project can be moved to `in_progress` by hand without the client ever pressing
  Approve, and this line is the only place that difference is visible.
- Dates format with `timeZone:'UTC'`. The `+'Z'` idiom used elsewhere in `app.js` yields Invalid
  Date on a bare `2026-08-29`, and local formatting of a UTC-midnight date reads a day early west
  of Greenwich — a target date silently one day out is worse than no date.
- `renderLogin`, `renderChangePassword` and `renderInvite` stopped emitting the old
  `{ kaymen.dev }` brace wordmark; all three now use the rail's K mark. `.login-logo .mark` and
  `.login-title{padding-left:46px}` were already in the stylesheet waiting for it.

### `scripts/seed-preview.js` — the review recipe, executed

`--screenshot` cannot log in, so reviewing the back office needs a real server holding real rows.
The previous handoff described that as prose and said not to re-derive it; prose is exactly what
gets re-derived, so it is a script now. One command boots the server against a gitignored
`.preview-data/`, seeds five orgs / five projects / milestones / two plan versions / tickets /
members / four client users / a lead, and writes token-planting `_preview.html` redirects that it
deletes on Ctrl-C.

Four things it encodes that cost time to find: a new client user gets an **invite token, not a
temp password** (the whole token is in the creation response's `invite_url`; it is the users list
that truncates it); **plan approval must come from the client over the portal API**, the only
thing that writes `approved_at`; `POST /api/contact` is **rate-limited to 1/min per IP** in memory,
so one lead is all you can seed; and tickets are **org-scoped**, so it needs one client per org.

### Verification

Driven over CDP, not eyeballed: selection reuses `#mainContent`; the filter narrows the list; a
deep link lands on the right project; the plan editor, its preview tab and its version history all
open and close; an inline ticket status survives a refetch; a milestone status change moves project
progress 75% → 80%; leaving for the dashboard and coming back rebuilds cleanly. No console errors,
no exceptions. Checked at 1600px and at 430px, where the header wraps and the panes stack.

### Files

| File | Change |
|------|--------|
| `admin/app.js` | `renderProjects` + `renderProjectDetail` → `renderConsole` and its helpers; CC widget removed; login wordmark |
| `admin/styles.css` | `.c-k input`, `.c-blk h4 .hact`, `.c-meta`, `.c-inline`, `.c-av`, `.c-m .mrt/.mdel`, `.c-panel`, `.c-vr`, `.c-top{flex-wrap}` |
| `server/routes/admin.js` | `urgent_tickets` in the projects list query |
| `scripts/seed-preview.js` | New — boots and seeds a throwaway admin + portal |
| `.gitignore` | `.preview-data/`, `admin/_preview.html`, `portal/_preview.html` |

### Not done at the time of writing

- The portal (done later the same day — see the next entry).
- Security, Analytics, Settings, Clients, ticket detail and invite were not swept.
- Ohav's main-site rail tweaks remain queued — cause diagnosed, fix not written. Handoff §6.

---

## 2026-08-16 — Client portal → "Reassurance"

### The stylesheet

`portal/styles.css` was rewritten from the old dark theme onto the locked design system — the
Kaymen palette, Sora + Inter, the 224px glass rail, the glass mobile tabbar — with **its own
legacy token bridge**, exactly as `admin/styles.css` has. The portal's bridge is the more dangerous
of the two: `progressRing()` emits `stroke="var(--surface-3)"` and `fill="var(--text)"` *inside
SVG*, where a missing variable renders as nothing at all rather than as an obviously wrong colour.

`portal/index.html` was loading Inter + JetBrains Mono, declared `theme-color: #09090b`, and had no
ambient washes for the glass to refract. It now loads Sora, is light-first, and carries the three
washes. The theme toggle is gone and `portal_theme` is actively cleared — a leftover `light` would
have set `data-theme` on a stylesheet that no longer has any `[data-theme]` rules.

### The overview screen

`renderProject()` is the Reassurance direction: a status sentence at the top, then the evidence.

**The sentence is derived on every render, never written.** That is the whole safeguard, and it is
the direction's own stated cost — a reassurance has to stay true. `statusSentence()` computes it
from milestones, dates and tickets, so a project running late says *"Running 4 days behind on one
stage."* in 38px Sora rather than keeping a cheerful string somebody typed in August. Every branch
— proposed, planning, live, completed, maintenance, archived — derives the same way, and the lead
paragraph underneath assembles only facts it can prove: stages done, the current stage and whether
it is late, the pressing ticket by number, the last stage's date.

**The "yours to do" block renders only when it has contents.** Workspace's own stated cost is that
an empty to-do column reads as neglect exactly when things are going well — so when there is
nothing to do the block is *absent*, not empty, and the hero sentence carries the screen alone.

The timeline spine is lit to the real completion figure through a `--lit` custom property. The
mockup hard-codes 62%; a spine that always reaches the same point is decoration, not status.

Two API calls in parallel: the project response carries only an open-ticket *count*, and both the
sentence and the to-do block need the tickets themselves — priority, status and number.

### What was deliberately not built

**"We are blocked on you."** It is Workspace's second to-do card, and nothing in the schema records
that the team is waiting on a client. Inventing the state would put a demand on a client's screen
that nobody actually made. What *is* derivable is a ticket moved to `review` — we think it is
fixed, they have to say so — and that is what the block shows alongside a plan awaiting approval.
Making the real thing work is a small schema decision, noted in the handoff §6.

**The compose box.** Workspace puts a textarea on the landing screen; the overview links to the
new-ticket page instead. `.compose` CSS was not ported — writing CSS for a thing that does not
exist is how the admin ended up carrying an unused `.c-k` rule for a day.

### Beyond the re-skin

- `GET /api/portal/projects/:id` gained **`org_name`**, so the rail foot can name the client's own
  organisation when they arrive on a deep link rather than through the dashboard.
- **Both PWA manifests still declared `#09090b`** for `theme_color` and `background_color`. An
  installed admin or portal flashed the old dark theme on every launch, months after the theme was
  dropped. Both are `#ffffff` now.
- `renderPlan()` passed `'project'` to `renderLayout`, so the rail lit **Overview** while you were
  sitting on the plan.
- Portal dates format in UTC, same fix as the admin: the `+'Z'` idiom yields Invalid Date on a bare
  `2026-08-29`, and local formatting of a UTC-midnight date reads a day early west of Greenwich.
- `progressRing()`'s percentage was set in `var(--mono)`; the portal no longer loads a mono face
  and every other number on the surface is Sora. It is `var(--display)` now.
- The portal login, change-password and invite screens stopped emitting the old `{ kaymen.dev }`
  brace wordmark — the same fix the admin's three screens got.

### Verification

Driven over CDP against the seeded server, not eyeballed. The rail names the client's org; the
sentence derives correctly for a late project (*"Running 4 days behind on one stage"*) and for a
proposed one (*"The plan is ready for you"*); the to-do block appears with the plan-approval hero
card on the proposed project and grows from 1 to 2 to 3 as tickets are moved to `review` over the
admin API; the timeline lights to 60% on 3-of-5 stages; the ring reads the real percentage; plan,
tickets and activity all still render through the bridge. No console errors, no exceptions.
Checked at 1500px and at 430px, where the panes stack and the glass tabbar carries all five items.

The seed gained a second PCG project in `proposed`, because the portal is org-scoped: without one
in the preview client's *own* org, the plan-approval path could not be exercised at all.

### Files

| File | Change |
|------|--------|
| `portal/styles.css` | Rewritten onto the design system, with its own token bridge |
| `portal/app.js` | Reassurance overview + `statusSentence` / `buildTodo`; theme toggle removed; line icons; UTC dates; wordmark |
| `portal/index.html` | Sora, light-first theme-color, ambient washes |
| `portal/manifest.json`, `admin/manifest.json` | `#09090b` → `#ffffff` |
| `server/routes/portal.js` | `org_name` on the project detail response |
| `scripts/seed-preview.js` | A proposed project in the preview client's own org |

### Not done

- Admin: Security, Analytics, Settings, Clients, ticket detail, invite. Portal: plan, tickets,
  new-ticket, ticket detail, activity. All render coherently through their bridges; all still
  carry inline styles. This is the sweep, and it is what is next.
- Ohav's main-site rail tweaks remain queued — cause diagnosed, fix not written. Handoff §6.

---

## 2026-08-16 — The sweep: every remaining page, and both token bridges deleted

### What it was

The last item on the back-office handoff: the pages nobody restructured. Admin — Security,
Analytics, Settings, Clients, ticket detail, login, invite. Portal — plan, tickets, new-ticket,
ticket detail, activity. They rendered coherently through their legacy token bridges but still
carried inline styles written against the old dark theme's variable names.

**188 inline `style=` attributes in `admin/app.js` became 12. 68 in `portal/app.js` became 10.**
What survives is genuinely inline: data-driven widths (`width:${progress}%`), the portal timeline's
`--lit`, and four column widths on the console's ticket table.

### The point of it — both bridges are gone

With the inline styles gone, **neither app references a single old-theme variable name**, so the
legacy token bridge has been deleted from both stylesheets.
`grep 'var(--surface\|--text-dim\|--danger\|--border)' admin/app.js portal/app.js` returns nothing.

A bridge was always a way of not doing this work. It was the right call at the time — remapping
twenty names is a smaller, safer diff than rewriting several hundred inline styles mid-redesign —
but it is exactly the kind of scaffolding that becomes permanent if nobody takes it down.

The last two holdouts were inside the portal's `progressRing()`, which drew with
`stroke="var(--surface-3)"` and `fill="var(--text)"` **inside SVG**. That is the dangerous place for
a CSS variable: a missing one renders as nothing at all rather than as an obviously wrong colour,
so deleting the bridge would have silently blanked every progress ring in the portal.

### What replaced them

A small **utility layer** in each sheet — `.hint .row .meta .divide .in .mono .mt-s .field-label` —
plus real components for the two pages that earned them: ticket detail (`.t-head .t-desc .att
.att-row .drop .cmt .cmt-form`) and clients (`.org .org-user`). Both ticket detail pages, admin and
portal, now use the same components, because a ticket looks the same from both sides; the only
difference is internal notes, which a client never receives.

### Four bugs found on the way, none of them the task

- **The staff role badge was hardcoded `#c084fc` on `rgba(168,85,247,.15)`** — a raw colour from the
  old dark theme sitting in the Settings user table, months after the palette changed.
- **Bulk-replacing inline styles produced duplicate `class` attributes** (`class="card" class="mb-l"`).
  A browser uses the first and silently drops the second, so the utility class looked applied in the
  diff and did nothing on screen. Nineteen of them, caught only because the verification pass
  counted `[style]` nodes and screenshotted the result. If this is ever done again:
  `grep 'class="[^"]*"[^<>]*class="'` afterwards.
- **The portal painted every `bug` ticket alert-red** through `typeBadge`. Type is a category, not a
  severity — and `portal/styles.css`'s own header says a client shown red for normal work learns to
  ignore red. Types are neutral now; priority carries severity, and `high` moved from red to warn to
  match the admin console.
- **Portal ticket rows navigate on click and had no `cursor:pointer`.**

Also: the throwaway `_preview.html` files now carry an icon link, because without one the browser
falls back to `/favicon.ico`, that 404s, and the 404 shows up in every console check looking like a
real bug.

### Verification

Driven over CDP against the seeded server: every admin page (dashboard, clients, security,
analytics, settings) and every portal page (plan, tickets, new-ticket, activity, ticket detail)
rendered, with the count of inline-styled DOM nodes reported per page — 0 for most, 1–4 for the
data-driven ones. Posted an internal note from the admin and confirmed both that it renders
warn-toned *and* that the client's view of the same ticket still shows zero comments. No console
errors, no exceptions.

### Files

| File | Change |
|------|--------|
| `admin/app.js` | 188 → 12 inline styles; ticket detail and clients restructured; hardcoded staff badge |
| `admin/styles.css` | Bridge deleted; utility layer; §5b ticket detail + clients components |
| `portal/app.js` | 68 → 10 inline styles; ticket detail restructured; badge severity corrected |
| `portal/styles.css` | Bridge deleted; utility layer; ticket detail components |
| `scripts/seed-preview.js` | Preview files carry an icon link so the console stays honest |

### Not done

- The compose box on the portal landing screen — an open decision, handoff §6. `.compose` CSS was
  deliberately not ported; writing CSS for something that does not exist is how the admin carried an
  unused `.c-k` rule for a day.
- Ohav's main-site rail tweaks. Cause diagnosed, fix not written. Handoff §6.

---

## 2026-08-16 — Rail geometry: centred in the gutter, lifted off dead centre

### Centred in the gutter

The rail was pinned at `clamp(26px,3.4vw,68px)` while `.wrap` auto-centres inside the padded
column, so the gap grew on the content side only — near-centred at 1440px, ~97px too far left at
1920px. The fix is to derive the rail's `left` from the same expression as the text edge:

```css
--page-pl:calc(var(--rail-off) + var(--rail-w) + var(--rail-gap));
--text-left:calc(var(--page-pl) + max(0px,(100vw - var(--page-pl) - var(--page-pr) - var(--w-page))/2) + var(--wrap-pad));
.rail.left{left:max(var(--rail-off),calc((var(--text-left) - var(--rail-w)) / 2))}
```

`100vw` includes the scrollbar, which put it about 4px out on Windows — and "exactly between" was
the ask. So `script.js` measures the real `.wrap` edge (via `documentElement.clientWidth`, which
excludes the scrollbar) and overwrites `--text-left` on load and on resize. The CSS formula stays as
the no-JS fallback.

**Measured, not asserted** — edge→rail vs rail→text, over CDP:

| Width | edge→rail | rail→text | off by |
|---|---|---|---|
| 1280 | 53px | 53px | 0 |
| 1440 | 56px | 55px | 1 |
| 1680 | 103px | 102px | 1 |
| 1920 | 162px | 162px | 0 |
| 2560 | 322px | 322px | 0 |

Admin and portal got the same rule with a fixed `--text-left`, because `.main` there is
left-aligned with a max-width rather than auto-centred. It moved them 3px — so the horizontal
complaint was always a marketing-site problem, and now all three share one expression.

### Lifted off dead centre

`--rail-lift:clamp(0px,5.5vh,58px)` on `top:calc(50% - var(--rail-lift))`, in all three
stylesheets. Dead centre reads as parked. **It is one number** — raise or lower that token and
nothing else changes.

Checked at 430px and 860px: rail hidden, tabbar shown, no horizontal scroll, no console errors.

### Files

| File | Change |
|------|--------|
| `styles.css` | `--rail-off --page-pl --page-pr --wrap-pad --text-left --rail-lift`; rail left/top; `.page` padding now uses the tokens |
| `script.js` | `syncRailGutter()` — measures the real text edge, rAF-throttled on resize |
| `admin/styles.css`, `portal/styles.css` | same two tokens, fixed `--text-left` |

---

## 2026-08-16 — "vs hiring someone": three directions, not a decision

Ohav asked whether the site should carry a price comparison against hiring a dedicated programmer.
That is a *should we, and how* question, so it is a mockup with three directions and their costs
written out, not a shipped section: **`mockup/price-comparison.html`**.

- **A — The arithmetic.** The full loaded cost of a hire built up in public (base, payroll tax,
  benefits, kit, recruiting, ramp) next to `$1,800/mo`. Costs: invites a spreadsheet fight, anchors
  on price where the site was winning on evidence, and dates badly.
- **B — What you're actually buying.** A seven-row table where cost is one row, and **two rows are
  conceded outright** — full-time capacity and being in your standups. Needs no new data and never
  goes stale. Costs: does not answer the question that was asked.
- **C — The break-even.** A slider that answers straight, including *"at this many hours, hire
  someone."* Most on-brand with `No hostages`, and it keeps the hire-side figures behind the
  interaction instead of in a table to be argued with. Costs: it tells some visitors to leave.

**Every kaymen.dev figure in the mockup is the real published one** from `index.html`. **Every
hire-side figure is a placeholder, marked in amber**, and all of them derive from a single `SALARY`
constant at the bottom of the file — set that one number to something real and sourced and all
three directions move together. Nothing here should ship until it is.

### Revised the same day — the subject was wrong

Ohav confirmed the **format** (direction C: pick something, get a straight answer, including the
answers that go against us) but redirected the **subject**: not "hire us to maintain a system vs
hire a developer", which is a hypothetical about a future, but **"here is what we already built,
and what it would have cost you otherwise"** — a receipt.

`mockup/price-comparison.html` was rebuilt on that basis, and the rebuild is stronger for one
reason: **the effort figures do not have to be invented.** `content/stats.js` is generated by
`scripts/refresh-stats.js` out of real git history — distinct days carrying a commit, per project,
per month. That gives **176 working days across the six live case studies**, counted rather than
estimated:

| System | Days | Span |
|---|---|---|
| Multi-campus engagement platform | 58 | Jun–Aug 2026 |
| Torah Tracker | 35 | Feb–Aug 2026 |
| Claude Code Desk & Mobile | 29 | Mar–Aug 2026 |
| Community lending ledger | 26 | Mar–Aug 2026 |
| MSP time-compliance portal | 18 | Jun–Aug 2026 |
| Bilingual booking platform | 10 | Apr–Jul 2026 |

Pick a system, pick what to compare against (US agency / in-house team / offshore shop), and the
card recomputes. Our figure is **derived from the site's own published $165/hr**, so it needs no new
number and is labelled list price on screen. Only the three comparison day rates are placeholders.

Two things make it honest rather than promotional, and both are deliberate:

- **The offshore basis loses.** At the placeholder rate an offshore shop quotes *under* us on
  several of these, and the verdict says so in as many words rather than hiding the option.
- **The second-attempt callout.** Where the case study data supports it, the card says what was
  already paid for and did not work — the multi-campus platform replaced a 135,000-line WordPress
  plugin somebody had already been billed for; the lending ledger surfaced a $47K gap that the old
  process could not see. That is the real argument, and it is not hypothetical.

Stated on screen as the honest weakness: **days-with-a-commit is a proxy, not a timesheet.** A
20-minute fix and a 10-hour day both count as one, so it reads low on thinking-heavy work.

Still needed from Ohav: the three comparison day rates, sourced.

## 2026-08-16 — The mark: a keystone, not a letter in a box

The site had a letter K in a rounded square, and `favicon.svg` was still the
pre-redesign one: a blue-to-purple gradient on near-black, four months after the
palette moved to teal on `--deep`. Every tab and every share carried the old
brand.

**What the mark is now.** A segmented arch with the keystone in the accent, the
wordmark in the span beneath it. The logic is the retainer argument as a shape:
you own the building, we are the stone that keeps it standing.

**The trap, written down because it cost two attempts.** A lone tapered block
reads as a cup, and Ohav said so unprompted on the first draft. Taper is not
what separates the two objects: a drinking tumbler and a real voussoir taper
within a few per cent of each other. It is context. Flanked by its neighbours
the wedge is one stone in a course; alone it is glassware. So the mark is
**always three stones or more, never one**.

The icon needed a second correction of the same kind. Three stones over empty
space read as wings at 192px, which the 24px previews had hidden. Carrying the
course through the full 180 degrees and dropping two piers to a floor makes it
a doorway, which nothing turns it back into, and a doorway is roughly square so
it fills an icon slot instead of hovering in the top third. **Seven segments,
not nine**: at 16px nine blur into a smooth band and the keystone stops being
distinguishable from its neighbours.

**Optical cuts, because one drawing does not survive the range.** Display is
nine segments for 140px and up; below that the three-degree gaps fall under one
physical pixel and the course fuses into a band. Text is five segments and a
wider gap for 56 to 140. The gateway is 40 and under. They are siblings, not one
drawing scaled, and that is deliberate.

**One bug worth remembering.** The wordmark rendered in Times on Ohav's screen
while the headings around it were Sora. Google Fonts serves unicode-range
subsets, so a face is only fetched when something asks for it; HTML text asks,
SVG text injected by script afterwards can paint before the request lands and
never repaint. `document.fonts.ready` did not help because nothing had asked
yet, so it resolved instantly with the font still absent. The fix is to request
the exact faces, wait, and only then draw, plus a fallback chain: SVG's default
fallback is serif, not sans, so a missed webfont does not degrade quietly here.

### Landed

- `content/logo.js` — the single source. Every path is generated from `seg` and
  `course`; there are no hand-written path strings and there should never be.
  `course()` throws on an even segment count, because a course with no middle
  stone is an arch that has already fallen down.
- `scripts/build-icons.js` — writes `favicon.svg`, `assets/mark.svg` and the
  three PNGs by driving installed Chrome over CDP with Node's built-in
  WebSocket. No new dependency, and it verifies the PNG signature rather than
  committing an empty file.
- **`apple-touch-icon` was a no-op.** Both admin and portal pointed it at
  `favicon.svg`; iOS ignores SVG there and screenshots the page instead. Now a
  real 180px PNG, and the manifests carry 192/512 plus a maskable.
- The K is gone from all nine places it was drawn. The tile keeps its gradient
  and the arch rides on top as a second background layer, so the change is one
  line per rule rather than markup in nine files.
- OG cards regenerated with the new mark, and their copy de-dashed. The dead
  `work-claude-code-desk.png` is deleted.

### Open

- The wordmark sits **under** the span, which reads as us being sheltered rather
  than us being the stone. The metaphor runs the other way. Kept because the
  alternative leaves the name homeless; Ohav's call.
- `assets/og/README.md` still documents the generator's old design note.

---

## 2026-08-16 — Front end: hero rebuilt, pricing merged, mark rolled out

**See `HANDOFF-FRONTEND-2026-08-16.md` for the detail.** 22 commits,
`ed6917f` … `76b5eac`, all live.

### Landed

- **`#need` and `#price` merged.** They asked the same question and both ended in
  a price — 2,046px, 29% of the homepage. One section now, ~835px, keeping
  `id="price"` so case-study links survive.
- **Hero rebuilt** to "Own your software. Stop renting it.", argued through the
  pain and answered with six what-you-get blocks. The right-hand panel is the
  subscription stack they already pay for, server-rendered from
  `content/pricing.js`.
- **Subscription figures researched** (Aug 2026 list prices, team of five):
  $290/mo, $405 after three hires. Google Workspace deliberately excluded.
- **Picker opens on the $2,500 rung**, reworded a third time to name the *thing*
  rather than the work — "Your first real system".
- **BridgeMortgage retagged** `platform` → `stack`; at `platform` the cost block
  showed year-one $42,000 against an agency $15,600–20,800 and argued against us.
- **The mark rolled out everywhere** — lockup on the rail, both back offices,
  email, social cards. Fixed a pipeline bug where every generated PNG was
  flattened onto white, leaving `kaymen-lockup-white.png` effectively blank.
- **Social cards generated from the site's own copy** (`scripts/build-og.js`),
  after `default.png` spent a day advertising a superseded sentence.
- **Mobile**: brand chip added and made to retract on scroll, mesh kept at 45%
  with the source moved clear of the copy, tabbar reordered to match the page,
  a dead `/#need` rail link removed from every sub-page.
- **Clients named on the running board** — it asked `s.own` ("is this ours")
  instead of `clientName()` ("may we name them"), so it hid BridgeMortgage,
  Thrive, PCG and Horse & Harmony behind "Named on request" while the case study
  one click away credited them.

### The lesson worth carrying forward

The hero mesh took **four attempts** because three tests measured the element and
not the paint. `.hero` carried `overflow:hidden`, which clipped the full-bleed
canvas while `getBoundingClientRect` still reported the full width. **When
something looks wrong but measures right, measure what renders.**

### Open

- **Screenshot strip**: the Thrive back-end capture contains real student names.
  Naming consent covers Thrive as a client, not the students in it. Shoot against
  `scripts/seed-preview.js` demo data instead.
- Existing shots are illegible at phone width; the mobile hero is cramped; the
  pricing headline runs to four lines on mobile.

---

## 2026-08-16 (evening) — Client back ends in the strip, Ariel's pricing notes, and the reset flow that locked us out

### Context

Four threads in one session: shoot the client back ends the strip has been
waiting for, act on Ariel's review of the live page, add www + a client login,
and — unplanned — work out why nobody could log into the admin panel.

Commits `c97625d` … `f7d5182`.

### The screenshot strip

**BridgeMTG, Thrive and Horse & Harmony are in.** It shipped at six for about an
hour (client back ends *plus* predictable/kartov/davenen); Ohav killed that on
sight, and he was right — it doubled a strip already too small to read and
diluted what the section is for. **Three, and it stays three.** The retired
JPEGs stay in `assets/shots/` so the mix can change without a re-shoot.

**Every shot is a local instance on fabricated data, and that is the point.**
The Thrive screenshot originally supplied held six real students by name, an
intake queue, a staff member and a university. Consent to name the **client** is
not consent to publish the **people inside their system**. So: `@example.com`
addresses, reserved `555` phone ranges, invented names throughout. BridgeMTG's
seeded staff were renamed too — its `seeds/009_staff_users.ts` creates the real
people with their `@bridgemtg.com` addresses, and employees are not covered by
client naming consent either.

`scripts/shoot-app.js` is new: Chrome over the DevTools protocol, same approach
as `build-icons.js` and `build-og.js`, no new dependency. It asserts 900x562 on
the way out, because the markup hard-codes those dimensions and nothing
downstream would catch a miss.

Two traps cost an hour each and are written into
`HANDOFF-FRONTEND-2026-08-16.md` §6:

- **Type, don't assign.** Assigning `.value` fills the box and leaves React's
  `useState` and Livewire's state empty, so the form submits blank. Needs
  `Input.insertText` *plus* `Emulation.setFocusEmulationEnabled` — headless pages
  are never focused, so without it every keystroke goes nowhere.
- **Next.js `dev` never hydrated at all** (no React fiber on any element, HMR
  socket failing in a loop). `next build && next start` fixed it, and a
  production build is the more honest screenshot anyway.
- Also: **BridgeMTG deals are invisible without a `deal_assignees` row** — the
  pipeline query scopes to the signed-in user, so a seeded deal with no assignee
  renders as "No deals yet".

### Ariel's review — two changes that are really one

**The hero panel now prices the person, not just the licences.** It stopped at
$290 of subscriptions, which was its weakest point: $290 is not a frightening
number, and the panel already conceded the page is not cheaper in year one.
Ariel: *"we dont necessarily save u money on the saas fee but we save u money on
manpower."* What is published is a **break-even, not a salary** —
`reconcileBreakEven()` divides the licence total by four hours a week, computed
rather than typed, so it is arithmetic a reader can check rather than a claim
about their payroll.

**The entry rung went $200 to $300/mo.** The ladder's own evidence agrees: ~5
h/mo on a light system made $200 an effective $40/hr against a published $125/hr
overflow rate. **It was only safe to raise because the labour line landed with
it** — $200 sat under the $290 total and the panel put them side by side, so the
comparison is now $290 *plus the person* against $300 flat. **Do not undo one
without the other.** No case study moved; all are `stack` or `platform`.

**All four rungs now show what they include** (`#askAll`). The picker showed one
at a time, so comparing meant clicking and remembering. Deliberately **not** a
tier table: ordered by the situation you are in, money muted at the foot of each
card, and a third way into the same `askSel` state rather than a second pricing
surface. A price-led grid would put $15,000 on screen before anyone had read what
it was for, in the rental frame the rest of the page argues against.

The ratified ladder doc in `unified-memory` was updated with all of this,
including the scope caveat: this is **not** a per-seat TCO argument (which that
doc rightly forbids) — it sits on a panel that says "team of five" out loud,
which is the size where somebody really is losing half a day a week.

### Copy: "What we run"

**"Systems still running" is gone.** "Still" presupposes that software stopping
is the normal outcome, so it read as relief rather than confidence — and it
invited "still, since when?", which the board answered badly. The replacement is
present tense, needs no duration to be true, and mirrors "What you need" directly
above it in the rail. Three places, as always: the `h2`, `index.html`'s rail, and
`RAIL_ITEMS` in `server/render.js`.

### Mobile

Two strips now **swipe below their breakpoint** rather than stack:

- `.ask-grid` — four cards were 949px on a 390px phone; now 294px.
- `.shots` — three 900x562 desktop captures were 963px at 390px and 1,671px at
  768px; now 295px and 471px.

The chosen card is centred by setting the strip's **own `scrollLeft`**, never
`scrollIntoView`, which is entitled to scroll the page vertically and would drag
a first-time visitor down it on load. This does not make a back office legible at
320px and is not meant to — real legibility needs mobile-specific crops.

### A client login

`/portal` had no route in from the marketing site. It sits **outside**
`.rail-nav`: the lozenge is positioned against that list's children, so a seventh
child would give it a link to park on that never becomes current, and the rail's
grammar is "where am I on this page", which a login is not. No top bar was
invented — this design replaced the header with the rail, and a fixed top-right
control for one link would fight that.

**It turned out to be four places, not two.** The rail *and the footer* each
exist twice, once in `index.html` for the homepage and once in `server/render.js`
for every other page. The footer duplication is the same trap as the rail/tabbar
lists and was not written down before now.

### Infrastructure

- **www.kaymen.dev added.** DNS was already correct; Coolify simply had no router
  or certificate for it. Let's Encrypt issued on redeploy.
- **kahalany.dev removed** from the app's domain list. Legacy, its apex A record
  is gone, and its certificate would have failed renewal on 22 Aug.
  `www.kahalany.dev` separately still points at the JYA box (178.156.226.190).
- **LIVE SINCE corrected.** Every row said 2026 because the years had been taken
  from git history, and the KDEV repos were re-initialised (history starts
  Feb–Jun 2026). Only the OLAMI platform that became Thrive, Torah Tracker and
  Davenen predate 2026; the first two are case studies, so two rows moved to
  **2025**. `year` is LIVE SINCE, not repo age — do not re-derive it from git.

### The password reset flow — why nobody could log in

`/reset-password` generated a password, **overwrote the account with it**, and
printed the plaintext to stdout. The UI said *"the new password will appear in
the server logs."* Workable on a laptop; unusable here, because `docker logs`
only covers the **current** container and every push to `master` redeploys. The
23:38 reset was destroyed by the 23:40 deploy, and since the endpoint had already
overwritten the password, the account was unreachable. **It reported success
throughout.**

SMTP had never been configured — the `config` table held only `jwt_secret`, and
`git log -S"smtp_host"` shows the storage location never moved, so nothing was
orphaned by the email rewrite.

Two rules came out of it, and **the first matters more than the emailing**:

1. **A reset request no longer touches the password.** The endpoint is
   unauthenticated — anyone who can type an address can fire it — so destroying
   the password on request let any stranger lock any user out, and it is what
   turned a failed delivery into a lockout. The password changes only when the
   emailed link is used, via the existing `/invite/:token/accept` flow, at one
   hour rather than the invite's seven days.
2. **Nothing claims delivery it did not make.** `sendEmail` already returned
   `true`/`false`; **all four callers discarded it.** They now await and report
   it, and the UI says "no email was sent — send them this link yourself" instead
   of "Invite link sent via email". That mattered most on client creation, where
   the account is seeded with a deliberately unusable password: a silent failure
   there is an account the client can never enter, while the operator was told
   the invite went out.

With no SMTP the self-service route now refuses with **503** rather than
returning success. Known and unknown addresses still get byte-identical replies,
so it is not an account-existence oracle.

**SMTP is now configured** (Gmail, `ohav@kaymengroup.com`) and delivery was
verified end to end — `[EMAIL] Sent "Reset your kaymen.dev password"` in the
container log — rather than assumed from the settings being present. The app
password's embedded spaces are fine.

### The lessons worth carrying forward

**Verifying a fix can trigger the bug.** The first poll confirming the reset
deploy POSTed to `/api/auth/reset-password` about seven seconds *before* the new
code went live. The old endpoint answered, rotated the password, and the
container was replaced moments later taking the log with it — destroying the
credential handed over ten minutes earlier. **A probe against production is a
write if the endpoint is a write.** Check the deployed version first, or probe
with something inert.

**`pkill -f "node server/index.js"` silently kills nothing on this host.** The
old process keeps the port, the newly-started one fails to bind, and every
`curl` is answered by stale code. It twice produced confident, wrong conclusions
about code that was already correct — once about a nav mismatch, once about the
rewritten reset route. Kill by port and assert the port is free.

**A blank field is not evidence.** "You have never logged in" was read off
`last_login_at`, which the password login route never writes — only the Google
OAuth path does. The conclusion happened to be right; the reasoning was not.

### Open

- **No backups of `analytics.db`.** One sql.js file on one Docker volume
  (`kahalany-dev-data`), no copies anywhere. It is now the single point of
  failure for every client account, project and ticket. Most pressing item here.
- **The login endpoint cannot lock out.** `users.login_attempts` and
  `locked_until` exist and are **never written** — zero write sites. A working
  `rateLimit` middleware exists in `server/middleware/auth.js` but is applied
  only to `server/routes/dev.js`, not to `/api/auth/login`. bcrypt at cost 12 is
  the only mitigation. Every piece needed is already in the codebase.
- **All production data begins 2026-08-16 19:45** — every visit, event and user.
  Consistent with the back office landing that day, but unprovable either way
  with no backup to compare against.
- The **shots are still illegible on a phone**; fixing that properly needs
  mobile-specific crops, i.e. a second set of assets shot at a tighter frame.
- The **pricing headline runs to four lines on mobile**; the **mobile hero is
  cramped**.
- **Tell Ariel the site is up** — he is gating a lab-company introduction on
  exactly that, and it is the only item in his message with revenue attached.
