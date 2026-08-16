const nodemailer = require('nodemailer');
const { getDb } = require('../db');

/* ============================================================================
   Outbound email — the kaymen.dev skin
   ----------------------------------------------------------------------------
   Ported from mockup/back-office.html (2026-08-16). Values are the locked ones
   from styles.css: #16303d masthead, #2bbcb3 accent, #1a1b1e ink, #5f6368
   muted, #e2e4e8 rules, #f4f5f7 panels.

   Three constraints shape everything below, and none of them are style calls:

   1. Sora will not load in Outlook, the Gmail app or Yahoo. Every heading falls
      back to the system sans, so the design leans on size, weight and the dark
      masthead rather than on the face. Never let a heading carry meaning that
      only survives in Sora.
   2. Dark-mode clients auto-invert a white card. #16303d survives that; the
      body does not, so the card is kept plain and high-contrast rather than
      tinted.
   3. Gmail strips <style> and ignores flexbox and custom properties. Tables and
      inline styles only — that is why this file looks like 2004.

   Everything user-supplied goes through esc(). A contact-form submitter
   controls name, project and message, and those land in Ohav's inbox.
   ============================================================================ */

const C = {
  deep:   '#16303d',
  accent: '#2bbcb3',
  ink:    '#1a1b1e',
  muted:  '#5f6368',
  faint:  '#8b9096',
  line:   '#e2e4e8',
  panel:  '#f4f5f7',
  stage:  '#e8eaee',
  onDeep: '#7fb3ad',   // the muted teal that reads on the masthead
  alert:  '#b8443c',
  onAlert:'#e8908a',   // alert, lightened enough to read on the masthead
  warn:   '#a8761c',
};
const F_DISPLAY = "'Sora',-apple-system,'Segoe UI',Roboto,sans-serif";
const F_BODY = "-apple-system,'Segoe UI',Roboto,sans-serif";

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped, with newlines preserved — for anything a human typed in a textarea. */
function escMultiline(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}

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

async function sendEmail({ to, subject, html, text }) {
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
    // A text/plain alternative is not decoration — an HTML-only invite is a
    // spam signal, and the invite is the first thing a new client ever gets.
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
      text: text || undefined
    });
    console.log(`[EMAIL] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    return false;
  }
}

/* ------------------------------------------------------------------ pieces
   Small builders so the route files stay short and cannot drift from the
   skin. Each returns a table row or an inline-styled block. */

/** A heading in the display face, with the fallback doing the real work. */
function emailHeading(text, size) {
  return `<div style="font-family:${F_DISPLAY};font-size:${size || 22}px;font-weight:700;letter-spacing:-.035em;line-height:1.2;color:${C.ink};margin:0 0 14px">${text}</div>`;
}

function emailText(html, opts) {
  const o = opts || {};
  return `<p style="font-family:${F_BODY};font-size:${o.size || 14.5}px;line-height:1.65;color:${C.muted};margin:0 0 ${o.gap === undefined ? 14 : o.gap}px">${html}</p>`;
}

/** Bold that stays legible when a dark-mode client inverts the card. */
function emailStrong(text) {
  return `<b style="color:${C.ink}">${text}</b>`;
}

/** The accent appears exactly once per email, and this is it. */
function emailButton(href, label, note) {
  return `
    <a href="${esc(href)}" style="display:inline-block;background:${C.accent};color:#ffffff;padding:13px 30px;border-radius:11px;text-decoration:none;font-family:${F_BODY};font-weight:600;font-size:14.5px">${label}</a>
    ${note ? `<div style="font-family:${F_BODY};font-size:12px;color:${C.faint};margin-top:14px">${note}</div>` : ''}`;
}

/** The quoted block — a left rule in one of the three tones, never a fill. */
function emailPanel(innerHtml, tone) {
  const edge = tone === 'alert' ? C.alert : tone === 'warn' ? C.warn : C.accent;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.panel};border-radius:11px">
      <tr><td style="padding:16px 18px;border-left:3px solid ${edge};border-radius:11px">${innerHtml}</td></tr>
    </table>`;
}

/**
 * The shell every email shares.
 *
 * Second argument is optional, so the single-argument calls that already exist
 * in server/routes/admin.js keep working unchanged.
 *
 * opts.eyebrow — a line under the wordmark ("Client portal")
 * opts.flag    — a word at the masthead's right edge ("Urgent", "Fixed")
 * opts.tone    — 'alert' | 'ok', colours the flag
 * opts.footer  — fine print below a hairline
 */
function emailWrapper(innerHtml, opts) {
  const o = opts || {};
  const flagColor = o.tone === 'alert' ? C.onAlert : C.onDeep;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${C.stage}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.stage}">
  <tr><td align="center" style="padding:24px 14px">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(22,48,61,.10)">

      <tr><td style="background:${C.deep};padding:${o.eyebrow ? '26px 32px 24px' : '22px 32px 20px'}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="41" style="padding-right:11px">
            <!-- A hosted PNG, not the inline SVG the site uses: Outlook renders through Word,
                 which does not draw SVG at all, and a CSS background-image is stripped by
                 Gmail. Served at 2x and scaled down so it stays sharp on retina. If images
                 are blocked the alt text carries the name, which is why it reads as the
                 brand rather than as "logo". -->
            <img src="https://kaymen.dev/assets/brand/email-mark.png" width="30" height="30" alt="kaymen.dev"
                 style="display:block;width:30px;height:30px;border:0;border-radius:9px;outline:none;text-decoration:none">
          </td>
          <td style="font-family:${F_DISPLAY};font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-.02em">kaymen<span style="color:${C.accent}">.</span>dev</td>
          ${o.flag ? `<td align="right" style="font-family:${F_BODY};font-size:10.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:${flagColor}">${esc(o.flag)}</td>` : ''}
        </tr></table>
        ${o.eyebrow ? `<div style="font-family:${F_BODY};font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:${C.onDeep};margin-top:18px">${esc(o.eyebrow)}</div>` : ''}
      </td></tr>

      <tr><td style="padding:28px 32px 26px">${innerHtml}</td></tr>

      ${o.footer ? `<tr><td style="padding:16px 32px 22px;border-top:1px solid ${C.line};font-family:${F_BODY};font-size:11.5px;color:${C.faint};line-height:1.6">${o.footer}</td></tr>` : ''}

    </table>

  </td></tr>
</table>
</body></html>`;
}

/* ------------------------------------------------------------- the templates */

function sendWelcomeEmail({ email, name, role, inviteUrl, projectName }) {
  const displayName = esc(name || email);
  const isClient = role === 'client';
  const portalLabel = isClient ? 'Client portal' : 'Admin panel';
  const project = projectName ? esc(projectName) : null;

  const lede = isClient
    ? `Hi ${displayName} — ${project ? `the portal for ${emailStrong(project)}` : 'your project portal'} is ready. You can see where the build has got to, read the plan, and tell us when something is wrong.`
    : `Hi ${displayName} — you have been given access to the kaymen.dev admin panel.`;

  return sendEmail({
    to: email,
    // The org/project-specific subject is the one that gets opened, so prefer
    // it whenever the caller knows the project (the bootstrap flow does).
    subject: project
      ? `Your ${projectName} project portal is ready`
      : `You've been invited to kaymen.dev — ${portalLabel}`,
    text:
      `${isClient ? 'Your project is set up.' : 'Your admin access is ready.'}\n\n` +
      `${name || email} — set a password and it is yours:\n${inviteUrl}\n\n` +
      `This link expires in 7 days. If you were not expecting this, ignore it — nothing happens until you set a password.`,
    html: emailWrapper(
      emailHeading(isClient ? 'Your project is set up.' : 'Your admin access is ready.') +
      emailText(lede) +
      emailText('Set a password and it is yours.', { gap: 22 }) +
      emailButton(inviteUrl, 'Set your password', 'This link expires in 7 days.'),
      {
        eyebrow: portalLabel,
        footer: isClient
          ? 'The code lives in your account, the servers are in your name, and you can export your data any time you ask. If you were not expecting this, ignore it — nothing happens until you set a password.'
          : 'If you were not expecting this, ignore it — nothing happens until you set a password.'
      }
    )
  });
}

function sendPasswordResetEmail({ email, name, inviteUrl }) {
  const displayName = esc(name || email);

  return sendEmail({
    to: email,
    subject: 'Your kaymen.dev password has been reset',
    text:
      `Set a new password.\n\n${name || email} — your password was reset by an administrator. ` +
      `This link works once and expires in 7 days:\n${inviteUrl}\n\n` +
      `If you did not ask for this and did not expect an administrator to, reply to this email — do not use the link.`,
    html: emailWrapper(
      emailHeading('Set a new password.', 21) +
      emailText(`Hi ${displayName} — your password was reset by an administrator. This link works once and expires in 7 days.`, { size: 14, gap: 22 }) +
      emailButton(inviteUrl, 'Set new password'),
      { footer: 'If you did not ask for this and did not expect an administrator to, reply to this email — do not use the link.' }
    )
  });
}

function sendTicketNotification({ adminEmails, projectName, ticketNumber, title, type, priority, createdBy, ticketUrl, description }) {
  const pri = String(priority || 'medium');
  const tone = pri === 'urgent' || pri === 'high' ? 'alert' : 'ok';
  const num = esc(ticketNumber);
  const safeTitle = esc(title);
  const safeProject = esc(projectName);

  const promises = adminEmails.map((email) => sendEmail({
    to: email,
    subject: `[${projectName}] New ticket #${ticketNumber}: ${title}`,
    text:
      `${createdBy} opened a ticket in ${projectName}.\n\n` +
      `#${ticketNumber} — ${title}\n${type} · ${pri}\n\n` +
      `${description ? description + '\n\n' : ''}${ticketUrl}`,
    html: emailWrapper(
      emailText(`${emailStrong(esc(createdBy))} opened a ticket in ${emailStrong(safeProject)}.`, { size: 13.5, gap: 16 }) +
      emailPanel(
        `<div style="font-family:${F_DISPLAY};font-size:15.5px;font-weight:700;letter-spacing:-.02em;line-height:1.3;color:${C.ink}">#${num} — ${safeTitle}</div>
         <div style="font-family:${F_BODY};font-size:12px;color:${C.muted};margin-top:9px">${esc(type)} · ${esc(pri)}</div>`,
        tone
      ) +
      (description
        ? `<div style="font-family:${F_BODY};font-size:13.5px;line-height:1.65;color:${C.muted};margin-top:16px">${escMultiline(description)}</div>`
        : '') +
      `<div style="margin-top:22px">${emailButton(ticketUrl, 'Open ticket')}</div>`,
      { flag: pri === 'urgent' ? 'Urgent' : pri === 'high' ? 'High' : 'New ticket', tone }
    )
  }));

  return Promise.allSettled(promises);
}

function sendTicketResolvedEmail({ clientEmails, projectName, ticketNumber, title, clientMessage, portalUrl }) {
  const safeTitle = esc(title);
  const num = esc(ticketNumber);

  const promises = clientEmails.map((email) => sendEmail({
    to: email,
    subject: `[${projectName}] Ticket #${ticketNumber} resolved: ${title}`,
    text:
      `That is fixed.\n\n#${ticketNumber} — ${title}\n\n${clientMessage}\n\n` +
      `${portalUrl ? portalUrl + '\n\n' : ''}Not right yet? Reply here, or open another ticket from the portal.`,
    html: emailWrapper(
      emailHeading('That is fixed.', 21) +
      emailText(emailStrong(`#${num} — ${safeTitle}`), { size: 14, gap: 16 }) +
      emailPanel(
        `<div style="font-family:${F_BODY};font-size:13.5px;line-height:1.65;color:${C.muted}">${escMultiline(clientMessage)}</div>`
      ) +
      (portalUrl ? `<div style="margin-top:22px">${emailButton(portalUrl, 'See it in the portal', 'Not right yet? Reply here, or open another ticket from the portal.')}</div>` : ''),
      { flag: 'Fixed' }
    )
  }));

  return Promise.allSettled(promises);
}

/**
 * A new lead from the contact form. Goes to us, not to a client — but it is
 * the one email whose body is written entirely by a stranger, so every field
 * is escaped and the message keeps its line breaks.
 */
function sendContactNotification({ to, name, email, projectName, message }) {
  const safeName = esc(name);

  return sendEmail({
    to,
    subject: `New project inquiry from ${name}${projectName ? ` — ${projectName}` : ''}`,
    text: `${name} <${email}>\n${projectName ? projectName + '\n' : ''}\n${message}`,
    html: emailWrapper(
      emailHeading('New lead.', 21) +
      emailPanel(
        `<div style="font-family:${F_DISPLAY};font-size:15px;font-weight:700;letter-spacing:-.02em;color:${C.ink}">${safeName}</div>
         <div style="font-family:${F_BODY};font-size:12.5px;margin-top:6px">
           <a href="mailto:${esc(email)}" style="color:${C.accent};text-decoration:none;font-weight:600">${esc(email)}</a>
           ${projectName ? `<span style="color:${C.muted}"> · ${esc(projectName)}</span>` : ''}
         </div>`
      ) +
      `<div style="font-family:${F_BODY};font-size:13.5px;line-height:1.7;color:${C.muted};margin-top:18px">${escMultiline(message)}</div>`,
      { flag: 'Lead' }
    )
  });
}

/** Sent to the admin who pressed the button in Settings. Proves the pipe works. */
function sendSmtpTestEmail({ to }) {
  return sendEmail({
    to,
    subject: 'kaymen.dev — SMTP test',
    text: 'SMTP is working. Your outbound email configuration is correct.',
    html: emailWrapper(
      emailHeading('SMTP is working.', 21) +
      emailText('This is a test from Settings → Integrations. Your outbound configuration is correct, and this is what every invite, reset and notification will look like.', { size: 14, gap: 0 }),
      { flag: 'Test' }
    )
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTicketNotification,
  sendTicketResolvedEmail,
  sendContactNotification,
  sendSmtpTestEmail,
  getSmtpConfig,
  emailWrapper,
  emailHeading,
  emailText,
  emailStrong,
  emailButton,
  emailPanel,
  esc,
  escMultiline,
};
