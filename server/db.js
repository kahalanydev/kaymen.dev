const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'analytics.db');

let wrapper = null;
let saveTimer = null;

// Wrapper that provides better-sqlite3-like API over sql.js
class DbWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
  }

  exec(sql) {
    this._db.run(sql);
  }

  prepare(sql) {
    const db = this._db;
    return {
      run(...params) {
        db.run(sql, params);
        const idRow = db.exec('SELECT last_insert_rowid() as id');
        const chRow = db.exec('SELECT changes() as c');
        const lastInsertRowid = idRow.length ? idRow[0].values[0][0] : 0;
        const changes = chRow.length ? chRow[0].values[0][0] : 0;
        scheduleSave();
        return { lastInsertRowid, changes };
      },
      get(...params) {
        let stmt;
        try {
          stmt = db.prepare(sql);
          if (params.length) stmt.bind(params);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          if (stmt) stmt.free();
        }
      },
      all(...params) {
        let stmt;
        try {
          stmt = db.prepare(sql);
          if (params.length) stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          if (stmt) stmt.free();
        }
      }
    };
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveToDisk();
    saveTimer = null;
  }, 1000);
}

function saveToDisk() {
  if (!wrapper) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = wrapper._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Failed to save database:', e.message);
  }
}

// Must be called once at startup (async)
async function initDb() {
  if (wrapper) return wrapper;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    wrapper = new DbWrapper(new SQL.Database(buffer));
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    wrapper = new DbWrapper(new SQL.Database());
  }

  initSchema();
  saveToDisk();

  // Save to disk periodically and on exit
  setInterval(saveToDisk, 30000);
  process.on('exit', saveToDisk);
  process.on('SIGINT', () => { saveToDisk(); process.exit(); });
  process.on('SIGTERM', () => { saveToDisk(); process.exit(); });

  return wrapper;
}

function getDb() {
  if (!wrapper) throw new Error('Database not initialized. Call initDb() first.');
  return wrapper;
}

function initSchema() {
  const db = wrapper._db;
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      must_change_password INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      referrer TEXT,
      country TEXT,
      city TEXT,
      region TEXT,
      device_type TEXT,
      browser TEXT,
      os TEXT,
      screen_width INTEGER,
      screen_height INTEGER,
      language TEXT,
      is_bot INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      target TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS suspicious_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      reason TEXT NOT NULL,
      severity TEXT DEFAULT 'low',
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS geo_cache (
      ip TEXT PRIMARY KEY,
      country TEXT,
      city TEXT,
      region TEXT,
      lat REAL,
      lon REAL,
      isp TEXT,
      cached_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);');
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_visit ON events(visit_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_suspicious_created ON suspicious_activity(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_suspicious_ip ON suspicious_activity(ip);');

  // ===== SECURITY & TRACKING CENTER (2026-08-17) =====================
  //
  // Four tables and a pile of columns. Two of the tables exist only so the raw
  // ones can be DELETED: `traffic_daily` and `dimension_daily` are permanent
  // aggregates, and `server/utils/rollup.js` prunes raw visits/events/pageviews
  // behind them. That is the answer to the concern raised in
  // HANDOFF-BACKOFFICE-2026-08-16.md §6 — this whole database is held in memory
  // and rewritten to disk on every debounce, so "keep a year of 30-second
  // heartbeats" was never going to hold. Long-run statistics live in the
  // rollups; the raw rows are a 90-day working set.

  // One row per page view inside a visit. `visits` only ever recorded the
  // session, so the panel could say how many people came and never which pages
  // they read — the tracker was already POSTing `path` and nothing stored it.
  db.run(`
    CREATE TABLE IF NOT EXISTS pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER,
      session_id TEXT NOT NULL,
      path TEXT NOT NULL,
      title TEXT,
      referrer TEXT,
      duration_seconds INTEGER DEFAULT 0,
      active_seconds INTEGER DEFAULT 0,
      max_scroll INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Permanent. Never pruned. One row per day.
  db.run(`
    CREATE TABLE IF NOT EXISTS traffic_daily (
      date TEXT PRIMARY KEY,
      visits INTEGER DEFAULT 0,
      visitors INTEGER DEFAULT 0,
      new_visitors INTEGER DEFAULT 0,
      pageviews INTEGER DEFAULT 0,
      bot_visits INTEGER DEFAULT 0,
      bounces INTEGER DEFAULT 0,
      avg_scroll INTEGER DEFAULT 0,
      avg_duration INTEGER DEFAULT 0,
      threats INTEGER DEFAULT 0,
      blocked INTEGER DEFAULT 0,
      rolled_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Permanent too — the long-run breakdowns. `kind` is the axis (device,
  // browser, os, country, referrer, path, language, viewport, bot), `key` is
  // the value. One generic table rather than nine, because every one of them
  // is the same shape and the UI asks for them the same way.
  db.run(`
    CREATE TABLE IF NOT EXISTS dimension_daily (
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      key TEXT NOT NULL,
      visits INTEGER DEFAULT 0,
      PRIMARY KEY (date, kind, key)
    );
  `);

  // Firewall rules. `action` is block or allow, and allow exists for a specific
  // failure mode: auto-blocking cannot be allowed to lock the only admin out of
  // production. A successful admin/staff login writes a rolling allow rule for
  // that IP, and the shield checks allow before block.
  db.run(`
    CREATE TABLE IF NOT EXISTS ip_rules (
      ip TEXT PRIMARY KEY,
      action TEXT NOT NULL DEFAULT 'block',
      reason TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      severity TEXT DEFAULT 'high',
      hits INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      expires_at TEXT,
      last_hit_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Who tried to get in, from where, and whether it worked. `users` has carried
  // login_attempts and locked_until since the portal was built and nothing ever
  // read them; the lockout is real now and this is its audit trail.
  db.run(`
    CREATE TABLE IF NOT EXISTS auth_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      email TEXT,
      event TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_pageviews_session ON pageviews(session_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_pageviews_created ON pageviews(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_pageviews_path ON pageviews(path);');
  db.run('CREATE INDEX IF NOT EXISTS idx_dimension_daily_kind ON dimension_daily(kind, date);');
  db.run('CREATE INDEX IF NOT EXISTS idx_ip_rules_action ON ip_rules(action);');
  db.run('CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_auth_events_email ON auth_events(email);');
  db.run('CREATE INDEX IF NOT EXISTS idx_auth_events_ip ON auth_events(ip);');

  // Contact form submissions
  db.run(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      project_name TEXT,
      ip TEXT,
      converted_at TEXT,
      converted_org_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate: add columns that may be missing on older DBs
  const safeAlter = (sql) => { try { db.run(sql); } catch(e) {} };
  safeAlter('ALTER TABLE contact_submissions ADD COLUMN project_name TEXT');
  safeAlter('ALTER TABLE contact_submissions ADD COLUMN converted_at TEXT');
  safeAlter('ALTER TABLE contact_submissions ADD COLUMN converted_org_id TEXT');

  db.run(`
    CREATE TABLE IF NOT EXISTS contact_dismissals (
      contact_id INTEGER PRIMARY KEY REFERENCES contact_submissions(id),
      dismissed_by INTEGER REFERENCES users(id),
      dismissed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ===== PORTAL TABLES =====

  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_path TEXT,
      primary_email TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planning',
      progress_percent INTEGER DEFAULT 0,
      tech_stack TEXT,
      repo_url TEXT,
      live_url TEXT,
      coolify_uuid TEXT,
      start_date TEXT,
      target_date TEXT,
      completed_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'member',
      added_by INTEGER,
      added_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      sort_order INTEGER NOT NULL DEFAULT 0,
      target_date TEXT,
      completed_date TEXT,
      completion_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      ticket_number INTEGER NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'task',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) UNIQUE,
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      approved_at TEXT,
      approved_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dev_keys (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL UNIQUE,
      secret TEXT NOT NULL,
      label TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      device_info TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Portal indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);');
  db.run('CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);');
  db.run('CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);');

  // Extend users table for portal (safe: no-op if columns already exist)
  safeAlter('ALTER TABLE users ADD COLUMN org_id TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE users ADD COLUMN locked_until TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN last_login_at TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN google_id TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN invite_token TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN invite_expires_at TEXT');
  safeAlter('ALTER TABLE projects ADD COLUMN scaffolded_at TEXT');
  safeAlter('ALTER TABLE project_members ADD COLUMN added_by INTEGER');

  // --- Security & tracking centre: columns on the tables that already existed.
  // All additive, all nullable or defaulted, so an existing analytics.db keeps
  // every row it has and simply starts recording more from the next visit.
  //
  // `visits` gains the landing path (the tracker always sent it and nothing
  // stored it), the shape of the screen it was read on, and the two engagement
  // figures that used to live only inside an `events` JSON blob — which meant
  // pruning events would have destroyed them.
  safeAlter('ALTER TABLE visits ADD COLUMN path TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN visitor_id TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN is_returning INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE visits ADD COLUMN viewport_width INTEGER');
  safeAlter('ALTER TABLE visits ADD COLUMN viewport_height INTEGER');
  safeAlter('ALTER TABLE visits ADD COLUMN pixel_ratio REAL');
  safeAlter('ALTER TABLE visits ADD COLUMN timezone TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN utm_source TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN utm_medium TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN utm_campaign TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN country_code TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN asn TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN bot_kind TEXT');
  safeAlter('ALTER TABLE visits ADD COLUMN duration_seconds INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE visits ADD COLUMN active_seconds INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE visits ADD COLUMN max_scroll INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE visits ADD COLUMN pageview_count INTEGER DEFAULT 1');
  safeAlter('ALTER TABLE visits ADD COLUMN last_seen_at TEXT');

  // `suspicious_activity` was three columns and a free-text reason, which is a
  // log you can read but not query. `category` is the machine-readable one the
  // threat feed filters on; `blocked` records whether the shield actually
  // stopped the request or only watched it.
  safeAlter('ALTER TABLE suspicious_activity ADD COLUMN category TEXT');
  safeAlter('ALTER TABLE suspicious_activity ADD COLUMN path TEXT');
  safeAlter('ALTER TABLE suspicious_activity ADD COLUMN method TEXT');
  safeAlter('ALTER TABLE suspicious_activity ADD COLUMN user_agent TEXT');
  safeAlter('ALTER TABLE suspicious_activity ADD COLUMN score INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE suspicious_activity ADD COLUMN blocked INTEGER DEFAULT 0');

  // ip-api's free endpoint returns countryCode, org and `as` for nothing; the
  // ASN is what tells a datacentre scanner apart from a person on a phone.
  safeAlter('ALTER TABLE geo_cache ADD COLUMN country_code TEXT');
  safeAlter('ALTER TABLE geo_cache ADD COLUMN org TEXT');
  safeAlter('ALTER TABLE geo_cache ADD COLUMN asn TEXT');
  safeAlter('ALTER TABLE geo_cache ADD COLUMN timezone TEXT');

  db.run('CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_suspicious_category ON suspicious_activity(category);');

  // Plan version history
  db.run(`
    CREATE TABLE IF NOT EXISTS plan_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      saved_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_plan_versions_project ON plan_versions(project_id);');
}

function getJwtSecret() {
  const d = getDb();
  const row = d.prepare('SELECT value FROM config WHERE key = ?').get('jwt_secret');
  if (row) return row.value;

  const secret = crypto.randomBytes(64).toString('hex');
  d.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('jwt_secret', secret);
  return secret;
}

function seedAdmin() {
  const d = getDb();
  const count = d.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;

  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 12);

  d.prepare(
    'INSERT INTO users (email, password_hash, name, role, must_change_password) VALUES (?, ?, ?, ?, ?)'
  ).run('ohavkahalany@gmail.com', hash, 'Ohav', 'admin', 1);

  console.log('\n========================================');
  console.log('  ADMIN ACCOUNT CREATED');
  console.log('========================================');
  console.log(`  Email:    ohavkahalany@gmail.com`);
  console.log(`  Password: ${password}`);
  console.log('');
  console.log('  You MUST change this password on');
  console.log('  first login at /admin');
  console.log('========================================\n');
}

function generateId() {
  return crypto.randomUUID();
}

function logActivity(db, { projectId, userId, action, entityType, entityId, details, ip }) {
  db.prepare(`
    INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), projectId || null, userId || null, action, entityType || null, entityId || null,
    details ? JSON.stringify(details) : null, ip || null);
}

/* Append to the authentication audit trail.

   Separate from `activity_log` on purpose: activity is project history and is
   scoped to a project, whereas an auth event usually has no project and often
   no user either — a failed login against an address that does not exist is
   exactly the row a security panel most wants, and it has nothing to hang off.

   Swallows its own errors. Every call site is inside a request that has already
   decided what to do; none of them should fail because the log did. */
function logAuthEvent(db, { userId, email, event, ip, userAgent, detail }) {
  try {
    db.prepare(`
      INSERT INTO auth_events (user_id, email, event, ip, user_agent, detail)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId || null,
      email ? String(email).slice(0, 200) : null,
      event,
      ip || null,
      userAgent ? String(userAgent).slice(0, 300) : null,
      detail ? String(detail).slice(0, 400) : null
    );
  } catch (e) {
    console.error('[auth-log] failed:', e.message);
  }
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

function nextTicketNumber(db, projectId) {
  const row = db.prepare('SELECT COALESCE(MAX(ticket_number), 0) + 1 as next FROM tickets WHERE project_id = ?').get(projectId);
  return row.next;
}

module.exports = {
  initDb, getDb, getJwtSecret, seedAdmin, generateId,
  logActivity, logAuthEvent, slugify, nextTicketNumber,
  // Flush to disk synchronously. Writes are normally debounced by a second,
  // which is right for a server and wrong for a script that seeds rows and then
  // exits — the process would end before the debounce fired and the work would
  // be silently lost. Used by scripts/seed-preview.js.
  saveNow: saveToDisk,
};
