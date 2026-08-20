#!/usr/bin/env node
/**
 * load-clients.js — put real clients into the back office, idempotently.
 *
 * THE CLIENT LIST IS NOT IN THIS FILE AND MUST NEVER BE. This repository is
 * public (github.com/kahalanydev/kaymen.dev), so client names, contact
 * addresses and commercial notes live in data/clients.json, which the existing
 * `data/` line in .gitignore already covers. This script is the generic loader;
 * the file it reads is the private half, and the split is the whole point.
 *
 *   ADMIN_PASSWORD=... node scripts/load-clients.js https://kaymen.dev
 *   ADMIN_PASSWORD=... node scripts/load-clients.js --dry-run
 *
 * Safe to run twice, and that matters more than it sounds. Organisations match
 * on name, projects on name within their organisation, milestones on title
 * within their project, so a second run reports "exists" and writes nothing.
 * The failure mode of a careless loader pointed at production is a duplicate
 * client, and nothing in the admin UI merges two of those back together.
 *
 * It goes through the same HTTP API the admin panel uses rather than touching
 * the database, so it cannot create a row the UI is unable to display, and
 * every write lands in activity_log attributed to the account that ran it.
 *
 * Delivery records only - no agreements, charges or invoices. The money layer
 * is HANDOFF-BACKEND-MONEY-2026-08-20.md §2, it does not exist yet, and this
 * deliberately does not pre-empt its shape.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const BASE = (args.find((a) => /^https?:\/\//.test(a)) || 'http://localhost:8080').replace(/\/$/, '');
const FILE = (() => {
  const i = args.indexOf('--file');
  return path.resolve(ROOT, i !== -1 && args[i + 1] ? args[i + 1] : path.join('data', 'clients.json'));
})();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ohavkahalany@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const PROJECT_STATUSES = ['planning', 'proposed', 'approved', 'in_progress', 'review', 'maintenance', 'completed'];
const MILESTONE_STATUSES = ['upcoming', 'in_progress', 'completed'];

// ------------------------------------------------------------------ tiny client
let token = null;

async function call(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${url} -> ${res.status} ${json.error || res.statusText}`);
  }
  return json.data;
}
const get = (u) => call('GET', u);
const post = (u, b) => call('POST', u, b);
const patch = (u, b) => call('PATCH', u, b);

// ------------------------------------------------------------------ validation
/* Checked before a single write goes out, because a file that is half valid
   would otherwise load half a client and leave the rest to a second run that
   now has to reconcile. Cheap to check, expensive to unpick. */
function validate(clients) {
  const problems = [];
  const seenOrg = new Set();

  clients.forEach((org, i) => {
    const where = `clients[${i}]`;
    if (!org.name) problems.push(`${where}.name is required`);
    if (!org.primary_email) problems.push(`${where}.primary_email is required (organizations.primary_email is NOT NULL)`);
    if (org.name && seenOrg.has(org.name)) problems.push(`${where}.name "${org.name}" appears twice in the file`);
    if (org.name) seenOrg.add(org.name);

    const seenProject = new Set();
    (org.projects || []).forEach((p, j) => {
      const pw = `${where}.projects[${j}]`;
      if (!p.name) problems.push(`${pw}.name is required`);
      if (p.name && seenProject.has(p.name)) problems.push(`${pw}.name "${p.name}" appears twice under ${org.name}`);
      if (p.name) seenProject.add(p.name);
      if (p.status && !PROJECT_STATUSES.includes(p.status)) {
        problems.push(`${pw}.status "${p.status}" is not one of ${PROJECT_STATUSES.join(', ')}`);
      }
      (p.milestones || []).forEach((m, k) => {
        if (!m.title) problems.push(`${pw}.milestones[${k}].title is required`);
        if (m.status && !MILESTONE_STATUSES.includes(m.status)) {
          problems.push(`${pw}.milestones[${k}].status "${m.status}" is not one of ${MILESTONE_STATUSES.join(', ')}`);
        }
      });
    });
  });

  return problems;
}

// ------------------------------------------------------------------------ load
async function loadOrg(spec, existingOrgs, existingProjects, counts) {
  let org = existingOrgs.find((o) => o.name === spec.name);

  if (org) {
    console.log(`  = ${spec.name}  (exists)`);
    counts.orgsKept++;
  } else if (DRY) {
    console.log(`  + ${spec.name}  (would create)`);
    counts.orgsMade++;
    org = { id: null };
  } else {
    org = (await post('/api/admin/clients', {
      name: spec.name,
      primary_email: spec.primary_email,
      notes: spec.notes || null,
    })).organization;
    console.log(`  + ${spec.name}`);
    counts.orgsMade++;
  }

  for (const p of spec.projects || []) {
    await loadProject(p, org, existingProjects, counts);
  }
}

async function loadProject(spec, org, existingProjects, counts) {
  const existing = existingProjects.find((p) => p.name === spec.name && p.org_id === org.id);

  if (existing) {
    console.log(`      = ${spec.name}  (exists)`);
    counts.projectsKept++;
    await loadMilestones(spec, existing.id, counts);
    return;
  }

  if (DRY) {
    console.log(`      + ${spec.name}  (would create, ${(spec.milestones || []).length} milestones)`);
    counts.projectsMade++;
    counts.milestonesMade += (spec.milestones || []).length;
    return;
  }

  const project = (await post('/api/admin/projects', {
    org_id: org.id,
    name: spec.name,
    description: spec.description || null,
    tech_stack: spec.tech_stack || null,
    target_date: spec.target_date || null,
  })).project;

  /* Everything below is a second call because POST /projects deliberately takes
     only the fields a project needs to exist. Status in particular cannot be
     set on create - a new project is always 'planning', which is right for work
     being scoped and wrong for a system that has been live for a year. */
  const later = {};
  for (const f of ['status', 'live_url', 'repo_url', 'start_date']) {
    if (spec[f] !== undefined && spec[f] !== null) later[f] = spec[f];
  }
  if (Object.keys(later).length) await patch(`/api/admin/projects/${project.id}`, later);

  console.log(`      + ${spec.name}`);
  counts.projectsMade++;
  await loadMilestones(spec, project.id, counts);
}

async function loadMilestones(spec, projectId, counts) {
  const wanted = spec.milestones || [];
  if (!wanted.length) return;

  const have = DRY ? [] : (await get(`/api/admin/projects/${projectId}`)).milestones;

  for (const m of wanted) {
    if (have.some((h) => h.title === m.title)) {
      counts.milestonesKept++;
      continue;
    }
    if (DRY) {
      counts.milestonesMade++;
      continue;
    }

    const made = (await post(`/api/admin/projects/${projectId}/milestones`, {
      title: m.title,
      description: m.description || null,
      target_date: m.target_date || null,
    })).milestone;

    /* Milestones are born 'upcoming'. Setting the status is also what
       recalculates projects.progress_percent, so a delivered system reads 100%
       rather than 0% with every box ticked. */
    if (m.status && m.status !== 'upcoming') {
      await patch(`/api/admin/milestones/${made.id}`, { status: m.status });
    }
    counts.milestonesMade++;
  }
  console.log(`        ${wanted.length} milestones`);
}

// ------------------------------------------------------------------------ main
(async () => {
  if (!fs.existsSync(FILE)) {
    throw new Error(`No client file at ${FILE}. It is gitignored on purpose - see the header of this script.`);
  }

  const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const clients = Array.isArray(parsed) ? parsed : parsed.clients;
  if (!Array.isArray(clients)) throw new Error(`${FILE} must be an array, or an object with a "clients" array.`);

  const problems = validate(clients);
  if (problems.length) {
    console.error(`\n${FILE} is not loadable:\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is not set.');

  console.log(`\n  ${DRY ? 'DRY RUN against' : 'Loading into'} ${BASE}`);
  console.log(`  from ${path.relative(ROOT, FILE)}\n`);

  token = (await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).token;

  const existingOrgs = (await get('/api/admin/clients')).organizations;
  const existingProjects = (await get('/api/admin/projects')).projects;

  const counts = { orgsMade: 0, orgsKept: 0, projectsMade: 0, projectsKept: 0, milestonesMade: 0, milestonesKept: 0 };
  for (const org of clients) {
    await loadOrg(org, existingOrgs, existingProjects, counts);
  }

  console.log(`\n  organisations  ${counts.orgsMade} created, ${counts.orgsKept} already there`);
  console.log(`  projects       ${counts.projectsMade} created, ${counts.projectsKept} already there`);
  console.log(`  milestones     ${counts.milestonesMade} created, ${counts.milestonesKept} already there`);

  /* Named rather than silent: a placeholder address is the one field here that
     is knowingly wrong, and it is invisible in the admin list view. */
  const placeholders = clients.filter((c) => /\.invalid$/i.test(c.primary_email || ''));
  if (placeholders.length) {
    console.log(`\n  ${placeholders.length} organisation(s) still carry a placeholder .invalid contact address:`);
    for (const c of placeholders) console.log(`    ${c.name}  ${c.primary_email}`);
    console.log('  Set the real one in /admin before inviting anybody to the portal.');
  }

  console.log('');
})().catch((e) => {
  console.error(`\nFAILED: ${e.message}\n`);
  process.exitCode = 1;
});
