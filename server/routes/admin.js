const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb, generateId, logActivity, slugify, nextTicketNumber } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../utils/email');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin', 'staff'));

// GET /api/admin/dashboard
router.get('/dashboard', (req, res, next) => {
  try {
  const db = getDb();

  // --- Site traffic (compact) ---
  const visitors = {
    today: db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at >= datetime('now', '-1 day') AND is_bot = 0").get().c,
    week: db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at >= datetime('now', '-7 days') AND is_bot = 0").get().c,
    month: db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at >= datetime('now', '-30 days') AND is_bot = 0").get().c,
  };
  const avgTime = db.prepare(`
    SELECT AVG(CAST(json_extract(metadata, '$.timeOnPage') AS INTEGER)) as avg_time
    FROM events WHERE event_type = 'leave' AND created_at >= datetime('now', '-30 days')
      AND json_extract(metadata, '$.timeOnPage') IS NOT NULL
  `).get();
  const activeNow = db.prepare("SELECT COUNT(DISTINCT session_id) as c FROM events WHERE created_at >= datetime('now', '-5 minutes')").get().c;

  // --- Business metrics ---
  const activeProjects = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status IN ('in_progress', 'review')").get().c;
  const openTickets = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status IN ('open', 'in_progress')").get().c;
  const pendingApprovals = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'proposed'").get().c;
  const unreadContacts = db.prepare("SELECT COUNT(*) as c FROM contact_submissions WHERE id NOT IN (SELECT COALESCE(contact_id, 0) FROM contact_dismissals)").get().c;

  // --- Needs attention ---
  const urgentTickets = db.prepare(`
    SELECT t.id, t.ticket_number, t.title, t.priority, t.status, t.created_at,
           p.name as project_name, p.id as project_id
    FROM tickets t JOIN projects p ON t.project_id = p.id
    WHERE t.status IN ('open', 'in_progress') AND t.priority IN ('high', 'urgent')
    ORDER BY CASE t.priority WHEN 'urgent' THEN 0 ELSE 1 END, t.created_at ASC
    LIMIT 10
  `).all();

  const overdueMilestones = db.prepare(`
    SELECT m.id, m.title, m.target_date, p.name as project_name, p.id as project_id
    FROM milestones m JOIN projects p ON m.project_id = p.id
    WHERE m.status = 'in_progress' AND m.target_date IS NOT NULL AND m.target_date < datetime('now')
    ORDER BY m.target_date ASC
    LIMIT 10
  `).all();

  const waitingApprovals = db.prepare(`
    SELECT p.id, p.name, p.status, p.updated_at, o.name as org_name
    FROM projects p JOIN organizations o ON p.org_id = o.id
    WHERE p.status = 'proposed'
    ORDER BY p.updated_at ASC
  `).all();

  const recentContacts = db.prepare(`
    SELECT cs.id, cs.name, cs.email, cs.message, cs.project_name, cs.converted_at, cs.converted_org_id, cs.created_at
    FROM contact_submissions cs
    ORDER BY cs.created_at DESC
    LIMIT 10
  `).all();

  // --- Active projects ---
  const projects = db.prepare(`
    SELECT p.id, p.name, p.status, p.progress_percent, p.description, o.name as org_name,
      (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id AND t.status IN ('open', 'in_progress')) as open_tickets
    FROM projects p JOIN organizations o ON p.org_id = o.id
    WHERE p.status IN ('planning', 'proposed', 'approved', 'in_progress', 'review')
    ORDER BY CASE p.status WHEN 'in_progress' THEN 0 WHEN 'review' THEN 1 WHEN 'approved' THEN 2 WHEN 'proposed' THEN 3 ELSE 4 END, p.updated_at DESC
  `).all();

  // --- Recent activity (across all projects) ---
  const recentActivity = db.prepare(`
    SELECT a.action, a.entity_type, a.details, a.created_at,
           COALESCE(u.name, u.email, 'System') as user_name,
           p.name as project_name, p.id as project_id
    FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN projects p ON a.project_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 20
  `).all();

  // --- Recent visitors (slim) ---
  const recentVisitors = db.prepare(`
    SELECT ip, country, city, browser, device_type, is_bot, created_at
    FROM visits ORDER BY created_at DESC LIMIT 8
  `).all();

  res.json({
    success: true,
    data: {
      visitors, avgTimeOnSite: Math.round(avgTime.avg_time || 0), activeNow,
      activeProjects, openTickets, pendingApprovals, unreadContacts,
      urgentTickets, overdueMilestones, waitingApprovals, recentContacts,
      projects, recentActivity, recentVisitors
    }
  });
  } catch (err) { next(err); }
});

// POST /api/admin/contacts/:id/dismiss
router.post('/contacts/:id/dismiss', (req, res) => {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO contact_dismissals (contact_id, dismissed_by) VALUES (?, ?)').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// POST /api/admin/contacts/:id/convert — convert contact submission to client (org + project + portal user)
router.post('/contacts/:id/convert', (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contact_submissions WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
  if (contact.converted_at) return res.status(400).json({ success: false, error: 'Already converted' });

  const { project_name } = req.body;
  const orgName = contact.name;
  const email = contact.email.toLowerCase().trim();
  const projName = (project_name || contact.project_name || 'New Project').trim();

  // Create organization
  const orgId = generateId();
  db.prepare('INSERT INTO organizations (id, name, primary_email, notes) VALUES (?, ?, ?, ?)')
    .run(orgId, orgName, email, `Converted from contact submission #${contact.id}`);

  logActivity(db, { userId: req.user.id, action: 'org_created', entityType: 'organization', entityId: orgId,
    details: { name: orgName, source: 'contact_conversion' }, ip: req.ip });

  // Create project
  const projectId = generateId();
  let slug = slugify(projName);
  const existingSlug = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
  if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`;

  db.prepare('INSERT INTO projects (id, org_id, name, slug, description) VALUES (?, ?, ?, ?, ?)')
    .run(projectId, orgId, projName, slug, contact.message);

  logActivity(db, { projectId, userId: req.user.id, action: 'project_created', entityType: 'project', entityId: projectId,
    details: { name: projName, org_name: orgName, source: 'contact_conversion' }, ip: req.ip });

  // Create portal user with invite
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const placeholder = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 4);

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  let userId;
  if (existing) {
    userId = existing.id;
    db.prepare('UPDATE users SET org_id = ? WHERE id = ? AND org_id IS NULL').run(orgId, userId);
  } else {
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role, org_id, must_change_password, invite_token, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(email, placeholder, contact.name, 'client', orgId, 1, inviteToken, inviteExpires);
    userId = result.lastInsertRowid;
  }

  // Mark contact as converted
  const safeAlter = (sql) => { try { db._db.run(sql); } catch(e) {} };
  safeAlter('ALTER TABLE contact_submissions ADD COLUMN converted_at TEXT');
  safeAlter('ALTER TABLE contact_submissions ADD COLUMN converted_org_id TEXT');
  db.prepare("UPDATE contact_submissions SET converted_at = datetime('now'), converted_org_id = ? WHERE id = ?").run(orgId, contact.id);

  // Auto-dismiss
  db.prepare('INSERT OR IGNORE INTO contact_dismissals (contact_id, dismissed_by) VALUES (?, ?)').run(contact.id, req.user.id);

  // Send invite email
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const inviteUrl = existing ? null : `${proto}://${host}/portal#/invite/${inviteToken}`;

  if (inviteUrl) {
    try {
      const { sendWelcomeEmail } = require('../utils/email');
      sendWelcomeEmail({
        email,
        name: contact.name,
        role: 'client',
        inviteUrl,
        projectName: projName
      }).catch(() => {});
    } catch {}
  }

  res.json({
    success: true,
    data: {
      org_id: orgId,
      project_id: projectId,
      user_id: userId,
      invite_url: inviteUrl,
      message: `Created org "${orgName}", project "${projName}"${inviteUrl ? ', and sent portal invite' : ' (user already exists)'}`
    }
  });
});

// GET /api/admin/security
router.get('/security', (req, res) => {
  const db = getDb();
  const period = req.query.period || '7';
  const days = parseInt(period) || 7;

  // Suspicious activity
  const suspicious = db.prepare(`
    SELECT * FROM suspicious_activity
    WHERE created_at >= datetime('now', '-${days} days')
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  // Visitor log with geo
  const visitorLog = db.prepare(`
    SELECT v.*, g.isp
    FROM visits v
    LEFT JOIN geo_cache g ON v.ip = g.ip
    WHERE v.created_at >= datetime('now', '-${days} days')
    ORDER BY v.created_at DESC
    LIMIT 200
  `).all();

  // Bot vs human counts
  const botCount = db.prepare(`
    SELECT COUNT(*) as c FROM visits WHERE is_bot = 1 AND created_at >= datetime('now', '-${days} days')
  `).get().c;
  const humanCount = db.prepare(`
    SELECT COUNT(*) as c FROM visits WHERE is_bot = 0 AND created_at >= datetime('now', '-${days} days')
  `).get().c;

  // Top IPs
  const topIPs = db.prepare(`
    SELECT ip, country, city, COUNT(*) as count, MAX(is_bot) as is_bot
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY ip
    ORDER BY count DESC
    LIMIT 20
  `).all();

  // Suspicious IPs (those with suspicious activity entries)
  const suspiciousIPs = db.prepare(`
    SELECT ip, COUNT(*) as incidents, MAX(severity) as max_severity
    FROM suspicious_activity
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY ip
    ORDER BY incidents DESC
    LIMIT 20
  `).all();

  res.json({
    success: true,
    data: { suspicious, visitorLog, botCount, humanCount, topIPs, suspiciousIPs }
  });
});

// GET /api/admin/analytics
router.get('/analytics', (req, res) => {
  const db = getDb();
  const period = req.query.period || '30';
  const days = parseInt(period) || 30;

  // Daily visitor counts
  const dailyVisitors = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY date(created_at)
    ORDER BY date
  `).all();

  // Section engagement
  const sectionEngagement = db.prepare(`
    SELECT target, COUNT(*) as views
    FROM events
    WHERE event_type = 'section_view' AND created_at >= datetime('now', '-${days} days')
    GROUP BY target
    ORDER BY views DESC
  `).all();

  // Click events
  const clickEvents = db.prepare(`
    SELECT target, COUNT(*) as clicks
    FROM events
    WHERE event_type = 'click' AND created_at >= datetime('now', '-${days} days')
    GROUP BY target
    ORDER BY clicks DESC
    LIMIT 20
  `).all();

  // Referrer breakdown
  const referrers = db.prepare(`
    SELECT
      CASE
        WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
        ELSE referrer
      END as source,
      COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY source
    ORDER BY count DESC
    LIMIT 15
  `).all();

  // Device breakdown
  const devices = db.prepare(`
    SELECT device_type, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY device_type
    ORDER BY count DESC
  `).all();

  // Browser breakdown
  const browsers = db.prepare(`
    SELECT browser, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY browser
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // Average scroll depth
  const avgScroll = db.prepare(`
    SELECT AVG(CAST(json_extract(metadata, '$.scrollDepth') AS INTEGER)) as avg_scroll
    FROM events
    WHERE event_type = 'leave' AND created_at >= datetime('now', '-${days} days')
      AND json_extract(metadata, '$.scrollDepth') IS NOT NULL
  `).get();

  // Hourly distribution
  const hourlyDistribution = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY hour
    ORDER BY hour
  `).all();

  res.json({
    success: true,
    data: {
      dailyVisitors,
      sectionEngagement,
      clickEvents,
      referrers,
      devices,
      browsers,
      avgScrollDepth: Math.round(avgScroll.avg_scroll || 0),
      hourlyDistribution
    }
  });
});

// ===== ORGANIZATIONS =====

// GET /api/admin/clients — list all orgs
router.get('/clients', (req, res) => {
  const db = getDb();
  const orgs = db.prepare(`
    SELECT o.*, COUNT(DISTINCT p.id) as project_count,
           COUNT(DISTINCT u.id) as user_count
    FROM organizations o
    LEFT JOIN projects p ON p.org_id = o.id
    LEFT JOIN users u ON u.org_id = o.id
    GROUP BY o.id ORDER BY o.created_at DESC
  `).all();
  res.json({ success: true, data: { organizations: orgs } });
});

// POST /api/admin/clients — create org
router.post('/clients', (req, res) => {
  const { name, primary_email, notes } = req.body;
  if (!name || !primary_email) return res.status(400).json({ success: false, error: 'Name and email required' });

  const db = getDb();
  const id = generateId();
  db.prepare('INSERT INTO organizations (id, name, primary_email, notes) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), primary_email.trim().toLowerCase(), notes || null);

  logActivity(db, { userId: req.user.id, action: 'org_created', entityType: 'organization', entityId: id,
    details: { name }, ip: req.ip });

  res.json({ success: true, data: { organization: { id, name, primary_email } } });
});

// PATCH /api/admin/clients/:orgId
router.patch('/clients/:orgId', (req, res) => {
  const db = getDb();
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.orgId);
  if (!org) return res.status(404).json({ success: false, error: 'Not found' });

  const { name, primary_email, notes } = req.body;
  db.prepare('UPDATE organizations SET name = COALESCE(?, name), primary_email = COALESCE(?, primary_email), notes = COALESCE(?, notes), updated_at = datetime(\'now\') WHERE id = ?')
    .run(name || null, primary_email || null, notes !== undefined ? notes : null, org.id);

  res.json({ success: true, data: { message: 'Updated' } });
});

// POST /api/admin/clients/:orgId/users — create client user
router.post('/clients/:orgId/users', async (req, res) => {
  const db = getDb();
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.orgId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const { email, name } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const existing = db.prepare('SELECT id, role, org_id FROM users WHERE email = ?').get(email.toLowerCase().trim());

  if (existing) {
    if (existing.org_id && existing.org_id === org.id) {
      return res.status(409).json({ success: false, error: 'User already belongs to this organization' });
    }
    // User belongs to a different org — add as cross-org member to all projects in this org
    if (existing.org_id) {
      const projects = db.prepare('SELECT id FROM projects WHERE org_id = ?').all(org.id);
      let added = 0;
      for (const p of projects) {
        const already = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(p.id, existing.id);
        if (!already) {
          db.prepare('INSERT INTO project_members (id, project_id, user_id, added_by) VALUES (?, ?, ?, ?)').run(generateId(), p.id, existing.id, req.user.id);
          added++;
        }
      }
      logActivity(db, { userId: req.user.id, action: 'cross_org_member_added', entityType: 'user', entityId: String(existing.id),
        details: { email, org_name: org.name, projects_added: added }, ip: req.ip });
      return res.json({ success: true, data: { user: { id: existing.id, email, name: existing.name }, linked: true, message: `Added as cross-org member to ${added} project${added !== 1 ? 's' : ''} in ${org.name}` } });
    }
    // User exists but no org (e.g. admin/staff) — link them directly
    db.prepare('UPDATE users SET org_id = ? WHERE id = ?').run(org.id, existing.id);
    logActivity(db, { userId: req.user.id, action: 'user_linked_to_org', entityType: 'user', entityId: String(existing.id),
      details: { email, org_name: org.name, role: existing.role }, ip: req.ip });
    return res.json({ success: true, data: { user: { id: existing.id, email, name }, linked: true, message: `Existing ${existing.role} user linked to ${org.name}` } });
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  const placeholder = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 4); // unusable password

  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name, role, org_id, must_change_password, invite_token, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(email.toLowerCase().trim(), placeholder, name || null, 'client', org.id, 1, inviteToken, inviteExpires);

  logActivity(db, { userId: req.user.id, action: 'client_user_created', entityType: 'user', entityId: String(result.lastInsertRowid),
    details: { email, org_name: org.name }, ip: req.ip });

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const inviteUrl = `${proto}://${host}/portal#/invite/${inviteToken}`;
  // Awaited and reported. This is the highest-stakes one of the three: a CLIENT
  // is created with a deliberately unusable placeholder password, so if the
  // invite silently never sends, they have an account they can never enter and
  // the operator was told it went out. See the note on /reset-password.
  const emailed = await sendWelcomeEmail({ email: email.toLowerCase().trim(), name, role: 'client', inviteUrl });

  res.json({ success: true, data: { user: { id: result.lastInsertRowid, email, name }, invite_url: inviteUrl, emailed } });
});

// GET /api/admin/clients/:orgId/users — list org users + cross-org members
router.get('/clients/:orgId/users', (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT DISTINCT u.id, u.email, u.name, u.role, u.must_change_password, u.last_login_at, u.created_at,
           CASE WHEN u.org_id = ? THEN 0 ELSE 1 END as is_cross_org
    FROM users u
    LEFT JOIN project_members pm ON pm.user_id = u.id
    LEFT JOIN projects p ON p.id = pm.project_id AND p.org_id = ?
    WHERE u.org_id = ? OR p.id IS NOT NULL
    ORDER BY is_cross_org, u.created_at
  `).all(req.params.orgId, req.params.orgId, req.params.orgId);
  res.json({ success: true, data: { users } });
});

// DELETE /api/admin/clients/:orgId/users/:userId — remove client user or cross-org member
router.delete('/clients/:orgId/users/:userId', (req, res) => {
  const db = getDb();
  const userId = parseInt(req.params.userId);
  const orgId = req.params.orgId;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  if (user.org_id === orgId) {
    // Direct org member — delete user entirely
    db.prepare('DELETE FROM project_members WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    logActivity(db, { userId: req.user.id, action: 'client_user_deleted', entityType: 'user', entityId: String(user.id),
      details: { email: user.email, org_id: orgId }, ip: req.ip });
    return res.json({ success: true, data: { message: 'User removed' } });
  }

  // Cross-org member — only remove project_members for this org's projects
  const removed = db.prepare(`
    DELETE FROM project_members WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE org_id = ?)
  `).run(userId, orgId);
  if (removed.changes === 0) return res.status(404).json({ success: false, error: 'User not found in this organization' });

  logActivity(db, { userId: req.user.id, action: 'cross_org_member_removed', entityType: 'user', entityId: String(user.id),
    details: { email: user.email, org_id: orgId, projects_removed: removed.changes }, ip: req.ip });
  res.json({ success: true, data: { message: 'Cross-org access removed' } });
});

// ===== PROJECTS =====

// GET /api/admin/projects — all projects
router.get('/projects', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*, o.name as org_name,
           (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id AND t.status IN ('open','in_progress')) as open_tickets,
           (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id AND t.status IN ('open','in_progress')
                                             AND t.priority IN ('urgent','high')) as urgent_tickets,
           (SELECT MAX(created_at) FROM activity_log a WHERE a.project_id = p.id) as last_activity
    FROM projects p
    JOIN organizations o ON o.id = p.org_id
    ORDER BY p.updated_at DESC
  `).all();
  res.json({ success: true, data: { projects } });
});

// POST /api/admin/projects — create project
router.post('/projects', (req, res) => {
  const { org_id, name, description, tech_stack, target_date } = req.body;
  if (!org_id || !name) return res.status(400).json({ success: false, error: 'Organization and name required' });

  const db = getDb();
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(org_id);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const id = generateId();
  let slug = slugify(name);
  // Ensure unique slug
  const existingSlug = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
  if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`;

  db.prepare(`
    INSERT INTO projects (id, org_id, name, slug, description, tech_stack, target_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, org_id, name.trim(), slug, description || null, tech_stack ? JSON.stringify(tech_stack) : null, target_date || null);

  logActivity(db, { projectId: id, userId: req.user.id, action: 'project_created', entityType: 'project', entityId: id,
    details: { name, org_name: org.name }, ip: req.ip });

  res.json({ success: true, data: { project: { id, slug, name, status: 'planning' } } });
});

// GET /api/admin/projects/:projectId — full project detail
router.get('/projects/:projectId', (req, res) => {
  const db = getDb();
  const project = db.prepare(`
    SELECT p.*, o.name as org_name, o.primary_email as org_email
    FROM projects p JOIN organizations o ON o.id = p.org_id
    WHERE p.id = ?
  `).get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });

  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order').all(project.id);
  const plan = db.prepare('SELECT * FROM project_plans WHERE project_id = ?').get(project.id);
  const members = db.prepare(`
    SELECT pm.*, u.email, u.name, u.role as user_role
    FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?
  `).all(project.id);
  const recentActivity = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.project_id = ? ORDER BY a.created_at DESC LIMIT 20
  `).all(project.id);

  res.json({ success: true, data: { project, milestones, plan, members, recentActivity } });
});

// PATCH /api/admin/projects/:projectId — update project
router.patch('/projects/:projectId', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });

  const fields = ['name', 'description', 'status', 'tech_stack', 'repo_url', 'live_url', 'coolify_uuid', 'start_date', 'target_date'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'tech_stack' && Array.isArray(req.body[f]) ? JSON.stringify(req.body[f]) : req.body[f]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

  updates.push("updated_at = datetime('now')");
  values.push(project.id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  if (req.body.status && req.body.status !== project.status) {
    logActivity(db, { projectId: project.id, userId: req.user.id, action: 'project_status_changed', entityType: 'project', entityId: project.id,
      details: { old_status: project.status, new_status: req.body.status }, ip: req.ip });
  }

  res.json({ success: true, data: { message: 'Updated' } });
});

// POST /api/admin/projects/:projectId/propose — send plan to client
router.post('/projects/:projectId/propose', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });

  const plan = db.prepare('SELECT * FROM project_plans WHERE project_id = ?').get(project.id);
  if (!plan) return res.status(400).json({ success: false, error: 'No plan exists for this project' });

  db.prepare("UPDATE projects SET status = 'proposed', updated_at = datetime('now') WHERE id = ?").run(project.id);

  logActivity(db, { projectId: project.id, userId: req.user.id, action: 'project_proposed', entityType: 'project', entityId: project.id, ip: req.ip });

  res.json({ success: true, data: { message: 'Plan sent to client for approval' } });
});

// ===== PROJECT MEMBERS =====

// POST /api/admin/projects/:projectId/members — assign user to project
router.post('/projects/:projectId/members', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  const { user_id, role } = req.body;
  if (!user_id) return res.status(400).json({ success: false, error: 'user_id required' });

  const user = db.prepare('SELECT id, name, email, role as user_role FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // Check if already a member
  const existing = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(project.id, user_id);
  if (existing) return res.status(409).json({ success: false, error: 'User is already a member of this project' });

  const memberRole = ['member', 'viewer'].includes(role) ? role : 'member';
  const id = generateId();
  db.prepare("INSERT INTO project_members (id, project_id, user_id, role, added_at) VALUES (?, ?, ?, ?, datetime('now'))")
    .run(id, project.id, user_id, memberRole);

  logActivity(db, { projectId: project.id, userId: req.user.id, action: 'member_added',
    entityType: 'project', entityId: project.id,
    details: { member_user_id: user_id, member_name: user.name, member_email: user.email, role: memberRole }, ip: req.ip });

  res.json({ success: true, data: { member: { id, project_id: project.id, user_id, role: memberRole, name: user.name, email: user.email, user_role: user.user_role } } });
});

// DELETE /api/admin/projects/:projectId/members/:userId — remove user from project
router.delete('/projects/:projectId/members/:userId', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  const membership = db.prepare('SELECT pm.id, u.name, u.email FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? AND pm.user_id = ?')
    .get(project.id, req.params.userId);
  if (!membership) return res.status(404).json({ success: false, error: 'User is not a member of this project' });

  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(project.id, req.params.userId);

  logActivity(db, { projectId: project.id, userId: req.user.id, action: 'member_removed',
    entityType: 'project', entityId: project.id,
    details: { member_user_id: req.params.userId, member_name: membership.name, member_email: membership.email }, ip: req.ip });

  res.json({ success: true, data: { message: `${membership.name} removed from project` } });
});

// GET /api/admin/users/search?q= — search users for member assignment
router.get('/users/search', (req, res) => {
  const db = getDb();
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });

  const users = db.prepare(`
    SELECT id, name, email, role, org_id FROM users
    WHERE (name LIKE ? OR email LIKE ?) AND role IN ('client', 'admin', 'staff')
    ORDER BY name LIMIT 20
  `).all(`%${q}%`, `%${q}%`);

  res.json({ success: true, data: { users } });
});

// ===== MILESTONES =====

// POST /api/admin/projects/:projectId/milestones
router.post('/projects/:projectId/milestones', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  const { title, description, target_date, sort_order } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'Title required' });

  const id = generateId();
  const order = sort_order ?? db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM milestones WHERE project_id = ?').get(project.id).next;

  db.prepare('INSERT INTO milestones (id, project_id, title, description, target_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, project.id, title.trim(), description || null, target_date || null, order);

  logActivity(db, { projectId: project.id, userId: req.user.id, action: 'milestone_created', entityType: 'milestone', entityId: id,
    details: { title }, ip: req.ip });

  res.json({ success: true, data: { milestone: { id, title, status: 'upcoming', sort_order: order } } });
});

// PATCH /api/admin/milestones/:milestoneId
router.patch('/milestones/:milestoneId', (req, res) => {
  const db = getDb();
  const ms = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.milestoneId);
  if (!ms) return res.status(404).json({ success: false, error: 'Not found' });

  const { title, description, status, target_date, sort_order, completion_notes } = req.body;

  const updates = [];
  const values = [];
  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (target_date !== undefined) { updates.push('target_date = ?'); values.push(target_date); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
  if (completion_notes !== undefined) { updates.push('completion_notes = ?'); values.push(completion_notes); }
  if (status !== undefined) {
    updates.push('status = ?'); values.push(status);
    if (status === 'completed' && ms.status !== 'completed') {
      updates.push("completed_date = datetime('now')");
    }
  }

  if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

  values.push(ms.id);
  db.prepare(`UPDATE milestones SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // Recalculate project progress
  if (status) {
    const total = db.prepare('SELECT COUNT(*) as c FROM milestones WHERE project_id = ?').get(ms.project_id).c;
    const done = db.prepare("SELECT COUNT(*) as c FROM milestones WHERE project_id = ? AND status = 'completed'").get(ms.project_id).c;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    db.prepare("UPDATE projects SET progress_percent = ?, updated_at = datetime('now') WHERE id = ?").run(progress, ms.project_id);

    logActivity(db, { projectId: ms.project_id, userId: req.user.id, action: 'milestone_status_changed', entityType: 'milestone', entityId: ms.id,
      details: { title: ms.title, old_status: ms.status, new_status: status }, ip: req.ip });
  }

  res.json({ success: true, data: { message: 'Updated' } });
});

// DELETE /api/admin/milestones/:milestoneId
router.delete('/milestones/:milestoneId', (req, res) => {
  const db = getDb();
  const ms = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.milestoneId);
  if (!ms) return res.status(404).json({ success: false, error: 'Not found' });
  db.prepare('DELETE FROM milestones WHERE id = ?').run(ms.id);
  res.json({ success: true, data: { message: 'Deleted' } });
});

// ===== PROJECT PLANS =====

// POST /api/admin/projects/:projectId/plan
router.post('/projects/:projectId/plan', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, error: 'Plan content required' });

  const existing = db.prepare('SELECT * FROM project_plans WHERE project_id = ?').get(project.id);
  if (existing) {
    // Archive current version before overwriting
    db.prepare('INSERT INTO plan_versions (id, project_id, content, version, saved_by) VALUES (?, ?, ?, ?, ?)')
      .run(generateId(), project.id, existing.content, existing.version, req.user.id);

    db.prepare("UPDATE project_plans SET content = ?, version = version + 1, updated_at = datetime('now') WHERE project_id = ?")
      .run(content, project.id);
  } else {
    db.prepare('INSERT INTO project_plans (id, project_id, content) VALUES (?, ?, ?)')
      .run(generateId(), project.id, content);
  }

  const plan = db.prepare('SELECT version FROM project_plans WHERE project_id = ?').get(project.id);
  logActivity(db, { projectId: project.id, userId: req.user.id, action: 'plan_updated', entityType: 'plan', entityId: project.id, details: { version: plan.version }, ip: req.ip });
  res.json({ success: true, data: { message: 'Plan saved', version: plan.version } });
});

// GET /api/admin/projects/:projectId/plan/versions — plan version history
router.get('/projects/:projectId/plan/versions', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });

  const versions = db.prepare(`
    SELECT pv.id, pv.version, pv.created_at, u.name as saved_by_name
    FROM plan_versions pv
    LEFT JOIN users u ON u.id = pv.saved_by
    WHERE pv.project_id = ?
    ORDER BY pv.version DESC
  `).all(project.id);

  res.json({ success: true, data: { versions } });
});

// GET /api/admin/projects/:projectId/plan/versions/:versionId — get specific version content
router.get('/projects/:projectId/plan/versions/:versionId', (req, res) => {
  const db = getDb();
  const version = db.prepare('SELECT * FROM plan_versions WHERE id = ? AND project_id = ?')
    .get(req.params.versionId, req.params.projectId);
  if (!version) return res.status(404).json({ success: false, error: 'Version not found' });

  res.json({ success: true, data: { version } });
});

// POST /api/admin/projects/:projectId/plan/restore/:versionId — restore a previous version
router.post('/projects/:projectId/plan/restore/:versionId', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });

  const oldVersion = db.prepare('SELECT * FROM plan_versions WHERE id = ? AND project_id = ?')
    .get(req.params.versionId, req.params.projectId);
  if (!oldVersion) return res.status(404).json({ success: false, error: 'Version not found' });

  const current = db.prepare('SELECT * FROM project_plans WHERE project_id = ?').get(project.id);
  if (current) {
    // Archive current before restoring
    db.prepare('INSERT INTO plan_versions (id, project_id, content, version, saved_by) VALUES (?, ?, ?, ?, ?)')
      .run(generateId(), project.id, current.content, current.version, req.user.id);

    db.prepare("UPDATE project_plans SET content = ?, version = version + 1, updated_at = datetime('now') WHERE project_id = ?")
      .run(oldVersion.content, project.id);
  }

  const plan = db.prepare('SELECT version FROM project_plans WHERE project_id = ?').get(project.id);
  logActivity(db, { projectId: project.id, userId: req.user.id, action: 'plan_restored', entityType: 'plan', entityId: project.id, details: { restored_from: oldVersion.version, new_version: plan.version }, ip: req.ip });
  res.json({ success: true, data: { message: `Restored to v${oldVersion.version}`, version: plan.version } });
});

// ===== TICKETS (admin view) =====

// GET /api/admin/projects/:projectId/tickets
router.get('/projects/:projectId/tickets', (req, res) => {
  const db = getDb();
  const { status, type, sort } = req.query;
  let sql = `
    SELECT t.*, u.name as created_by_name, u.email as created_by_email,
           a.name as assigned_to_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN users a ON a.id = t.assigned_to
    WHERE t.project_id = ?
  `;
  const params = [req.params.projectId];
  if (status && status !== 'all') { sql += ' AND t.status = ?'; params.push(status); }
  if (type && type !== 'all') { sql += ' AND t.type = ?'; params.push(type); }
  sql += sort === 'priority' ? ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, t.created_at DESC'
    : ' ORDER BY t.created_at DESC';
  sql += ' LIMIT 100';

  res.json({ success: true, data: { tickets: db.prepare(sql).all(...params) } });
});

// GET /api/admin/tickets/:ticketId — full ticket with comments (including internal)
router.get('/tickets/:ticketId', (req, res) => {
  const db = getDb();
  const ticket = db.prepare(`
    SELECT t.*, u.name as created_by_name, u.email as created_by_email,
           a.name as assigned_to_name, p.name as project_name, p.slug as project_slug
    FROM tickets t
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN users a ON a.id = t.assigned_to
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.id = ?
  `).get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });

  const comments = db.prepare(`
    SELECT c.*,
      CASE WHEN c.user_id = 0 THEN 'Development Team' ELSE u.name END as user_name,
      CASE WHEN c.user_id = 0 THEN NULL ELSE u.email END as user_email,
      CASE WHEN c.user_id = 0 THEN 'staff' ELSE u.role END as user_role
    FROM ticket_comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.ticket_id = ? ORDER BY c.created_at
  `).all(ticket.id);

  res.json({ success: true, data: { ticket, comments } });
});

// PATCH /api/admin/tickets/:ticketId — update ticket (assign, status, priority)
router.patch('/tickets/:ticketId', (req, res) => {
  const db = getDb();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });

  const { assigned_to, status, priority, due_date } = req.body;
  const updates = ["updated_at = datetime('now')"];
  const values = [];

  if (assigned_to !== undefined) { updates.push('assigned_to = ?'); values.push(assigned_to); }
  if (priority) { updates.push('priority = ?'); values.push(priority); }
  if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
  if (status) {
    updates.push('status = ?'); values.push(status);
    if (['completed', 'closed'].includes(status) && !['completed', 'closed'].includes(ticket.status)) {
      updates.push("closed_at = datetime('now')");
    }
  }

  values.push(ticket.id);
  const result = db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  if (result.changes === 0) {
    console.error(`[ADMIN] Ticket PATCH: 0 rows updated for ticket ${ticket.id}`);
    return res.status(500).json({ success: false, error: 'Update failed — no rows changed' });
  }

  if (status && status !== ticket.status) {
    logActivity(db, { projectId: ticket.project_id, userId: req.user.id, action: 'ticket_status_changed',
      entityType: 'ticket', entityId: ticket.id,
      details: { ticket_number: ticket.ticket_number, old_status: ticket.status, new_status: status }, ip: req.ip });
  }

  // Return updated ticket so frontend can verify
  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id);
  res.json({ success: true, data: { message: 'Updated', ticket: updated } });
});

// POST /api/admin/tickets/:ticketId/comments — add comment (can be internal)
router.post('/tickets/:ticketId/comments', (req, res) => {
  const db = getDb();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });

  const { body, is_internal } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ success: false, error: 'Comment body required' });
  if (body.length > 5000) return res.status(400).json({ success: false, error: 'Comment too long (max 5000 chars)' });

  const id = generateId();
  db.prepare('INSERT INTO ticket_comments (id, ticket_id, user_id, body, is_internal) VALUES (?, ?, ?, ?, ?)')
    .run(id, ticket.id, req.user.id, body.trim(), is_internal ? 1 : 0);

  db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticket.id);

  if (!is_internal) {
    logActivity(db, { projectId: ticket.project_id, userId: req.user.id, action: 'comment_added',
      entityType: 'ticket', entityId: ticket.id,
      details: { ticket_number: ticket.ticket_number }, ip: req.ip });
  }

  res.json({ success: true, data: { comment: { id, body: body.trim(), is_internal: !!is_internal } } });
});

// ===== DEV API KEYS =====

// GET /api/admin/dev-keys
router.get('/dev-keys', requireRole('admin'), (req, res) => {
  const db = getDb();
  const keys = db.prepare('SELECT id, key_id, label, revoked, expires_at, created_at, last_used_at FROM dev_keys ORDER BY created_at DESC').all();
  res.json({ success: true, data: { keys } });
});

// POST /api/admin/dev-keys — generate new key
router.post('/dev-keys', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { label, expires_days } = req.body;

  const id = generateId();
  const keyId = crypto.randomBytes(8).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const expiresAt = expires_days ? new Date(Date.now() + expires_days * 86400000).toISOString() : null;

  db.prepare('INSERT INTO dev_keys (id, key_id, secret, label, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, keyId, secret, label || null, expiresAt);

  logActivity(db, { userId: req.user.id, action: 'dev_key_created', entityType: 'dev_key', entityId: id,
    details: { label, key_id: keyId }, ip: req.ip });

  res.json({ success: true, data: { key_id: keyId, secret, label, expires_at: expiresAt,
    message: 'Save the secret now — it will not be shown again.' } });
});

// DELETE /api/admin/dev-keys/:keyId — revoke key
router.delete('/dev-keys/:keyId', requireRole('admin'), (req, res) => {
  const db = getDb();
  db.prepare('UPDATE dev_keys SET revoked = 1 WHERE key_id = ?').run(req.params.keyId);
  res.json({ success: true, data: { message: 'Key revoked' } });
});

// GET /api/admin/dev-api-status — diagnostic check for dev API health
router.get('/dev-api-status', requireRole('admin'), (req, res) => {
  const db = getDb();
  const activeKeys = db.prepare("SELECT key_id, label, last_used_at, expires_at FROM dev_keys WHERE revoked = 0").all();
  const recentResolves = db.prepare(`
    SELECT a.details, a.created_at FROM activity_log a
    WHERE a.action = 'ticket_resolved' ORDER BY a.created_at DESC LIMIT 5
  `).all();
  const openTickets = db.prepare("SELECT t.id, t.ticket_number, t.title, t.status, t.updated_at, p.name as project_name FROM tickets t JOIN projects p ON p.id = t.project_id WHERE t.status IN ('open','in_progress') ORDER BY t.created_at DESC LIMIT 20").all();

  res.json({
    success: true,
    data: {
      active_keys: activeKeys.length,
      keys: activeKeys.map(k => ({ key_id: k.key_id, label: k.label, last_used: k.last_used_at, expires: k.expires_at })),
      recent_resolves: recentResolves.map(r => ({ details: JSON.parse(r.details || '{}'), at: r.created_at })),
      open_tickets: openTickets
    }
  });
});

module.exports = router;
