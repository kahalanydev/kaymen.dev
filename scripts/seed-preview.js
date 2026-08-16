#!/usr/bin/env node
/**
 * seed-preview.js — a throwaway, fully-seeded admin + portal to look at.
 *
 * `--screenshot` cannot log in, so reviewing the back office needs a real server
 * holding real rows. HANDOFF-BACKOFFICE-2026-08-16.md §5 described that recipe in
 * prose and said not to re-derive it; this is the recipe, executed.
 *
 *   node scripts/seed-preview.js            boot, seed, print the preview URL
 *   node scripts/seed-preview.js --keep     reuse an existing data dir
 *
 * It boots server/index.js against a temp DATA_DIR, so production data is never
 * touched, and it drops admin/_preview.html + portal/_preview.html — token-planting
 * redirects that get you past the login screen. Both are gitignored, and both are
 * removed when you stop the script with Ctrl-C.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PREVIEW_PORT || 8099);
/* Not '/tmp' — in Node on Windows that resolves to C:\tmp — and not os.tmpdir(),
   which follows whatever TEMP the parent process happened to set. A sibling of
   data/ is predictable, obviously throwaway, and gitignored. */
const DATA_DIR = process.env.PREVIEW_DATA_DIR || path.join(ROOT, '.preview-data');
const BASE = `http://localhost:${PORT}`;
const PREVIEW_FILES = [
  path.join(ROOT, 'admin', '_preview.html'),
  path.join(ROOT, 'portal', '_preview.html'),
];

const keep = process.argv.includes('--keep');
if (!keep && fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });

let server;
let stopping = false;

function cleanup() {
  if (stopping) return;
  stopping = true;
  for (const f of PREVIEW_FILES) { try { fs.unlinkSync(f); } catch {} }
  if (server) server.kill();
}
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);

// ---------------------------------------------------------------- tiny API client
let token = null;
async function call(method, url, body, asToken) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(asToken || token ? { Authorization: `Bearer ${asToken || token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${url} → ${res.status} ${json.error || ''}`);
  }
  return json.data;
}
const get = (u, t) => call('GET', u, undefined, t);
const post = (u, b, t) => call('POST', u, b, t);
const patch = (u, b, t) => call('PATCH', u, b, t);

// ------------------------------------------------------------------------- boot
function boot() {
  return new Promise((resolve, reject) => {
    let log = '';
    let password = null;
    server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
      cwd: ROOT,
      env: { ...process.env, DATA_DIR, PORT: String(PORT), NODE_ENV: 'development' },
    });
    server.stdout.on('data', (chunk) => {
      log += chunk;
      const m = log.match(/Password:\s+(\S+)/);
      if (m) password = m[1];
      if (/Server running on port/.test(log)) resolve(password);
    });
    server.stderr.on('data', (c) => process.stderr.write(c));
    server.on('exit', (code) => { if (!stopping) reject(new Error(`server exited (${code})\n${log}`)); });
    setTimeout(() => reject(new Error('server did not start in 20s\n' + log)), 20000);
  });
}

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

// ------------------------------------------------------------------------- seed
async function seed(bootPassword) {
  const ADMIN_EMAIL = 'ohavkahalany@gmail.com';
  const ADMIN_PASSWORD = 'PreviewOnly!2026';

  if (bootPassword) {
    const login = await post('/api/auth/login', { email: ADMIN_EMAIL, password: bootPassword });
    token = login.token;
    await post('/api/auth/change-password', { current_password: bootPassword, new_password: ADMIN_PASSWORD });
    const again = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    token = again.token;
  } else {
    const login = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    token = login.token;
  }

  const existing = await get('/api/admin/projects');
  if (existing.projects.length) {
    console.log(`  reusing ${existing.projects.length} seeded projects`);
    return { adminToken: token, clientToken: null };
  }

  /* The fixtures are the mockup's, so the console can be compared against the panel
     it was designed from — including the overdue milestone and the urgent ticket,
     which are the only two things on screen that exercise --alert. */
  const orgs = {};
  for (const [key, name, email] of [
    ['pcg', 'Passaic Clifton Gemach', 'gabbai@pcg.example'],
    ['cis', 'CIS', 'ops@cis.example'],
    ['bridge', 'BridgeMortgage', 'hello@bridge.example'],
    ['olami', 'OLAMI · Thrive', 'campus@olami.example'],
    ['harmony', 'Horse & Harmony', 'book@harmony.example'],
  ]) {
    orgs[key] = (await post('/api/admin/clients', { name, primary_email: email })).organization.id;
  }

  const spec = [
    { key: 'ledger', org: 'pcg', name: 'Community lending ledger', status: 'in_progress',
      description: 'Loan ledger, guarantor records and per-lender statements',
      tech: ['PHP', 'MySQL', 'Coolify'], live: 'https://pcg.kaymen.dev', start: day(-75), target: day(-4),
      milestones: [
        ['Loan ledger & borrower records', 'completed', day(-59)],
        ['Drive contract sync + guarantor backfill', 'completed', day(-38)],
        ['Fund basis correction', 'completed', day(-1)],
        ['Per-lender statements', 'in_progress', day(-4)],
        ['Admin handover & training', 'upcoming', day(13)],
      ],
      tickets: [
        ['Lender statement shows pre-correction total', 'bug', 'urgent'],
        ['Can we export the statement as PDF?', 'question', 'low'],
        ['Guarantor name blank on 6 older contracts', 'bug', 'high'],
        ['Round repayment schedule to the nearest dollar', 'modification', 'low'],
      ] },
    /* A second PCG project, proposed. The portal is org-scoped, so a client only
       ever sees their own org's work — without this, the preview client has no
       plan awaiting approval and the "yours to do" hero card never appears. */
    { key: 'donor', org: 'pcg', name: 'Donor statement portal', status: 'proposed',
      description: 'Annual giving statements donors can pull themselves',
      tech: ['PHP', 'MySQL'], propose: true, milestones: [], tickets: [] },
    { key: 'msp', org: 'cis', name: 'MSP time-compliance portal', status: 'in_progress',
      description: 'Technician time capture with compliance sign-off',
      tech: ['Node.js', 'SQLite'], start: day(-120), target: day(21),
      milestones: [
        ['Time capture', 'completed', day(-90)],
        ['Compliance rules engine', 'completed', day(-40)],
        ['Sign-off workflow', 'in_progress', day(18)],
      ],
      tickets: [['Weekly export drops the last row', 'bug', 'medium']] },
    // proposed on purpose: a plan sent, not yet approved, so the dashboard's
    // pending-approval row and the plan meta's "awaiting" branch both have a case
    { key: 'mortgage', org: 'bridge', name: 'Mortgage client portal', status: 'proposed',
      description: 'Document collection and status tracking for borrowers',
      tech: ['React', 'Postgres'], propose: true, milestones: [], tickets: [] },
    { key: 'campus', org: 'olami', name: 'Multi-campus engagement', status: 'maintenance',
      description: 'Check-ins and engagement reporting across campuses',
      tech: ['Node.js', 'SQLite'], live: 'https://olami.example', start: day(-400), target: day(-120),
      milestones: [['Rollout', 'completed', day(-140)]],
      tickets: [['Add a Hebrew date column', 'feature', 'low']] },
    { key: 'booking', org: 'harmony', name: 'Bilingual booking platform', status: 'maintenance',
      description: 'Lesson booking in English and Hebrew',
      tech: ['WordPress', 'PHP'], live: 'https://harmony.example', start: day(-300), target: day(-90),
      milestones: [['Launch', 'completed', day(-95)]],
      tickets: [['Timezone off by an hour after DST', 'bug', 'medium']] },
  ];

  /* A new client user gets an invite token, not a temp password — the only route to
     a working client login is to accept the invite, which is what a real one does
     too. The token comes back whole in invite_url; it is the users *list* that
     truncates it, which is what §5 of the handoff ran into.
     One client per org, because tickets are org-scoped and a PCG client filing
     against CIS gets a 404, exactly as it should. */
  const CLIENTS = {
    pcg: ['Yitzchok Berger', 'client@pcg.example'],
    cis: ['Dana Feldman', 'client@cis.example'],
    bridge: ['Aviva Roth', 'client@bridge.example'],
    olami: ['Ari Weiss', 'client@olami.example'],
    harmony: ['Noa Bar', 'client@harmony.example'],
  };
  const clientTokens = {};
  for (const [orgKey, [name, email]] of Object.entries(CLIENTS)) {
    const invite = await post(`/api/admin/clients/${orgs[orgKey]}/users`, { name, email });
    const inviteToken = (invite.invite_url || '').split('/invite/')[1];
    if (inviteToken) {
      clientTokens[orgKey] = (await post(`/api/auth/invite/${inviteToken}/accept`, { password: ADMIN_PASSWORD })).token;
    }
  }
  const clientToken = clientTokens.pcg || null;

  const planFor = (p, note) =>
    `# ${p.name}\n\n${p.description}\n\n## Scope\n\n${(p.milestones.length ? p.milestones.map(m => `- ${m[0]}`) : ['- To be scoped']).join('\n')}\n\n## Notes\n\n${note}\n`;

  const made = {};
  for (const p of spec) {
    const project = (await post('/api/admin/projects', {
      org_id: orgs[p.org], name: p.name, description: p.description,
      tech_stack: p.tech, target_date: p.target || null,
    })).project;
    made[p.key] = project.id;

    // two saves so the version history has something in it
    await post(`/api/admin/projects/${project.id}/plan`, { content: planFor(p, 'Fixtures from scripts/seed-preview.js. Not a real plan.') });
    await post(`/api/admin/projects/${project.id}/plan`, { content: planFor(p, 'Second revision, so plan history is not empty.') });

    /* Approval has to come from the client over the portal API, because that is the
       only thing that writes project_plans.approved_at — and the plan meta line now
       reads that column rather than guessing from project status. */
    await post(`/api/admin/projects/${project.id}/propose`);
    if (!p.propose && clientTokens[p.org]) {
      await post(`/api/portal/projects/${project.id}/approve`, {}, clientTokens[p.org]);
    }

    await patch(`/api/admin/projects/${project.id}`, {
      status: p.status,
      start_date: p.start || null,
      live_url: p.live || null,
      repo_url: `https://github.com/kaymendev/${project.slug}`,
    });

    for (const [title, status, target_date] of p.milestones) {
      const ms = (await post(`/api/admin/projects/${project.id}/milestones`, { title, target_date })).milestone;
      if (status !== 'upcoming') await patch(`/api/admin/milestones/${ms.id}`, { status });
    }
  }

  // put everybody on their own project, so the member chips have something to hold
  const allUsers = (await get('/api/auth/users')).users;
  for (const p of spec) {
    const [, email] = CLIENTS[p.org] || [];
    for (const who of [ADMIN_EMAIL, email]) {
      const u = allUsers.find(x => x.email === who);
      if (!u) continue;
      try { await post(`/api/admin/projects/${made[p.key]}/members`, { user_id: u.id }); } catch {}
    }
  }

  // tickets are filed by the client, which is the only way the portal creates them
  {
    for (const p of spec) {
      const as = clientTokens[p.org];
      if (!as) continue;
      for (const [title, type, priority] of p.tickets) {
        await post(`/api/portal/projects/${made[p.key]}/tickets`, {
          title, type,
          priority: priority === 'urgent' ? 'high' : priority,   // clients cannot file urgent
          description: 'Seeded by scripts/seed-preview.js so the console has rows to move.',
        }, as);
      }
    }
    // one urgent, raised the way a real one is: by the admin, after triage
    const pcgTickets = (await get(`/api/admin/projects/${made.ledger}/tickets`)).tickets;
    const worst = pcgTickets.find(t => /pre-correction/.test(t.title));
    if (worst) await patch(`/api/admin/tickets/${worst.id}`, { priority: 'urgent' });
    const answered = pcgTickets.find(t => /PDF/.test(t.title));
    if (answered) await patch(`/api/admin/tickets/${answered.id}`, { status: 'review' });
    const closed = pcgTickets.find(t => /nearest dollar/.test(t.title));
    if (closed) await patch(`/api/admin/tickets/${closed.id}`, { status: 'closed' });
  }

  /* One lead, not several: POST /api/contact is rate-limited to 1/min per IP and
     that limit is in-memory, so there is no way to seed past it over HTTP. Not
     worth weakening a real defence to make a preview look busier. */
  try {
    await post('/api/contact', {
      name: 'Dov Kaplan', email: 'dov@example.com', project_name: 'Shul membership portal',
      message: 'We need members to update their own details and pay dues online.',
      _hp: '', _t: 9000,
    });
  } catch (err) {
    console.log(`  (skipped contact lead: ${err.message})`);
  }

  return { adminToken: token, clientToken };
}

// --------------------------------------------------------------------- preview
function writePreview(file, storageKey, tokenValue, target) {
  fs.writeFileSync(file, `<!doctype html>
<meta charset="utf-8">
<title>preview</title>
<!-- written by scripts/seed-preview.js; deleted when that script stops -->
<script>
  localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(tokenValue)});
  location.replace(${JSON.stringify(target)});
</script>
`);
}

(async () => {
  console.log(`\n  data dir  ${DATA_DIR}`);
  const bootPassword = await boot();
  console.log(`  server    ${BASE}`);

  const { adminToken, clientToken } = await seed(bootPassword);

  writePreview(PREVIEW_FILES[0], 'admin_token', adminToken, '/admin/#/projects');
  if (clientToken) writePreview(PREVIEW_FILES[1], 'portal_token', clientToken, '/portal/#/dashboard');

  console.log('\n  Open, already logged in:');
  console.log(`    admin   ${BASE}/admin/_preview.html`);
  if (clientToken) console.log(`    portal  ${BASE}/portal/_preview.html`);
  console.log('\n  Or log in as:');
  console.log('    ohavkahalany@gmail.com / PreviewOnly!2026');
  if (clientToken) console.log('    client@pcg.example     / PreviewOnly!2026');
  console.log('\n  Ctrl-C stops the server and removes both _preview.html files.\n');
})().catch((err) => {
  console.error('\n  seed failed:', err.message, '\n');
  cleanup();
  process.exit(1);
});
