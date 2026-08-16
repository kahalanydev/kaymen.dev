#!/usr/bin/env node
/* ============================================================================
   Render every outbound email to one HTML page, without sending anything.

     node scripts/preview-emails.js            → mockup/email-preview.html
     node scripts/preview-emails.js out.html

   Outbound email is the only surface in this repo you cannot look at by
   opening a URL — the alternative is configuring SMTP and mailing yourself
   six times, which is why the templates drifted a whole palette behind the
   site in the first place.

   This goes through the REAL functions in server/utils/email.js. Only two
   things are stubbed, both at the very edge: the config lookup (so SMTP counts
   as configured) and nodemailer's transport (so the message is captured
   instead of sent). Everything in between — escaping, the wrapper, the
   templates, the text/plain alternative — is the code that runs in production.

   The contact sample deliberately carries a <script> tag. If it ever renders
   as anything other than literal text, esc() has been broken.
   ============================================================================ */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'mockup', 'email-preview.html');

/* --- stub 1: the config read. Must be patched before email.js is required,
       because it destructures getDb at module load. --------------------------- */
const SMTP = {
  smtp_host: 'smtp.example.net', smtp_port: '587', smtp_user: 'u',
  smtp_pass: 'p', smtp_from: '"kaymen.dev" <hello@kaymen.dev>',
};
const dbmod = require(path.join(ROOT, 'server/db.js'));
dbmod.getDb = () => ({
  prepare: () => ({ get: (key) => (SMTP[key] !== undefined ? { value: SMTP[key] } : undefined) }),
});

/* --- stub 2: the transport --------------------------------------------------- */
const captured = [];
const nodemailer = require('nodemailer');
nodemailer.createTransport = () => ({
  sendMail: async (message) => { captured.push(message); return {}; },
});

const mail = require(path.join(ROOT, 'server/utils/email.js'));

const SAMPLES = [
  () => mail.sendWelcomeEmail({
    email: 'client@example.org', name: 'Yitzchok Berger', role: 'client',
    inviteUrl: 'https://kaymen.dev/portal#/invite/TOKEN',
    projectName: 'Community lending ledger',
  }),
  () => mail.sendWelcomeEmail({
    email: 'staff@kaymen.dev', name: 'Shifra Gold', role: 'staff',
    inviteUrl: 'https://kaymen.dev/admin#/invite/TOKEN',
  }),
  () => mail.sendPasswordResetEmail({
    email: 'client@example.org', name: 'Yitzchok Berger',
    inviteUrl: 'https://kaymen.dev/portal#/reset/TOKEN',
  }),
  () => mail.sendTicketNotification({
    adminEmails: ['ohav@kaymen.dev'], projectName: 'Community lending ledger',
    ticketNumber: 12, title: 'Lender statement shows the pre-correction fund total',
    type: 'bug', priority: 'urgent', createdBy: 'Yitzchok Berger',
    ticketUrl: 'https://kaymen.dev/admin#/tickets/ID',
    description: 'The per-lender statement I sent to the trustees still totals $1,633,917.56. '
      + 'The dashboard says $1,586,533.86. Which one do I give them?',
  }),
  () => mail.sendTicketNotification({
    adminEmails: ['ohav@kaymen.dev'], projectName: 'Bilingual booking platform',
    ticketNumber: 8, title: 'Add a Hebrew SMS reminder 24h before the session',
    type: 'feature_request', priority: 'medium', createdBy: 'Meira Adler',
    ticketUrl: 'https://kaymen.dev/admin#/tickets/ID',
  }),
  () => mail.sendTicketResolvedEmail({
    clientEmails: ['client@example.org'], projectName: 'Community lending ledger',
    ticketNumber: 12, title: 'Lender statement shows the pre-correction fund total',
    clientMessage: 'The statement was still totalling money-in while the dashboard had moved to '
      + 'what the fund actually holds. Both now read from the same figure, so a statement and the '
      + 'dashboard cannot disagree again. The one you sent the trustees was the old number — a '
      + 'corrected copy is in the portal.',
    portalUrl: 'https://kaymen.dev/portal',
  }),
  () => mail.sendContactNotification({
    to: 'hello@kaymen.dev', name: 'Rivka <script>alert(1)</script> Stein',
    email: 'rivka@example.org', projectName: 'Volunteer scheduling',
    message: 'We run about 40 volunteers across four programmes on a WhatsApp group and a Google Sheet.\n\n'
      + 'Nobody knows who is covering Sunday until Sunday.',
  }),
  () => mail.sendSmtpTestEmail({ to: 'ohav@kaymen.dev' }),
];

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

(async () => {
  const quiet = console.log;
  console.log = () => {};                       // the [EMAIL] Sent lines are noise here
  for (const run of SAMPLES) await run();
  console.log = quiet;

  let problems = 0;
  captured.forEach((m) => {
    if (/<script/i.test(m.html)) { console.error(`  !! unescaped <script> in "${m.subject}"`); problems++; }
    if (!m.text) { console.error(`  !! no text/plain part on "${m.subject}"`); problems++; }
  });

  const cards = captured.map((m) => `
    <div class="slot">
      <div class="hd"><b>${escAttr(m.subject)}</b><code>text/plain: ${m.text ? m.text.length + ' bytes' : 'MISSING'}</code></div>
      ${m.html.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '')}
    </div>`).join('');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>kaymen.dev — outbound email preview</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:#e8eaee;font-family:Inter,-apple-system,sans-serif}
  .grid{display:grid;gap:0}
  @media (min-width:1000px){.grid{grid-template-columns:1fr 1fr}}
  .hd{padding:11px 22px;background:#fff;border-bottom:1px solid #e2e4e8;display:flex;
      align-items:center;justify-content:space-between;gap:14px}
  .hd b{font-size:12px;font-weight:600;color:#1a1b1e}
  .hd code{font:600 10.5px ui-monospace,Consolas,monospace;color:#5f6368;background:#f4f5f7;
      padding:2px 7px;border-radius:6px;white-space:nowrap}
  .slot{border-bottom:1px solid #d7dae0}
</style></head>
<body><div class="grid">${cards}</div></body></html>`);

  console.log(`${captured.length} emails → ${OUT}`);
  if (problems) { console.error(`${problems} problem(s) found.`); process.exit(1); }
})();
