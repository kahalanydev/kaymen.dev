const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { initDb, seedAdmin } = require('./db');

const { shield } = require('./middleware/shield');
const { startRollups } = require('./utils/rollup');

const authRoutes = require('./routes/auth');
const trackRoutes = require('./routes/track');
const adminRoutes = require('./routes/admin');
const securityRoutes = require('./routes/security');
const trafficRoutes = require('./routes/traffic');
const portalRoutes = require('./routes/portal');
const devRoutes = require('./routes/dev');
const uploadRoutes = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy — EXACTLY ONE HOP, which is the Traefik in front of this
// container. This was `true`, meaning "trust every hop", and under that setting
// `req.ip` is the LEFTMOST X-Forwarded-For entry — a header the client writes.
// Any visitor could have attributed their traffic to any address they liked,
// which is merely untidy for analytics and fatal for a blocklist keyed on IP.
// With 1, Express takes the entry Traefik itself appended: the address it
// actually observed. Changed 2026-08-17 with the security centre.
app.set('trust proxy', 1);

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

// The shield — every request, in front of everything.
//
// It sits AFTER express.json deliberately: half of what it inspects is the
// request body, and a middleware that runs before the parser can only ever see
// the URL. It sits BEFORE the sensitive-path 404s below, because a request for
// /server/db.js is reconnaissance worth recording, not just a miss.
//
// It also sets req.clientIp, which every downstream route should use in place
// of req.ip — one normalised, non-spoofable value (see middleware/shield.js §1).
app.use(shield);

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

  const ip = req.clientIp || req.ip || req.socket.remoteAddress;
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
    const { sendContactNotification } = require('./utils/email');
    await sendContactNotification({
      to: 'hello@kaymen.dev',
      name,
      email: email.trim(),
      projectName: project_name ? project_name.trim() : null,
      message
    });
  } catch {}

  res.json({ success: true });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/track', trackRoutes);
// Mounted BEFORE the general admin router. Both live under /api/admin and
// Express matches in registration order, so these two have to be first or
// /api/admin/security would be swallowed by the older handler of the same name.
app.use('/api/admin/security', securityRoutes);
app.use('/api/admin/traffic', trafficRoutes);
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
const { homeSections, rentPanel, scaleChart, liveCount, caseStudyPage, workIndexPage, notFoundPage } = require('./render');

const IS_DEV = process.env.NODE_ENV !== 'production';
const HOME_TEMPLATE_PATH = path.join(__dirname, '..', 'index.html');

// index.html is a template, not a page. Each placeholder is substituted with a
// FUNCTION replacement, never a string: the rendered content contains "$" runs
// ("$1.58M", "$47K") and $&, $', $1 are all special in string replacements.
const PLACEHOLDERS = [
  // work sections (running board + case studies)
  { token: '<!--{{WORK}}-->', render: homeSections, required: true },
  // hero panel: the subscription stack vs owning one system, from content/pricing.js
  { token: '<!--{{RENT}}-->', render: rentPanel, required: true },
  // three years against seven CRMs, at the visitor's headcount
  { token: '<!--{{SCALE}}-->', render: scaleChart, required: true },
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

// 404 handler.
//
// The shield already inspected and scored this request on the way in, so this
// no longer re-runs detection — doing both wrote every scanner probe to
// suspicious_activity twice, once with a category and once without, and the
// duplicate is what made the old log hard to read.
app.use((req, res) => {
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

  // Daily rollups + retention. Starts its own timers and runs the first cycle
  // 20s in, so it never competes with the first requests after a deploy.
  startRollups();

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
