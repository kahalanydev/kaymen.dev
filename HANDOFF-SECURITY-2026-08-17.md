# kaymen.dev — security & tracking centre handoff

**Written 2026-08-17.** This is now the active build document. Read it, then
`HANDOFF-BACKOFFICE-2026-08-16.md` (previous, landed), then
`HANDOFF-REDESIGN-2026-08-15.md` §1 for the LOCKED design decisions that still bind
everything, then `PROGRESS.md` and `APP-MAP.md`.

**Scope:** a real security and tracking platform in the back office — traffic, addresses,
devices, long-run statistics, and an actual firewall. Two rail items were rebuilt
(Security, and Analytics → Traffic); the rail is still six items and none of the locked
design decisions were re-opened.

---

## 0. State in one line

**Done and verified.** `node scripts/verify-security.js` drives the whole pipeline over
HTTP and passes 44/44. Both panels were rendered in a real browser over CDP at 1600px and
390px and read correctly against seeded data.

---

## 1. What existed before, and why it needed replacing

This is the part worth keeping. The old system was not a small version of this one — it
was measuring different things.

| Claim the old system made | What was actually true |
|---|---|
| "Visitor tracking" | `/api/track/visit` **received `path` and never stored it.** The panel could report how many people came and not one page any of them read. |
| "Suspicious activity detection" | Ran on exactly two code paths: 404s, and `/api/track/visit`. An exploit attempt against a route that **exists** — every `/api/*`, the login form, any static asset — was invisible. |
| "Rate limiting / brute force protection" | `users.login_attempts` and `users.locked_until` had existed since the portal was built and **nothing had ever read them.** The login route compared a password and returned. |
| Blocking | There was none. No blocklist, no table, no mechanism. Detection wrote log rows and that was the end of it. |
| `app.set('trust proxy', true)` | Trusts *every* hop, so `req.ip` was the **leftmost `X-Forwarded-For` entry — a header the client writes.** Any visitor could attribute their traffic to any address they liked. |
| Analytics charts | Still on the deleted dark theme: `#3b82f6` series on `rgba(255,255,255,.05)` gridlines. On the light palette those gridlines are **white on white.** The 2026-08-16 sweep could not catch them because Chart.js takes colours as a JS object, not CSS — `grep var(--surface` came back clean. |

---

## 2. Architecture

```
request
  │
  ├─ shield (server/middleware/shield.js)      ← NEW, runs on EVERY request
  │    ├─ normalise client IP
  │    ├─ allow rule?  → never blocked, still inspected
  │    ├─ block rule?  → 403, done
  │    ├─ inspect: path, query, body, UA        (utils/detection.js)
  │    ├─ accumulate score per IP over 10 min
  │    └─ decide: refuse / record / pass
  │
  ├─ routes
  │    ├─ /api/track/{visit,pageview,engagement,event}   ← rewritten
  │    ├─ /api/admin/security/*                          ← NEW router
  │    └─ /api/admin/traffic/*                           ← NEW router
  │
  └─ hourly: rollup + prune (utils/rollup.js)  ← NEW
       ├─ raw visits/pageviews  →  traffic_daily + dimension_daily   (PERMANENT)
       └─ then delete raw rows past their retention window
```

### The threat engine — `server/utils/detection.js`

Rewritten from three regex lists into a scoring engine.

- **Classifies** a user agent into a *kind* (`search` / `ai` / `social` / `seo` / `monitor`
  / `tool` / `scanner` / `headless` / `human`) rather than a boolean. "Bot" lumped
  Googlebot in with sqlmap; those two want opposite responses.
- **Inspects** path, query, body and referrer against ~20 signatures (SQLi, RCE, traversal,
  file inclusion, deserialisation, SSRF, SSTI, XSS, Log4Shell, secret-file probes, webshells,
  CMS/dbadmin/infra probes) and returns **scored** findings.
- Scores **stack**, which is the point: `/wp-admin/setup-config.php` is a 30 (CMS probe) plus
  a 40 (server-language probe) and clears a threshold neither reaches alone. Nothing had to
  anticipate that exact path.
- Bodies are only scanned up to 4KB. Running twenty regexes over a 1MB body on every request
  is a denial of service you build yourself.

### The shield — `server/middleware/shield.js`

Thresholds, calibrated against those scores, all in `decide()` so the policy is readable in
one place:

| Condition | Result |
|---|---|
| single request scores ≥ 60 | refuse + auto-block |
| rolling 10-minute score ≥ 150 | refuse + auto-block (catches the patient scanner) |
| ≥ 300 req/min | refuse + auto-block |
| score ≥ 20 | record only |

Auto-blocks **escalate and expire**: 1h → 6h → 24h → 7d by prior offences. IPs are shared and
reassigned; a permanent ban for one bad request punishes whoever gets the address next.

### Three rules it will not break

1. **Never blocks a private or loopback address.** The container talks to itself and a health
   check that gets a 403 takes the site down.
2. **Never blocks an IP with an `allow` rule** — and a successful admin/staff login writes one
   for its IP, rolling weekly. This is the thing standing between auto-blocking and *locking
   Ohav out of production at 2am with no console to undo it from.* It is a visible, revocable
   row in the Addresses tab, not a hidden exception in code.
3. **`SHIELD_DISABLED=1` turns the whole thing off** without a deploy.

An allow rule exempts an address from being **blocked**. It does not exempt it from being
**watched** — those are different powers, and conflating them is how a trusted address
becomes an unmonitored one. A block that gets skipped is recorded under its own category
(`block_exempted`) so an exemption that fires is visible.

### Rollups and retention — `server/utils/rollup.js`

`HANDOFF-BACKOFFICE-2026-08-16.md` §6 flagged that `server/db.js` holds the whole database in
memory and rewrites **the entire file** on a 1-second debounce plus a 30-second interval —
fine at 286KB, not fine with a year of tracking data. Shipping this feature without an answer
to that would have made the problem it warned about.

The answer is that "long-run statistics" and "keep every raw row" are separable:

- `traffic_daily` + `dimension_daily` are **permanent**, small, fixed-shape. Every long-run
  question is answered from them. Ten years is a few megabytes.
- Raw `visits` / `pageviews` / `events` / `suspicious_activity` are a **working set** with a
  retention window (60–400 days). They power the drill-downs, which are only ever asked about
  recently.

`prune()` refuses to delete past the newest rolled-up day. Without that guard, a rollup that
threw for three days running would be followed by a prune that destroyed those three days.

**The bigger win was upstream:** heartbeats are no longer `events` rows at all. They were one
INSERT every 30 seconds per open tab — a tab left open overnight was ~1,000 rows describing
one visit. A heartbeat is now an UPDATE against the visit it belongs to.

---

## 3. What is on screen

**Security** — `#/security`, four tabs. Overview (posture, six metrics, threat activity
chart, offenders ranked by *severity not volume*, category breakdown, latest events),
Threat feed (filterable), Addresses (blocklist/allowlist CRUD), Sign-ins (auth log + locked
accounts). Plus a **dossier** at `#/security/ip/<ip>` — everything known about one address in
one call, because "should I block this" needs all of it at once.

**Traffic** — `#/traffic`, five tabs. Overview, Pages, Devices, Places, Live. Plus a **session
timeline** at `#/traffic/session/<id>`.

Both lead with a **derived sentence**, the same device the client portal's overview uses
(`portal/app.js` `statusSentence`). Recomputed on every render, so it cannot drift out of
agreement with the figures underneath it. `posture()` in `routes/security.js` deliberately has
a good-news branch — a security page that only speaks up when something is wrong trains you to
assume the quiet version is broken.

---

## 4. Traps — read before touching anything

- **Unique visitors cannot be summed.** `traffic_daily.visitors` is correct *for its own day*,
  but somebody who visits Monday and Thursday is one visitor and two daily uniques. `SUM()`
  over 90 days reported 987 people out of 990 visits, which is only plausible because it is
  wrong. The period figure is counted from raw, and the response carries
  `uniqueVisitorsExact:false` once the window reaches past the retained rows — at which point
  the UI says "at least". **Every rollup-based analytics system falls into this once.**
- **`browserFamily` strips the trailing version; it does not take the first word.** Taking the
  first word looks right for `Chrome 138.0.0.0` and mangles every two-word browser —
  `Mobile Safari 18.2` became **"Mobile"**, which sat in the browsers chart as the site's
  second most popular browser with nothing called Safari anywhere near it.
- **Chart.js colours are invisible to a CSS sweep.** They are a JS object literal. That is how
  the dark theme survived in this file for a day after it was deleted everywhere else — and
  then how `CHART.line` (`#e2e4e8`, a *border* colour) made the threat chart's "Seen" bars
  render as a blank plot area. There is a `CHART.quiet` for that now. **The same mistake was
  made twice in one file; check contrast against white, not against the token's name.**
- **Chart animation is off, deliberately.** These redraw on every tab and period change so the
  animation communicates nothing — and it made the panel unscreenshottable: a capture during
  the sweep-in shows a line compressed into the left edge of its own axis, which reads as a
  data bug and is not one.
- **`ensureFresh()` keys on whether the DATA changed, not on a clock.** A time window alone was
  wrong in both directions: it re-rolled an idle site every two minutes for nothing, and served
  a stale "today" to anyone who loaded the page within the window of a visit arriving.
- **`dimension_daily` uses a nested map on the way in, not a `"kind key"` composite string.**
  Half these keys legitimately contain spaces — *United States*, *Mac OS* — and splitting on
  the way back out silently stored them as "United" and "Mac".
- **The two new routers must stay mounted BEFORE `routes/admin.js`** in `server/index.js`.
  Both live under `/api/admin` and Express matches in registration order.
- **A hash change does not re-run the SPA.** Planting a token in localStorage and then
  navigating to a new `#hash` leaves `state.token` holding the null it read at boot, and every
  page renders the login screen. Full document load per page, via `about:blank`.
- Everything in `HANDOFF-BACKOFFICE-2026-08-16.md` §4 still holds — the deleted token bridges,
  silent class-name collisions, `.metrics-grid` using `auto-fit`, `history.replaceState` in the
  console.

---

## 5. Verifying it — two commands

```bash
node scripts/verify-security.js    # 44 checks, exits non-zero on failure
node scripts/seed-preview.js       # a seeded panel to actually look at
```

`verify-security.js` boots a throwaway server and asserts on real behaviour: that engagement
never creates event rows, that a late heartbeat cannot overwrite a real scroll depth, that SQL
injection is refused, that a low-score probe is *not*, that an allow-listed IP survives an
exploit attempt but is still recorded, that five bad logins lock an account, and that an
unknown address returns the same error as a wrong password.

**One thing it encodes that costs time to find:** the shield ignores private addresses, so a
test from localhost engages none of it. Every hostile request carries an `X-Forwarded-For` of a
TEST-NET-3 address (`203.0.113.0/24`), resolved through `trust proxy = 1`. That also makes it an
end-to-end test of the trust-proxy fix — under the old `true` those headers would have been
taken at face value from any client.

`seed-preview.js` now calls `scripts/seed-traffic.js` **before booting the server**, which is the
only ordering that works: db.js keeps the database in memory and rewrites the file on a debounce,
so a second process writing to that file while the server runs has its work overwritten by the
server's next save.

---

## 6. Open — needs a decision

- **Geo lookup is best-effort and unauthenticated.** ip-api.com's free tier is 45/min from one
  address, capped here at 4 concurrent, and every failure is silent. At current volume that is
  fine. If traffic grows, either accept gaps or pay for a key — and Ohav avoids paid API keys,
  so the honest default is gaps.
- **The rail has no Security count.** `state.navCounts.security` is wired through
  `renderLayout` and the dashboard sets it to `null`. A live threat count next to the rail item
  is a small change to the dashboard endpoint and might be exactly the wrong thing — a red pill
  that is *always* lit for routine background scanning is noise within a week.
- **Auto-block thresholds have not met real traffic.** They are calibrated against the
  signature table, not against what actually arrives at kaymen.dev. Worth reading the Threat
  feed after a week and checking that nothing legitimate was refused. `BLOCK_ON_REQUEST_SCORE`
  and friends are four constants at the top of `shield.js`.
- **`suspicious_activity` is doing two jobs.** It is the threat log *and* the auto-block audit
  trail (`category = 'auto_block'`), which is what `priorBlocks()` reads to escalate. It works,
  but if the threat log ever gets a retention window shorter than the escalation memory should
  be, escalation quietly resets.
- **Nothing emails Ohav when something serious happens.** The panel is excellent at answering
  "what happened" and cannot tell him to look. `utils/email.js` already has a skinned wrapper;
  a daily digest or a critical-severity alert is a small, obvious next step.
