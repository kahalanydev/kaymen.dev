const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb, getJwtSecret, logAuthEvent } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { allowIp } = require('../middleware/shield');
const {
  sendWelcomeEmail, sendPasswordResetEmail, sendPasswordResetRequestEmail, getSmtpConfig
} = require('../utils/email');

const router = express.Router();

// ===== BRUTE-FORCE LOCKOUT ==================================================
//
// `users.login_attempts` and `users.locked_until` have existed since the portal
// was built and NOTHING HAS EVER READ THEM. The login route compared a password
// and returned; an attacker could try the admin address as fast as bcrypt would
// answer, indefinitely, and leave no trace anywhere in the system.
//
// Five attempts, then fifteen minutes. The counter resets on success and the
// lock expires on its own — there is no unlock button and there should not be
// one, because the only person who could press it is the one locked out.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Whatever the failure was, the caller is told the same thing. "No such user"
// and "wrong password" are different sentences to an attacker enumerating
// addresses, and "this account is locked" confirms the address exists.
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = getDb();
  const ip = req.clientIp || req.ip;
  const userAgent = req.headers['user-agent'] || '';
  const addr = (email || '').toLowerCase().trim();

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(addr);

  // No such account. Logged anyway — a run of these against addresses that do
  // not exist is address enumeration, and it is only visible if it is recorded.
  if (!user) {
    logAuthEvent(db, { email: addr, event: 'login_failed', ip, userAgent, detail: 'No such account' });
    return res.status(401).json({ success: false, error: GENERIC_LOGIN_ERROR });
  }

  if (user.locked_until && new Date(user.locked_until + 'Z') > new Date()) {
    logAuthEvent(db, {
      userId: user.id, email: addr, event: 'login_blocked', ip, userAgent,
      detail: `Locked until ${user.locked_until}`
    });
    return res.status(401).json({ success: false, error: GENERIC_LOGIN_ERROR });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    const attempts = (user.login_attempts || 0) + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    db.prepare(`
      UPDATE users SET login_attempts = ?, locked_until = ${lock
        ? `datetime('now', '+${LOCKOUT_MINUTES} minutes')` : 'NULL'} WHERE id = ?
    `).run(attempts, user.id);

    logAuthEvent(db, {
      userId: user.id, email: addr, event: lock ? 'lockout' : 'login_failed', ip, userAgent,
      detail: lock ? `${attempts} failed attempts — locked ${LOCKOUT_MINUTES}m` : `Attempt ${attempts}/${MAX_ATTEMPTS}`
    });
    return res.status(401).json({ success: false, error: GENERIC_LOGIN_ERROR });
  }

  db.prepare("UPDATE users SET login_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?")
    .run(user.id);
  logAuthEvent(db, { userId: user.id, email: addr, event: 'login_success', ip, userAgent, detail: user.role });

  // An admin or staff member who just proved who they are gets their IP marked
  // trusted for a week. This is the safeguard that keeps the shield's
  // auto-blocking from ever locking Ohav out of his own production panel — see
  // the note at the top of middleware/shield.js. It is a visible, revocable row
  // in the blocklist UI rather than a hidden exception in code.
  if (user.role === 'admin' || user.role === 'staff') {
    try {
      allowIp({
        ip, reason: `Trusted after ${user.role} login (${user.email})`,
        source: 'auto', userId: user.id, minutes: 10080
      });
    } catch { /* an allow rule is a convenience; never fail a login over it */ }
  }

  const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '24h' });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        must_change_password: !!user.must_change_password
      }
    }
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, error: 'Current and new password required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime(\'now\') WHERE id = ?')
    .run(hash, req.user.id);

  logAuthEvent(db, {
    userId: req.user.id, email: req.user.email, event: 'password_changed',
    ip: req.clientIp || req.ip, userAgent: req.headers['user-agent']
  });

  res.json({ success: true, data: { message: 'Password changed successfully' } });
});

// POST /api/auth/reset-password — self-service reset, by emailed one-time link
//
// REWRITTEN 2026-08-16, after it locked the only admin out of production.
//
// It used to generate a password, overwrite the account with it, and print the
// plaintext to stdout — the UI told you to "check the server logs". That is a
// workable design on a laptop and an unusable one here: `docker logs` only
// covers the CURRENT container, and every push to master redeploys, so the
// credential's real lifetime was the gap until the next deploy. Ohav's reset at
// 23:38 was destroyed by the 23:40 deploy, and because the endpoint had already
// overwritten his password, the account was unreachable. It reported success
// throughout.
//
// Two rules came out of that, and both matter more than the emailing:
//
//  1. NEVER INVALIDATE THE OLD PASSWORD HERE. A reset REQUEST is unauthenticated
//     — anyone who can type an address can fire it. Destroying the password on
//     request means any stranger can lock any user out, and it is what turned a
//     failed delivery into a lockout. The password changes only when the link is
//     actually used (POST /invite/:token/accept).
//  2. NEVER CLAIM DELIVERY THAT DID NOT HAPPEN. With no SMTP there is no channel
//     at all, so this refuses loudly instead of returning success.
const RESET_TTL_HOURS = 1;

router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  // No delivery channel is a server misconfiguration, not a bad request, and it
  // is the operator's problem rather than a secret — say so plainly and point at
  // the path that still works. Returning success here is the original bug.
  if (!getSmtpConfig()) {
    return res.status(503).json({
      success: false,
      error: 'Password reset by email is unavailable — outbound email is not configured on this server. Ask an administrator to send you a reset link.'
    });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

  /* Identical response whether or not the address is on file: this endpoint is
     public, and a differing reply turns it into an account-existence oracle. */
  const neutral = { success: true, data: { message: 'If that email is on file, a reset link is on its way. It expires in an hour.' } };

  // Logged either way, and this is the one place the log knows something the
  // response deliberately does not. A burst of resets against addresses that do
  // not exist is somebody probing for accounts; the caller must not be able to
  // tell, but Ohav must.
  logAuthEvent(db, {
    userId: user ? user.id : null, email: email.toLowerCase().trim(),
    event: 'password_reset_requested', ip: req.clientIp || req.ip,
    userAgent: req.headers['user-agent'],
    detail: user ? 'Link issued' : 'No such account'
  });
  if (!user) return res.json(neutral);

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // password_hash is deliberately untouched — see rule 1 above.
  db.prepare("UPDATE users SET invite_token = ?, invite_expires_at = ?, updated_at = datetime('now') WHERE id = ?")
    .run(token, expires, user.id);

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const portalPath = user.role === 'client' ? 'portal' : 'admin';
  const resetUrl = `${proto}://${host}/${portalPath}#/invite/${token}`;

  const sent = await sendPasswordResetRequestEmail({
    email: user.email, name: user.name, resetUrl, hours: RESET_TTL_HOURS
  });
  // Logged, not returned: the caller must not learn the address was real.
  if (!sent) console.error(`[AUTH] reset link for ${user.email} could not be delivered`);

  res.json(neutral);
});

// GET /api/auth/invite/:token — validate invite token (public)
router.get('/invite/:token', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE invite_token = ?').get(req.params.token);
  if (!user) return res.status(404).json({ success: false, error: 'Invalid or expired invite link' });

  const row = db.prepare('SELECT invite_expires_at FROM users WHERE id = ?').get(user.id);
  if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
    return res.status(410).json({ success: false, error: 'This invite link has expired. Please ask your admin to resend it.' });
  }

  res.json({ success: true, data: { user: { email: user.email, name: user.name } } });
});

// POST /api/auth/invite/:token/accept — set password via invite (public)
router.post('/invite/:token/accept', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE invite_token = ?').get(req.params.token);
  if (!user) return res.status(404).json({ success: false, error: 'Invalid or expired invite link' });

  if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
    return res.status(410).json({ success: false, error: 'This invite link has expired. Please ask your admin to resend it.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  // The lockout counters are cleared here too: whoever holds a valid one-time
  // link has proved control of the mailbox, and leaving a lock in place would
  // mean the documented way out of a lockout does not actually work.
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, invite_token = NULL, invite_expires_at = NULL, login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(hash, user.id);

  logAuthEvent(db, {
    userId: user.id, email: user.email, event: 'invite_accepted',
    ip: req.clientIp || req.ip, userAgent: req.headers['user-agent'],
    detail: 'Password set via one-time link'
  });

  // Auto-login after accepting invite
  const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '24h' });

  res.json({
    success: true,
    data: {
      message: 'Password set successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    }
  });
});

// POST /api/auth/users/:id/reset — admin resets another user's password
// Unlike the self-service route above, this one DOES invalidate the current
// password, and should: an admin resetting somebody is often revoking access,
// and it is an authenticated action rather than something a stranger can fire.
// What it must not do is pretend the invite reached them — `emailed` is now
// returned so the UI can tell the operator to hand the link over instead.
router.post('/users/:id/reset', requireAuth, async (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const placeholder = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 4);

  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, invite_token = ?, invite_expires_at = ?, login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(placeholder, inviteToken, inviteExpires, targetId);

  logAuthEvent(db, {
    userId: targetId, email: target.email, event: 'password_reset_by_admin',
    ip: req.clientIp || req.ip, userAgent: req.headers['user-agent'],
    detail: `Reset by ${req.user.email}`
  });

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const portalPath = target.role === 'client' ? 'portal' : 'admin';
  const inviteUrl = `${proto}://${host}/${portalPath}#/invite/${inviteToken}`;
  const emailed = await sendPasswordResetEmail({ email: target.email, name: target.name, inviteUrl });

  res.json({ success: true, data: { invite_url: inviteUrl, emailed } });
});

// GET /api/auth/users — list all users (Settings page)
router.get('/users', requireAuth, (req, res) => {
  const db = getDb();
  const users = db.prepare("SELECT id, email, name, role, must_change_password, created_at FROM users ORDER BY role, created_at").all();
  res.json({ success: true, data: { users } });
});

// POST /api/auth/users — create new admin
router.post('/users', requireAuth, async (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ success: false, error: 'User with this email already exists' });
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const placeholder = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 4);

  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name, role, must_change_password, invite_token, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(email.toLowerCase().trim(), placeholder, name || null, 'admin', 1, inviteToken, inviteExpires);

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const inviteUrl = `${proto}://${host}/admin#/invite/${inviteToken}`;
  // Awaited and reported for the same reason as the reset above: a new admin
  // whose invite silently never sent is an account nobody can ever get into.
  const emailed = await sendWelcomeEmail({ email: email.toLowerCase().trim(), name, role: 'admin', inviteUrl });

  res.json({
    success: true,
    data: {
      user: { id: result.lastInsertRowid, email: email.toLowerCase().trim(), name },
      invite_url: inviteUrl,
      emailed
    }
  });
});

// DELETE /api/auth/users/:id — remove admin
router.delete('/users/:id', requireAuth, (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);

  if (targetId === req.user.id) {
    return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count <= 1) {
    return res.status(400).json({ success: false, error: 'Cannot delete the last admin' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ success: true, data: { message: 'User deleted' } });
});

// ===== SMTP CONFIG (admin only) =====

router.get('/smtp/config', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const get = (key) => { const r = db.prepare("SELECT value FROM config WHERE key = ?").get(key); return r ? r.value : ''; };
  res.json({ success: true, data: {
    smtp_host: get('smtp_host'),
    smtp_port: get('smtp_port') || '587',
    smtp_user: get('smtp_user'),
    smtp_pass_set: !!get('smtp_pass'),
    smtp_from: get('smtp_from'),
    ticket_webhook_url: get('ticket_webhook_url')
  }});
});

router.put('/smtp/config', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const fields = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from'];
  for (const key of fields) {
    if (req.body[key] !== undefined) {
      const existing = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
      if (existing) db.prepare("UPDATE config SET value = ? WHERE key = ?").run(req.body[key], key);
      else db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run(key, req.body[key]);
    }
  }
  if (req.body.smtp_pass && req.body.smtp_pass !== '') {
    const existing = db.prepare("SELECT value FROM config WHERE key = 'smtp_pass'").get();
    if (existing) db.prepare("UPDATE config SET value = ? WHERE key = 'smtp_pass'").run(req.body.smtp_pass);
    else db.prepare("INSERT INTO config (key, value) VALUES ('smtp_pass', ?)").run(req.body.smtp_pass);
  }
  if (req.body.ticket_webhook_url !== undefined) {
    const existing = db.prepare("SELECT value FROM config WHERE key = 'ticket_webhook_url'").get();
    if (existing) db.prepare("UPDATE config SET value = ? WHERE key = 'ticket_webhook_url'").run(req.body.ticket_webhook_url);
    else db.prepare("INSERT INTO config (key, value) VALUES ('ticket_webhook_url', ?)").run(req.body.ticket_webhook_url);
  }
  res.json({ success: true, data: { message: 'SMTP settings saved' } });
});

router.post('/smtp/test', requireAuth, requireRole('admin'), async (req, res) => {
  const { sendSmtpTestEmail } = require('../utils/email');
  const sent = await sendSmtpTestEmail({ to: req.user.email });
  if (sent) res.json({ success: true, data: { message: `Test email sent to ${req.user.email}` } });
  else res.status(400).json({ success: false, error: 'SMTP not configured or send failed. Check server logs.' });
});

// ===== OAUTH CONFIG (admin only) =====

// GET /api/auth/oauth/config — get current OAuth settings (redacted secret)
router.get('/oauth/config', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const clientId = db.prepare("SELECT value FROM config WHERE key = 'google_client_id'").get();
  const clientSecret = db.prepare("SELECT value FROM config WHERE key = 'google_client_secret'").get();
  const enabled = db.prepare("SELECT value FROM config WHERE key = 'google_oauth_enabled'").get();

  res.json({
    success: true,
    data: {
      google_client_id: clientId ? clientId.value : '',
      google_client_secret_set: !!(clientSecret && clientSecret.value),
      google_oauth_enabled: enabled ? enabled.value === '1' : false
    }
  });
});

// PUT /api/auth/oauth/config — update OAuth settings
router.put('/oauth/config', requireAuth, requireRole('admin'), (req, res) => {
  const { google_client_id, google_client_secret, google_oauth_enabled } = req.body;
  const db = getDb();

  if (google_client_id !== undefined) {
    const existing = db.prepare("SELECT value FROM config WHERE key = 'google_client_id'").get();
    if (existing) {
      db.prepare("UPDATE config SET value = ? WHERE key = 'google_client_id'").run(google_client_id.trim());
    } else {
      db.prepare("INSERT INTO config (key, value) VALUES ('google_client_id', ?)").run(google_client_id.trim());
    }
  }

  if (google_client_secret !== undefined && google_client_secret !== '') {
    const existing = db.prepare("SELECT value FROM config WHERE key = 'google_client_secret'").get();
    if (existing) {
      db.prepare("UPDATE config SET value = ? WHERE key = 'google_client_secret'").run(google_client_secret.trim());
    } else {
      db.prepare("INSERT INTO config (key, value) VALUES ('google_client_secret', ?)").run(google_client_secret.trim());
    }
  }

  if (google_oauth_enabled !== undefined) {
    const val = google_oauth_enabled ? '1' : '0';
    const existing = db.prepare("SELECT value FROM config WHERE key = 'google_oauth_enabled'").get();
    if (existing) {
      db.prepare("UPDATE config SET value = ? WHERE key = 'google_oauth_enabled'").run(val);
    } else {
      db.prepare("INSERT INTO config (key, value) VALUES ('google_oauth_enabled', ?)").run(val);
    }
  }

  res.json({ success: true, data: { message: 'OAuth settings updated' } });
});

// ===== GOOGLE OAUTH FLOW =====

// In-memory state tokens (short-lived, 5 min TTL)
const oauthStates = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (now - val.created > 300000) oauthStates.delete(key);
  }
}, 60000);

// Helper: get OAuth config from DB
function getOAuthConfig() {
  const db = getDb();
  const clientId = db.prepare("SELECT value FROM config WHERE key = 'google_client_id'").get();
  const clientSecret = db.prepare("SELECT value FROM config WHERE key = 'google_client_secret'").get();
  const enabled = db.prepare("SELECT value FROM config WHERE key = 'google_oauth_enabled'").get();

  if (!enabled || enabled.value !== '1' || !clientId || !clientSecret) return null;
  return { clientId: clientId.value, clientSecret: clientSecret.value };
}

// GET /api/auth/oauth/status — public endpoint, tells frontend if Google OAuth is available
router.get('/oauth/status', (req, res) => {
  const config = getOAuthConfig();
  res.json({ success: true, data: { google_enabled: !!config } });
});

// GET /api/auth/google — initiate Google OAuth flow
router.get('/google', (req, res) => {
  const config = getOAuthConfig();
  if (!config) return res.status(400).json({ success: false, error: 'Google OAuth not configured' });

  const target = req.query.target || 'portal'; // 'portal' or 'admin'
  if (!['portal', 'admin'].includes(target)) {
    return res.status(400).json({ success: false, error: 'Invalid target' });
  }

  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { created: Date.now(), target });

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    access_type: 'online',
    prompt: 'select_account'
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback — Google redirects here
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/portal#/login?error=oauth_denied');
  }

  if (!state || !oauthStates.has(state)) {
    return res.redirect('/portal#/login?error=invalid_state');
  }

  const stateData = oauthStates.get(state);
  oauthStates.delete(state);
  const target = stateData.target;

  const config = getOAuthConfig();
  if (!config) {
    return res.redirect(`/${target}#/login?error=oauth_not_configured`);
  }

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('OAuth token exchange failed:', tokenData);
      return res.redirect(`/${target}#/login?error=token_exchange_failed`);
    }

    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userInfo = await userInfoRes.json();
    if (!userInfoRes.ok || !userInfo.email) {
      return res.redirect(`/${target}#/login?error=userinfo_failed`);
    }

    // Look up user by email
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(userInfo.email.toLowerCase());

    if (!user) {
      return res.redirect(`/${target}#/login?error=no_account`);
    }

    // Verify role matches target
    if (target === 'portal' && user.role !== 'client') {
      return res.redirect('/admin#/login?error=use_admin');
    }
    if (target === 'admin' && !['admin', 'staff'].includes(user.role)) {
      return res.redirect('/portal#/login?error=use_portal');
    }

    // Update user's Google info if not already linked
    const safeAlter = (sql) => { try { db._db.run(sql); } catch(e) {} };
    safeAlter('ALTER TABLE users ADD COLUMN google_id TEXT');
    safeAlter('ALTER TABLE users ADD COLUMN avatar_url TEXT');

    if (userInfo.id) {
      db.prepare("UPDATE users SET google_id = ?, avatar_url = ?, last_login_at = datetime('now') WHERE id = ?")
        .run(userInfo.id, userInfo.picture || null, user.id);
    }

    // Google is a second front door and it has to appear in the same log as the
    // first, or the auth trail reads as though nobody signed in that day.
    db.prepare('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    logAuthEvent(db, {
      userId: user.id, email: user.email, event: 'login_success',
      ip: req.clientIp || req.ip, userAgent: req.headers['user-agent'],
      detail: `${user.role} via Google`
    });
    if (user.role === 'admin' || user.role === 'staff') {
      try {
        allowIp({
          ip: req.clientIp || req.ip, reason: `Trusted after ${user.role} login (${user.email})`,
          source: 'auto', userId: user.id, minutes: 10080
        });
      } catch { /* never fail a login over a convenience rule */ }
    }

    // Issue JWT
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '24h' });

    // Redirect to frontend with token
    const tokenKey = target === 'portal' ? 'portal_token' : 'admin_token';
    res.send(`<!DOCTYPE html><html><head><title>Signing in...</title></head><body>
      <script>
        localStorage.setItem('${tokenKey}', '${token}');
        window.location.href = '/${target}';
      </script>
    </body></html>`);

  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`/${target}#/login?error=server_error`);
  }
});

module.exports = router;
