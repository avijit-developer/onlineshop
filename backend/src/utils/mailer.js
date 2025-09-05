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

async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const s = await Settings.findOne().lean();
  const fromEmail = s?.email?.email || process.env.SMTP_EMAIL;
  const info = await transporter.sendMail({ from: fromEmail, to, subject, text, html });
  return info;
}

module.exports = { sendMail };

