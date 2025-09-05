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

async function buildEmailHtml({ subject, contentHtml, itemsTableHtml, summaryRows }) {
  const s = await Settings.findOne().lean();
  const siteName = s?.general?.siteName || 'Trahi Mart';
  const contactEmail = s?.general?.contactEmail || '';
  const contactPhone = s?.general?.contactPhone || '';
  const address = s?.general?.address || '';
  const logo = s?.general?.siteLogo || 'https://res.cloudinary.com/dwjcuweew/image/upload/v1756881697/logo_di0afp.jpg';
  const siteUrl = s?.general?.siteUrl || 'https://trahimart.com/';
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
    .header{background:#f7ab18;color:#fff;padding:16px 20px;font-size:18px;font-weight:700;display:flex;align-items:center;gap:12px}
    .header img{height:28px;border-radius:4px}
    .content{padding:20px}
    .card-inner{background:#fff;border:1px solid #f2f2f2;border-radius:10px;overflow:hidden}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{padding:10px;border-bottom:1px solid #eee;text-align:left;font-size:14px}
    .table th{background:#fafafa;color:#555}
    .summary{margin-top:12px}
    .summary-row{display:flex;justify-content:space-between;margin:6px 0;color:#444}
    .summary-row.total{font-weight:700;color:#000}
    .footer{padding:16px 20px;color:#777;font-size:12px;border-top:1px solid #eee}
    .muted{color:#777}
    a.btn{display:inline-block;background:#f7ab18;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px}
    a{color:#f7ab18;text-decoration:none}
    ul{padding-left:18px}
  </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(siteName)}" />` : ''}<span>${escapeHtml(siteName)}</span></div>
        <div class="content">
          <div class="card-inner">
            <div style="padding:16px 16px 0;">${contentHtml || ''}</div>
            ${itemsTableHtml ? `<div style="padding:12px 16px 0;"><table class="table">${itemsTableHtml}</table></div>` : ''}
            ${summaryRows && summaryRows.length ? `<div class="summary" style="padding:0 16px 16px;">${summaryRows.map(r => `<div class="summary-row ${r.key==='Total'?'total':''}"><span>${escapeHtml(r.key)}</span><span>${escapeHtml(r.value)}</span></div>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="footer">
          <div>${escapeHtml(siteName)}</div>
          ${contactEmail ? `<div>Email: <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></div>` : ''}
          ${contactPhone ? `<div>Phone: <a href="tel:${escapeHtml(contactPhone)}">${escapeHtml(contactPhone)}</a></div>` : ''}
          ${address ? `<div class="muted">${escapeHtml(address)}</div>` : ''}
          ${siteUrl ? `<div><a href="${escapeHtml(siteUrl)}" target="_blank">${escapeHtml(siteUrl)}</a></div>` : ''}
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

