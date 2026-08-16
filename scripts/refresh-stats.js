#!/usr/bin/env node
/* ============================================================================
   refresh-stats.js — regenerate content/stats.js from real sources

   Every number the homepage prints comes from here, and every one of them is
   derived rather than asserted:

     • the fleet sparklines  — distinct days with a commit, per calendar month,
                               per project repo, over the last 12 months
     • the live-systems count — production (non-staging) applications in a
                               running state on our own Coolify
     • the stats band        — the two above, plus store presence counted from
                               content/projects.js

   This replaced a hand-written placeholder series that sat directly above
   published prices (HANDOFF-REDESIGN-2026-08-15.md §5). Nothing here should
   ever go back to being typed by hand.

   Usage (from the project root):
     COOLIFY_TOKEN=... node scripts/refresh-stats.js
     node scripts/refresh-stats.js --no-remote   # git only, keep last Coolify data

   The token is read from the environment on purpose — content/stats.js is
   committed, and must never carry a credential.
   ========================================================================== */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* KDEV workspace root — this project lives at <KDEV>/Personal/<folder>, so the
   sibling repos are two levels up. Override with KDEV_ROOT if that changes. */
const KDEV = process.env.KDEV_ROOT || path.resolve(ROOT, '..', '..');

const COOLIFY_API = 'https://admin.kaymen.dev/api/v1';
const MONTHS = 12;

/* --- which repo backs which case study -------------------------------------
   Keyed by the slug in content/projects.js so the fleet panel and the running
   board can never drift apart. A project with no local repo is simply absent
   from the sparklines rather than being given invented numbers. */
const PROJECT_REPOS = {
  'multi-campus-engagement-platform': 'Clients/Thrive/platform',
  'community-lending-ledger': 'Clients/PassaicCliftonGemach',
  'msp-time-compliance-portal': 'Personal/Autotask - tech metrics',
  'bilingual-booking-platform': 'Clients/HorseHarmony',
  'torah-tracker': 'Personal/TorahTracker',
};

/* Short labels for the hero panel — the full case-study names are too long for
   a 386px column. The board below uses the real names. */
const SHORT_NAMES = {
  'multi-campus-engagement-platform': 'Multi-campus platform',
  'community-lending-ledger': 'Community ledger',
  'msp-time-compliance-portal': 'MSP compliance portal',
  'bilingual-booking-platform': 'Bilingual booking',
  'torah-tracker': 'Torah Tracker',
};

const { CASE_STUDIES, MORE_WORK, areaById } = require('../content/projects');

/* --- month buckets --------------------------------------------------------- */

/** The last MONTHS calendar months, oldest first, as 'YYYY-MM'. */
function monthKeys(today) {
  const keys = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/* --- git ------------------------------------------------------------------- */

/**
 * Distinct days with at least one commit, per month, for one repo.
 * Days rather than commits on purpose: the retainer ladder is priced in active
 * days a month, so the bar has to be the same unit as the plan.
 */
function activeDaysByMonth(repoPath, keys) {
  const since = `${keys[0]}-01`;
  let out;
  try {
    out = execFileSync(
      'git',
      ['-C', repoPath, 'log', '--all', '--since', since, '--pretty=%cs'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 }
    );
  } catch (e) {
    console.warn(`  ! ${repoPath}: ${String(e.message).split('\n')[0]}`);
    return null;
  }
  const daysPerMonth = new Map(keys.map((k) => [k, new Set()]));
  let commits = 0;
  for (const line of out.split('\n')) {
    const day = line.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const bucket = daysPerMonth.get(day.slice(0, 7));
    if (bucket) { bucket.add(day); commits++; }
  }
  return { series: keys.map((k) => daysPerMonth.get(k).size), commits };
}

/* --- coolify --------------------------------------------------------------- */

/**
 * Production applications currently running on our Coolify.
 * "Staging" copies are excluded — they are real deployments but they are not
 * systems anyone depends on, and counting them would inflate the number.
 */
async function liveApps(token) {
  const res = await fetch(`${COOLIFY_API}/applications`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Coolify ${res.status} ${res.statusText}`);
  const body = await res.json();
  const apps = Array.isArray(body) ? body : body.data || [];
  const prod = apps.filter(
    (a) => !/staging/i.test(a.name || '') && String(a.status || '').startsWith('running')
  );
  return {
    total: apps.length,
    running: prod.length,
    names: prod.map((a) => a.name).sort(),
  };
}

/* --- store presence -------------------------------------------------------- */

/** Apps published to the App Store / Google Play, counted from the content model. */
function storeApps() {
  const fromStudies = CASE_STUDIES.filter((s) => /app store|google play/i.test(s.status)).map((s) => s.name);
  const fromTail = MORE_WORK.filter((m) => /app store|play/i.test(m.badge || '')).map((m) => m.name);
  return [...new Set([...fromStudies, ...fromTail])].sort();
}

/* --- main ------------------------------------------------------------------ */

(async () => {
  const noRemote = process.argv.includes('--no-remote');
  const today = new Date();
  const keys = monthKeys(today);
  console.log(`Window: ${keys[0]} … ${keys[keys.length - 1]}`);

  const fleet = [];
  let totalCommits = 0;
  for (const s of CASE_STUDIES) {
    const rel = PROJECT_REPOS[s.slug];
    if (!rel) { console.warn(`  ! no repo mapped for ${s.slug}`); continue; }
    const repoPath = path.join(KDEV, rel);
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      console.warn(`  ! not a repo: ${repoPath}`);
      continue;
    }
    const r = activeDaysByMonth(repoPath, keys);
    if (!r) continue;
    totalCommits += r.commits;
    const area = areaById[s.area];
    fleet.push({
      slug: s.slug,
      name: SHORT_NAMES[s.slug] || s.name,
      kind: area ? area.label.replace(/s$/, '') : '',
      days: r.series,
    });
    console.log(`  ${s.slug.padEnd(34)} ${r.series.join(',')}  (${r.commits} commits)`);
  }

  if (!fleet.length) {
    console.error('No fleet data produced — refusing to write a stats file with nothing in it.');
    process.exit(1);
  }

  /* Trim leading months in which the WHOLE fleet was idle. This is not
     cherry-picking a flattering window: it is starting the chart where the
     fleet starts. These systems are younger than twelve months, so a fixed
     twelve-month axis is half empty and reads as "nothing happened" rather
     than "did not exist yet". The rendered caption always states the range it
     is showing, so the window is checkable either way. */
  let firstActive = 0;
  while (firstActive < keys.length - 1 && fleet.every((f) => f.days[firstActive] === 0)) firstActive++;
  if (firstActive > 0) {
    console.log(`  (trimmed ${firstActive} leading month(s) with no activity anywhere in the fleet)`);
    keys.splice(0, firstActive);
    for (const f of fleet) f.days = f.days.slice(firstActive);
  }

  /* The typical band, derived rather than claimed. Months with no activity are
     excluded: a quiet month is real, but "0–8 days" reads as a range of effort
     when it is actually a gap. */
  const active = fleet.flatMap((f) => f.days).filter((d) => d > 0).sort((a, b) => a - b);
  const q = (p) => active[Math.min(active.length - 1, Math.floor(active.length * p))];
  const typical = { low: q(0.25), high: q(0.75) };

  /* Coolify. On failure keep whatever the last successful run wrote rather
     than publishing a wrong number or a zero. */
  const prevPath = path.join(ROOT, 'content', 'stats.js');
  let live = null;
  if (!noRemote) {
    const token = process.env.COOLIFY_TOKEN;
    if (!token) {
      console.warn('  ! COOLIFY_TOKEN not set — reusing previous live-systems data');
    } else {
      try {
        live = await liveApps(token);
        console.log(`  Coolify: ${live.running} production apps running (of ${live.total} total)`);
      } catch (e) {
        console.warn(`  ! Coolify: ${e.message} — reusing previous live-systems data`);
      }
    }
  }
  if (!live) {
    if (!fs.existsSync(prevPath)) {
      console.error('No Coolify data and no previous stats.js to fall back on.');
      process.exit(1);
    }
    live = require(prevPath).LIVE;
    console.log(`  Coolify: reused ${live.running} from previous run`);
  }

  const stores = storeApps();

  const band = [
    { value: String(live.running), label: 'systems running right now', note: 'Production apps on infrastructure we operate ourselves.' },
    { value: String(stores.length), label: 'apps in the App Store & Play', note: 'Shipped, reviewed, and updated over the air.' },
    { value: totalCommits.toLocaleString('en-US'), label: 'commits in the last 12 months', note: 'Across the six systems on the board below.' },
    { value: '1', label: 'team, end to end', note: 'Architecture, build, deploy and the 3am page.' },
  ];

  const generatedAt = today.toISOString().slice(0, 10);
  const out = `/* ============================================================================
   GENERATED FILE. Do not edit by hand.

   Written by scripts/refresh-stats.js on ${generatedAt}.
   Sources: git history of each project repo, and the Coolify API on
   admin.kaymen.dev. Re-run after any month rolls over, or after a system
   joins or leaves the fleet:

     COOLIFY_TOKEN=... node scripts/refresh-stats.js
   ============================================================================ */

const GENERATED_AT = ${JSON.stringify(generatedAt)};

/** Month buckets for the sparklines, oldest first. */
const MONTHS = ${JSON.stringify(keys)};

/** Active days per month per system: distinct days carrying at least one commit. */
const FLEET = ${JSON.stringify(fleet, null, 2)};

/** Where most months actually land, as an interquartile range of active months. */
const TYPICAL = ${JSON.stringify(typical)};

/** Production (non-staging) applications running on our Coolify. */
const LIVE = ${JSON.stringify(live, null, 2)};

/** Apps published to the App Store / Google Play, per the content model. */
const STORE_APPS = ${JSON.stringify(stores, null, 2)};

/** The four figures in the stats band. */
const BAND = ${JSON.stringify(band, null, 2)};

module.exports = { GENERATED_AT, MONTHS, FLEET, TYPICAL, LIVE, STORE_APPS, BAND };
`;

  fs.writeFileSync(prevPath, out);
  console.log(`\nWrote content/stats.js — ${fleet.length} systems, ${live.running} live, typical ${typical.low}–${typical.high} days/mo`);
})();
