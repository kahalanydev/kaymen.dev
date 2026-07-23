# Kahalany.Dev Site — Progress Log

> Portfolio/showcase site for Kahalany.Dev custom software practice.
> Live at: https://kahalany.dev
> Repo: https://github.com/kahalanydev/kahalany.dev

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
