const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { initDb, seedAdmin } = require('./db');

const authRoutes = require('./routes/auth');
const trackRoutes = require('./routes/track');
const adminRoutes = require('./routes/admin');
const portalRoutes = require('./routes/portal');
const devRoutes = require('./routes/dev');
const uploadRoutes = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy (behind Traefik)
app.set('trust proxy', true);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// Body parsing (verify callback captures raw body for HMAC signature verification)
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));

// Block access to sensitive paths
app.use('/server', (req, res) => res.status(404).end());
app.use('/node_modules', (req, res) => res.status(404).end());
app.use('/data', (req, res) => res.status(404).end());
app.use('/package.json', (req, res) => res.status(404).end());
app.use('/package-lock.json', (req, res) => res.status(404).end());
app.use('/.dockerignore', (req, res) => res.status(404).end());

// Contact form (public, rate-limited, honeypot-protected)
const contactLimiter = {};
app.post('/api/contact', async (req, res) => {
  const { name, email, message, project_name, _hp, _t } = req.body;

  // Honeypot: hidden field filled = bot
  if (_hp) return res.json({ success: true }); // silent success to not tip off bots
  // Timing: submitted in under 2 seconds = bot
  if (typeof _t === 'number' && _t < 2000) return res.json({ success: true });

  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  if (contactLimiter[ip] && now - contactLimiter[ip] < 60000) {
    return res.status(429).json({ error: 'Please wait a minute before sending another message' });
  }
  contactLimiter[ip] = now;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long' });
  }

  const { getDb } = require('./db');
  const db = getDb();

  db.prepare('INSERT INTO contact_submissions (name, email, message, project_name, ip, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
    .run(name, email.trim(), message, project_name ? project_name.trim() : null, ip);

  // Try to send email notification
  try {
    const { sendEmail } = require('./utils/email');
    const projectLine = project_name ? `<p><strong>Project:</strong> ${project_name}</p>` : '';
    await sendEmail({
      to: 'hello@kaymen.dev',
      subject: `New project inquiry from ${name}${project_name ? ` — ${project_name}` : ''}`,
      html: `<div style="font-family:sans-serif;padding:20px;background:#1a1a2e;color:#e0e0e0;border-radius:12px;max-width:500px">
        <h2 style="color:#3b82f6;margin-bottom:16px">New Project Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}" style="color:#3b82f6">${email}</a></p>
        ${projectLine}
        <p><strong>Message:</strong></p>
        <div style="background:#0d0d1a;padding:16px;border-radius:8px;margin-top:8px;white-space:pre-wrap">${message}</div>
      </div>`
    });
  } catch {}

  res.json({ success: true });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/uploads', uploadRoutes);

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, '..', 'admin'), {
  extensions: ['html'],
  index: 'index.html'
}));

// Serve client portal
app.use('/portal', express.static(path.join(__dirname, '..', 'portal'), {
  extensions: ['html'],
  index: 'index.html'
}));

// --- Marketing site (server-rendered from content/projects.js) ---------------
// Rendered rather than served flat so case studies get real HTML and real
// per-page OG tags. Templates are cached in production and re-read in dev so
// editing content doesn't need a restart.
const fs = require('fs');
const { homeSections, fleetPanel, liveCount, caseStudyPage, workIndexPage, notFoundPage } = require('./render');

const IS_DEV = process.env.NODE_ENV !== 'production';
const HOME_TEMPLATE_PATH = path.join(__dirname, '..', 'index.html');

// index.html is a template, not a page. Each placeholder is substituted with a
// FUNCTION replacement, never a string: the rendered content contains "$" runs
// ("$1.58M", "$47K") and $&, $', $1 are all special in string replacements.
const PLACEHOLDERS = [
  // work sections (running board + case studies)
  { token: '<!--{{WORK}}-->', render: homeSections, required: true },
  // hero graphic, drawn from measured git history in content/stats.js
  { token: '<!--{{FLEET}}-->', render: fleetPanel, required: true },
  // live-systems count, from the Coolify API at last stats refresh
  { token: '<!--{{LIVE}}-->', render: liveCount, required: false },
];

let homeCache = null;
function renderHome() {
  if (homeCache && !IS_DEV) return homeCache;
  let html = fs.readFileSync(HOME_TEMPLATE_PATH, 'utf8');
  for (const p of PLACEHOLDERS) {
    if (!html.includes(p.token)) {
      // Fail loudly in the log, degrade gracefully in the response — a missing
      // placeholder means the page renders without that block, which is a
      // content regression worth seeing rather than a reason to 500 the
      // homepage. Nothing else notices, so this log is the only signal.
      if (p.required) console.error(`[render] ${p.token} not found in index.html — block omitted`);
      continue;
    }
    html = html.split(p.token).join(p.render());
  }
  if (!IS_DEV) homeCache = html;
  return html;
}

const sendHtml = (res, html) =>
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);

app.get('/', (req, res) => sendHtml(res, renderHome()));
app.get('/work', (req, res) => sendHtml(res, workIndexPage()));

app.get('/work/:slug', (req, res, next) => {
  const html = caseStudyPage(req.params.slug);
  if (!html) return next(); // falls through to the 404 handler
  sendHtml(res, html);
});

// Serve main site (static files from root, only allowed extensions)
const STATIC_EXTENSIONS = /\.(html|css|js|svg|png|jpg|jpeg|gif|ico|woff2?|ttf|webp|webmanifest)$/;
app.use((req, res, next) => {
  if (STATIC_EXTENSIONS.test(req.path)) {
    return express.static(path.join(__dirname, '..'), {
      index: false,
      dotfiles: 'deny'
    })(req, res, next);
  }
  next();
});

// 404 handler — track scanner attempts
const { checkSuspicious } = require('./utils/detection');
app.use((req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  checkSuspicious(ip, req.headers['user-agent'], req.path);
  // A browser following a stale /work/<slug> link should get a page, not JSON.
  if (!req.path.startsWith('/api/') && req.accepts(['html', 'json']) === 'html') {
    return res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(notFoundPage());
  }
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — return JSON for API routes instead of Express default HTML
app.use((err, req, res, _next) => {
  console.error(`[${req.method} ${req.path}]`, err.message || err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Initialize database and start server
async function start() {
  await initDb();
  seedAdmin();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Main site: http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Client portal: http://localhost:${PORT}/portal`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
