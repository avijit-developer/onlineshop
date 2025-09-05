const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const s = await Settings.findOne().lean();
  const email = s?.email?.email || process.env.SMTP_EMAIL || '';
  const pass = s?.email?.appPassword || process.env.SMTP_APP_PASSWORD || '';
  if (!email || !pass) throw new Error('SMTP not configured');
  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass }
  });
  return cachedTransporter;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function buildEmailHtml({ subject, contentHtml }) {
  const s = await Settings.findOne().lean();
  const siteName = s?.general?.siteName || 'Trahi Mart';
  const contactEmail = s?.general?.contactEmail || '';
  const contactPhone = s?.general?.contactPhone || '';
  const address = s?.general?.address || '';
  const safeSubject = escapeHtml(subject || siteName);
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeSubject}</title>
  <style>
    body{margin:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#333}
    .container{max-width:640px;margin:0 auto;padding:24px}
    .card{background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden}
    .header{background:#f7ab18;color:#fff;padding:16px 20px;font-size:18px;font-weight:700}
    .content{padding:20px}
    .footer{padding:16px 20px;color:#777;font-size:12px}
    .muted{color:#777}
    a.btn{display:inline-block;background:#f7ab18;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px}
    ul{padding-left:18px}
  </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">${escapeHtml(siteName)}</div>
        <div class="content">
          ${contentHtml || ''}
        </div>
        <div class="footer">
          <div>${escapeHtml(siteName)}</div>
          ${contactEmail ? `<div>Email: ${escapeHtml(contactEmail)}</div>` : ''}
          ${contactPhone ? `<div>Phone: ${escapeHtml(contactPhone)}</div>` : ''}
          ${address ? `<div class="muted">${escapeHtml(address)}</div>` : ''}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const s = await Settings.findOne().lean();
  const fromEmail = s?.email?.email || process.env.SMTP_EMAIL;
  const info = await transporter.sendMail({ from: fromEmail, to, subject, text, html });
  return info;
}

module.exports = { sendMail, buildEmailHtml };

