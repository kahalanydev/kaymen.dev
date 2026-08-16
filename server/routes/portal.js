const express = require('express');
const { getDb, generateId, logActivity, nextTicketNumber } = require('../db');
const { requireAuth, requireRole, enforceOrgScope, rateLimit } = require('../middleware/auth');
const { sendTicketNotification } = require('../utils/email');

const router = express.Router();

// All portal routes require authenticated client (or admin/staff viewing as themselves)
router.use(requireAuth);
router.use(rateLimit(60, 60000)); // 60 req/min

// ===== DASHBOARD =====

// GET /api/portal/dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const orgId = req.user.org_id;

  if (!orgId && !['admin', 'staff'].includes(req.user.role)) {
    // Check if user has any project_members assignments even without an org
    const hasMemberships = db.prepare('SELECT 1 FROM project_members WHERE user_id = ?').get(userId);
    if (!hasMemberships) {
      return res.status(403).json({ success: false, error: 'No organization assigned' });
    }
  }

  // Org projects + individually assigned projects (deduplicated)
  const projects = db.prepare(`
    SELECT DISTINCT p.*, o.name as org_name,
           (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id AND t.status IN ('open','in_progress')) as open_tickets
    FROM projects p
    JOIN organizations o ON o.id = p.org_id
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    WHERE (? IS NOT NULL AND p.org_id = ? OR pm.user_id IS NOT NULL) AND p.status != 'archived'
    ORDER BY p.updated_at DESC
  `).all(userId, orgId || null, orgId || null);

  // Enrich each project with milestone summary
  let activeMilestones = [];
  let allRecentTickets = [];

  projects.forEach(p => {
    const ms = db.prepare('SELECT id, title, status, target_date, completed_date, project_id FROM milestones WHERE project_id = ? ORDER BY sort_order').all(p.id);
    p.milestones_total = ms.length;
    p.milestones_done = ms.filter(m => m.status === 'completed').length;
    const next = ms.find(m => m.status === 'in_progress') || ms.find(m => m.status === 'upcoming');
    p.next_milestone = next ? next.title : null;
    // Days remaining to target
    if (p.target_date) {
      const diff = Math.ceil((new Date(p.target_date) - new Date()) / 86400000);
      p.days_remaining = diff;
    } else {
      p.days_remaining = null;
    }

    // Collect active/upcoming milestones for spotlight widget
    const current = ms.find(m => m.status === 'in_progress');
    if (current) activeMilestones.push({ ...current, project_name: p.name });
    else {
      const upcoming = ms.find(m => m.status === 'upcoming');
      if (upcoming) activeMilestones.push({ ...upcoming, project_name: p.name });
    }

    // Collect recent tickets for summary widget
    const tickets = db.prepare(`
      SELECT id, ticket_number, title, status, priority, type, created_at, project_id
      FROM tickets WHERE project_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(p.id);
    tickets.forEach(t => { t.project_name = p.name; });
    allRecentTickets.push(...tickets);
  });

  // Sort tickets by date, keep top 5
  allRecentTickets.sort((a, b) => b.created_at.localeCompare(a.created_at));
  allRecentTickets = allRecentTickets.slice(0, 5);

  // Ticket stats across all projects
  const projectIds = projects.map(p => p.id);
  let ticketStats = { open: 0, in_progress: 0, closed: 0 };
  if (projectIds.length > 0) {
    const rows = db.prepare(`
      SELECT status, COUNT(*) as c FROM tickets
      WHERE project_id IN (${projectIds.map(() => '?').join(',')})
      GROUP BY status
    `).all(...projectIds);
    rows.forEach(r => { ticketStats[r.status] = r.c; });
  }

  // Activity for all visible projects
  const recentActivity = projectIds.length > 0
    ? db.prepare(`
        SELECT a.*, u.name as user_name
        FROM activity_log a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.project_id IN (${projectIds.map(() => '?').join(',')})
          AND a.action NOT LIKE '%internal%'
        ORDER BY a.created_at DESC LIMIT 20
      `).all(...projectIds)
    : [];

  res.json({ success: true, data: { projects, recentActivity, activeMilestones, recentTickets: allRecentTickets, ticketStats } });
});

// ===== PROJECT VIEW =====

// GET /api/portal/projects/:projectId
router.get('/projects/:projectId', enforceOrgScope, (req, res) => {
  const db = getDb();
  const project = req.project;

  const milestones = db.prepare('SELECT id, title, description, status, sort_order, target_date, completed_date, completion_notes FROM milestones WHERE project_id = ? ORDER BY sort_order')
    .all(project.id);

  const openTickets = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE project_id = ? AND status IN ('open','in_progress')").get(project.id).c;

  const recentActivity = db.prepare(`
    SELECT a.action, a.entity_type, a.details, a.created_at,
      COALESCE(u.name, 'Development Team') as user_name
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.project_id = ? AND a.action NOT LIKE '%internal%'
    ORDER BY a.created_at DESC LIMIT 15
  `).all(project.id);

  // Days since start / days remaining
  let daysSinceStart = null, daysRemaining = null;
  if (project.start_date) daysSinceStart = Math.max(0, Math.ceil((new Date() - new Date(project.start_date)) / 86400000));
  if (project.target_date) daysRemaining = Math.ceil((new Date(project.target_date) - new Date()) / 86400000);

  res.json({
    success: true,
    data: {
      project: {
        id: project.id, name: project.name, slug: project.slug, description: project.description,
        status: project.status, progress_percent: project.progress_percent,
        tech_stack: project.tech_stack, live_url: project.live_url,
        start_date: project.start_date, target_date: project.target_date,
        completed_date: project.completed_date,
        days_since_start: daysSinceStart, days_remaining: daysRemaining
      },
      milestones,
      open_tickets: openTickets,
      recentActivity
    }
  });
});

// ===== PROJECT PLAN =====

// GET /api/portal/projects/:projectId/plan
router.get('/projects/:projectId/plan', enforceOrgScope, (req, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT content, version, approved_at, updated_at FROM project_plans WHERE project_id = ?').get(req.project.id);
  if (!plan) return res.status(404).json({ success: false, error: 'No plan available yet' });

  res.json({ success: true, data: { plan, project_status: req.project.status } });
});

// POST /api/portal/projects/:projectId/approve
router.post('/projects/:projectId/approve', enforceOrgScope, requireRole('client'), (req, res) => {
  const db = getDb();
  const project = req.project;

  if (project.status !== 'proposed') {
    return res.status(400).json({ success: false, error: 'Project is not in proposed status' });
  }

  // Only users from the owning org can approve
  if (!req.user.org_id || req.user.org_id !== project.org_id) {
    return res.status(403).json({ success: false, error: 'Only the owning organization can approve this project' });
  }

  const plan = db.prepare('SELECT * FROM project_plans WHERE project_id = ?').get(project.id);
  if (!plan) return res.status(400).json({ success: false, error: 'No plan to approve' });

  // Approve the plan
  db.prepare("UPDATE project_plans SET approved_at = datetime('now'), approved_by = ? WHERE project_id = ?")
    .run(req.user.id, project.id);

  // Update project status
  db.prepare("UPDATE projects SET status = 'approved', start_date = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(project.id);

  // Set first milestone to in_progress
  const firstMs = db.prepare("SELECT id FROM milestones WHERE project_id = ? AND status = 'upcoming' ORDER BY sort_order LIMIT 1").get(project.id);
  if (firstMs) {
    db.prepare("UPDATE milestones SET status = 'in_progress' WHERE id = ?").run(firstMs.id);
  }

  logActivity(db, { projectId: project.id, userId: req.user.id, action: 'project_approved',
    entityType: 'project', entityId: project.id, ip: req.ip });

  res.json({ success: true, data: { message: 'Project approved! Development will begin shortly.' } });
});

// ===== TICKETS =====

// GET /api/portal/projects/:projectId/tickets
router.get('/projects/:projectId/tickets', enforceOrgScope, (req, res) => {
  const db = getDb();
  const { status, type, sort } = req.query;

  let sql = `
    SELECT t.id, t.ticket_number, t.type, t.priority, t.status, t.title,
           t.created_at, t.updated_at, t.closed_at,
           u.name as created_by_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.project_id = ?
  `;
  const params = [req.project.id];

  if (status && status !== 'all') { sql += ' AND t.status = ?'; params.push(status); }
  if (type && type !== 'all') { sql += ' AND t.type = ?'; params.push(type); }

  sql += sort === 'priority'
    ? " ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC"
    : ' ORDER BY t.created_at DESC';
  sql += ' LIMIT 100';

  res.json({ success: true, data: { tickets: db.prepare(sql).all(...params) } });
});

// POST /api/portal/projects/:projectId/tickets — client creates ticket
router.post('/projects/:projectId/tickets', enforceOrgScope, (req, res) => {
  const db = getDb();
  const { title, type, priority, description } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ success: false, error: 'Title required' });
  if (title.length > 200) return res.status(400).json({ success: false, error: 'Title too long (max 200 chars)' });
  if (description && description.length > 10000) return res.status(400).json({ success: false, error: 'Description too long (max 10000 chars)' });

  const allowedTypes = ['task', 'bug', 'feature_request', 'modification', 'question'];
  const allowedPriority = ['low', 'medium', 'high']; // Clients can't set urgent
  const ticketType = allowedTypes.includes(type) ? type : 'task';
  const ticketPriority = allowedPriority.includes(priority) ? priority : 'medium';

  const id = generateId();
  const ticketNum = nextTicketNumber(db, req.project.id);

  db.prepare(`
    INSERT INTO tickets (id, project_id, ticket_number, created_by, type, priority, title, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.project.id, ticketNum, req.user.id, ticketType, ticketPriority, title.trim(), description || null);

  logActivity(db, { projectId: req.project.id, userId: req.user.id, action: 'ticket_created',
    entityType: 'ticket', entityId: id,
    details: { ticket_number: ticketNum, title: title.trim(), type: ticketType }, ip: req.ip });

  res.json({ success: true, data: { ticket: { id, ticket_number: ticketNum, title: title.trim(), type: ticketType, priority: ticketPriority, status: 'open' } } });

  // Fire notifications asynchronously (don't block response)
  const createdBy = req.user.name || req.user.email;
  const projectName = req.project.name;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const ticketUrl = `${proto}://${host}/admin#/tickets/${id}`;

  // Email all admins
  const admins = db.prepare("SELECT email FROM users WHERE role IN ('admin', 'staff')").all();
  if (admins.length) {
    sendTicketNotification({
      adminEmails: admins.map(a => a.email),
      projectName, ticketNumber: ticketNum, title: title.trim(),
      type: ticketType, priority: ticketPriority, createdBy, ticketUrl,
      // The client's own words are the useful part of this notification —
      // without them it is a link that has to be opened to be triaged.
      description: description || null
    }).catch(err => console.error('[NOTIFY] Email error:', err.message));
  }

  // Fire webhook if configured
  const webhookUrl = db.prepare("SELECT value FROM config WHERE key = 'ticket_webhook_url'").get();
  if (webhookUrl && webhookUrl.value) {
    fetch(webhookUrl.value, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'ticket.created',
        project: projectName,
        ticket: { id, number: ticketNum, title: title.trim(), type: ticketType, priority: ticketPriority, status: 'open' },
        created_by: createdBy,
        url: ticketUrl
      })
    }).catch(err => console.error('[WEBHOOK] Error:', err.message));
  }
});

// GET /api/portal/projects/:projectId/tickets/:ticketId
router.get('/projects/:projectId/tickets/:ticketId', enforceOrgScope, (req, res) => {
  const db = getDb();
  const ticket = db.prepare(`
    SELECT t.*, u.name as created_by_name, a.name as assigned_to_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN users a ON a.id = t.assigned_to
    WHERE t.id = ? AND t.project_id = ?
  `).get(req.params.ticketId, req.project.id);

  if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });

  // Clients only see public comments (is_internal = 0)
  const comments = db.prepare(`
    SELECT c.id, c.body, c.created_at,
      CASE WHEN c.user_id = 0 THEN 'Development Team' ELSE u.name END as user_name,
      CASE WHEN c.user_id = 0 THEN 'staff' ELSE u.role END as user_role
    FROM ticket_comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.ticket_id = ? AND c.is_internal = 0
    ORDER BY c.created_at
  `).all(ticket.id);

  res.json({ success: true, data: { ticket, comments } });
});

// POST /api/portal/tickets/:ticketId/comments — client adds comment
router.post('/tickets/:ticketId/comments', (req, res) => {
  const db = getDb();
  const ticket = db.prepare('SELECT t.*, p.org_id as project_org_id FROM tickets t JOIN projects p ON p.id = t.project_id WHERE t.id = ?').get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, error: 'Not found' });

  // Verify access for clients: org match or project_members assignment
  if (req.user.role === 'client') {
    const isOrgMember = req.user.org_id && ticket.project_org_id === req.user.org_id;
    const isProjectMember = !!db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(ticket.project_id, req.user.id);
    if (!isOrgMember && !isProjectMember) return res.status(404).json({ success: false, error: 'Not found' });
  }

  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ success: false, error: 'Comment body required' });
  if (body.length > 5000) return res.status(400).json({ success: false, error: 'Comment too long (max 5000 chars)' });

  const id = generateId();
  db.prepare('INSERT INTO ticket_comments (id, ticket_id, user_id, body, is_internal) VALUES (?, ?, ?, ?, 0)')
    .run(id, ticket.id, req.user.id, body.trim());

  db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticket.id);

  logActivity(db, { projectId: ticket.project_id, userId: req.user.id, action: 'comment_added',
    entityType: 'ticket', entityId: ticket.id,
    details: { ticket_number: ticket.ticket_number }, ip: req.ip });

  res.json({ success: true, data: { comment: { id, body: body.trim() } } });
});

// ===== ACTIVITY =====

// GET /api/portal/projects/:projectId/activity
router.get('/projects/:projectId/activity', enforceOrgScope, (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = (page - 1) * limit;

  const activities = db.prepare(`
    SELECT a.action, a.entity_type, a.entity_id, a.details, a.created_at,
      COALESCE(u.name, 'Development Team') as user_name
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.project_id = ? AND a.action NOT LIKE '%internal%'
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(req.project.id, limit, offset);

  res.json({ success: true, data: { activities } });
});

module.exports = router;
