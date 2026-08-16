const nodemailer = require('nodemailer');
const { getDb } = require('../db');

function getSmtpConfig() {
  const db = getDb();
  const get = (key) => {
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
    return row ? row.value : '';
  };

  const host = get('smtp_host');
  const port = get('smtp_port');
  const user = get('smtp_user');
  const pass = get('smtp_pass');
  const from = get('smtp_from');

  if (!host || !port || !user || !pass || !from) return null;
  return { host, port: parseInt(port), user, pass, from };
}

async function sendEmail({ to, subject, html }) {
  const config = getSmtpConfig();
  if (!config) {
    console.log(`[EMAIL] SMTP not configured — would have sent "${subject}" to ${to}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass }
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html
    });
    console.log(`[EMAIL] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    return false;
  }
}

// Shared email wrapper.
//
// STILL THE OLD THEME — #09090b bg, #3b82f6 accent blue, JetBrains Mono. The
// wordmark says kaymen but the palette is the one the site dropped in the
// 2026-08-15 redesign, so every invite, reset and ticket notification a client
// receives looks like a different company than the site they just visited.
// Deliberately left for the admin/portal reimagining rather than re-skinned
// twice — it is the same design problem as those two surfaces.
function emailWrapper(innerHtml) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#09090b;color:#e4e4e7;border-radius:12px;border:1px solid #232329">
      <div style="text-align:center;margin-bottom:28px">
        <div style="font-size:24px;font-weight:700;font-family:'JetBrains Mono',Consolas,monospace;margin:0">
          <span style="color:#71717a">{</span> <span style="color:#e4e4e7">kaymen</span><span style="color:#3b82f6">.</span><span style="color:#e4e4e7">dev</span> <span style="color:#71717a">}</span>
        </div>
      </div>
      ${innerHtml}
    </div>
  `;
}

function sendWelcomeEmail({ email, name, role, inviteUrl }) {
  const displayName = name || email;
  const portalLabel = role === 'client' ? 'Client Portal' : 'Admin Panel';

  return sendEmail({
    to: email,
    subject: `You've been invited to kaymen.dev ${portalLabel}`,
    html: emailWrapper(`
      <p style="color:#a1a1aa;font-size:13px;text-align:center;margin:-16px 0 24px">${portalLabel}</p>
      <p>Hi ${displayName},</p>
      <p>You've been invited to the <strong style="color:#fff">${portalLabel}</strong>. Click the button below to set up your password and get started:</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${inviteUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Accept Invitation</a>
      </div>
      <p style="color:#71717a;font-size:13px">This link expires in 7 days.</p>
      <p style="color:#52525b;font-size:12px;margin-top:24px;border-top:1px solid #232329;padding-top:16px">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    `)
  });
}

function sendPasswordResetEmail({ email, name, inviteUrl }) {
  const displayName = name || email;

  return sendEmail({
    to: email,
    subject: 'Your kaymen.dev password has been reset',
    html: emailWrapper(`
      <p>Hi ${displayName},</p>
      <p>Your password has been reset. Click below to set a new password:</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${inviteUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Set New Password</a>
      </div>
      <p style="color:#71717a;font-size:13px">This link expires in 7 days.</p>
    `)
  });
}

function sendTicketNotification({ adminEmails, projectName, ticketNumber, title, type, priority, createdBy, ticketUrl }) {
  const priorityColors = { low: '#71717a', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };
  const priorityColor = priorityColors[priority] || '#3b82f6';

  const promises = adminEmails.map(email => sendEmail({
    to: email,
    subject: `[${projectName}] New ticket #${ticketNumber}: ${title}`,
    html: emailWrapper(`
      <p style="color:#a1a1aa;font-size:13px;text-align:center;margin:-16px 0 24px">New Ticket</p>
      <p style="margin-bottom:20px"><strong style="color:#fff">${createdBy}</strong> opened a new ticket in <strong style="color:#fff">${projectName}</strong>:</p>
      <div style="background:#18181b;border:1px solid #232329;border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-size:16px;font-weight:600;color:#fff;margin-bottom:8px">#${ticketNumber} — ${title}</div>
        <div style="display:flex;gap:12px;font-size:12px">
          <span style="color:#a1a1aa">Type: <span style="color:#e4e4e7">${type}</span></span>
          <span style="color:#a1a1aa">Priority: <span style="color:${priorityColor};font-weight:600">${priority.toUpperCase()}</span></span>
        </div>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${ticketUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Ticket</a>
      </div>
    `)
  }));

  return Promise.allSettled(promises);
}

function sendTicketResolvedEmail({ clientEmails, projectName, ticketNumber, title, clientMessage, portalUrl }) {
  const promises = clientEmails.map(email => sendEmail({
    to: email,
    subject: `[${projectName}] Ticket #${ticketNumber} resolved: ${title}`,
    html: emailWrapper(`
      <p style="color:#a1a1aa;font-size:13px;text-align:center;margin:-16px 0 24px">Ticket Resolved</p>
      <p style="margin-bottom:20px">A ticket in <strong style="color:#fff">${projectName}</strong> has been resolved:</p>
      <div style="background:#18181b;border:1px solid #232329;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-size:15px;font-weight:600;color:#fff;margin-bottom:4px">#${ticketNumber} — ${title}</div>
        <div style="font-size:11px;color:#22c55e;font-weight:600;margin-bottom:12px">RESOLVED</div>
        <div style="color:#a1a1aa;font-size:13px;line-height:1.6;border-top:1px solid #232329;padding-top:12px">
          <strong style="color:#e4e4e7">Development Team:</strong><br>
          ${clientMessage}
        </div>
      </div>
      ${portalUrl ? `
      <div style="text-align:center;margin:24px 0">
        <a href="${portalUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View in Portal</a>
      </div>
      ` : ''}
      <p style="color:#52525b;font-size:12px;margin-top:20px;border-top:1px solid #232329;padding-top:16px">
        If this doesn't fully resolve your issue, you can open a new ticket from the portal.
      </p>
    `)
  }));

  return Promise.allSettled(promises);
}

module.exports = { sendEmail, sendWelcomeEmail, sendPasswordResetEmail, sendTicketNotification, sendTicketResolvedEmail, getSmtpConfig, emailWrapper };
