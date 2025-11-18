const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireAnyPermission, requirePermission } = require('../middleware/auth');
const Driver = require('../models/Driver');
const DriverUser = require('../models/DriverUser');
const Role = require('../models/Role');
const { sendMail, buildEmailHtml } = require('../utils/mailer');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Public: apply to become a driver
router.post('/apply', async (req, res) => {
  try {
    const { name, email, phone, address1, address2, city, zip, address, driverUserEmail, driverUserName } = req.body || {};
    const applicantEmail = String(email || '').trim().toLowerCase();
    if (!name || !applicantEmail || !phone) { res.status(400); throw new Error('name, email and phone are required'); }
    if (!isValidEmail(applicantEmail)) { res.status(400); throw new Error('Invalid email'); }

    const exists = await Driver.findOne({ email: applicantEmail }).lean();
    if (exists) { res.status(409); throw new Error('A driver with this email already exists'); }

    // Ensure phone is unique across customers, vendors and drivers
    const phoneNorm = String(phone || '').trim();
    if (phoneNorm) {
      const [userPhone, vendorPhone, driverPhone] = await Promise.all([
        User.findOne({ phone: phoneNorm }).lean(),
        Vendor.findOne({ phone: phoneNorm }).lean(),
        Driver.findOne({ phone: phoneNorm }).lean(),
      ]);
      if (userPhone || vendorPhone || driverPhone) {
        res.status(409);
        throw new Error('Phone number already in use');
      }
    }

    const created = await Driver.create({ name: String(name).trim(), email: applicantEmail, phone: String(phone).trim(), address1, address2, city, zip, address, status: 'pending', enabled: false });

    // Email notify
    try {
      const subject = 'Thank you for registering - awaiting admin approval';
      const contentHtml = `<p>Hi ${name || 'there'},</p><p>Thank you for registering as a driver.</p><p>Your application has been received and is <b>awaiting admin approval</b>. We will notify you once it is reviewed.</p>`;
      const html = await buildEmailHtml({ subject, contentHtml });
      await sendMail({ to: applicantEmail, subject, html });
      const duEmail = String(driverUserEmail || '').trim().toLowerCase();
      if (isValidEmail(duEmail) && duEmail !== applicantEmail) await sendMail({ to: duEmail, subject, html });
    } catch (_) {}

    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

// Admin: list drivers
router.get('/', authenticate, requireAnyPermission(['driver.view', 'driver.edit']), async (req, res) => {
  const { status = 'all', q = '', page = 1, limit = 10 } = req.query;
  const filters = {};
  if (status !== 'all') filters.status = status;
  if (q) filters.$or = [{ name: { $regex: String(q), $options: 'i' } }, { email: { $regex: String(q), $options: 'i' } }, { phone: { $regex: String(q), $options: 'i' } }];
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const [items, total] = await Promise.all([
    Driver.find(filters).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
    Driver.countDocuments(filters)
  ]);
  res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
});

// Admin: approve/reject driver
router.patch('/:id/status', authenticate, requirePermission('driver.approve'), async (req, res) => {
  const { id } = req.params; const { status } = req.body || {};
  if (!['pending','approved','rejected'].includes(status)) { res.status(400); throw new Error('Invalid status'); }
  const updated = await Driver.findByIdAndUpdate(id, { status, enabled: status === 'approved' }, { new: true }).lean();
  if (!updated) { res.status(404); throw new Error('Driver not found'); }

  // On approval, create or reset driver user and email creds
  try {
    if (status === 'approved') {
      let role = await Role.findOne({ name: 'Driver' }).lean();
      if (!role) role = (await Role.create({ name: 'Driver', description: 'Default driver role', permissions: ['driver.view'] })).toObject();
      const tempPassword = Math.random().toString(36).slice(-6) + Math.floor(1000 + Math.random() * 9000);
      let du = await DriverUser.findOne({ email: updated.email });
      if (!du) {
        du = await DriverUser.create({ name: updated.name, email: updated.email, passwordHash: await bcrypt.hash(String(tempPassword), 10), driver: updated._id });
      } else {
        du.passwordHash = await bcrypt.hash(String(tempPassword), 10);
        du.driver = updated._id;
        await du.save();
      }
      await DriverUser.updateOne({ _id: du._id }, { $set: { roleRef: role._id } }).catch(()=>{});
      // email creds
      try {
        const subject = 'Your driver account has been approved';
        const contentHtml = `<p>Hi ${updated.name || 'there'},</p><p>Your driver account has been <b>approved</b>.</p><ul><li><b>Username:</b> ${updated.email}</li><li><b>Password:</b> ${tempPassword}</li></ul>`;
        const html = await buildEmailHtml({ subject, contentHtml });
        await sendMail({ to: updated.email, subject, html });
      } catch(_) {}
    } else if (status === 'rejected') {
      try {
        const subject = 'Driver application not approved';
        const contentHtml = `<p>Hi ${updated.name || 'there'},</p><p>Your driver application has been <b>rejected</b>.</p>`;
        const html = await buildEmailHtml({ subject, contentHtml });
        await sendMail({ to: updated.email, subject, html });
      } catch(_) {}
    }
  } catch(_) {}
  res.json({ success: true, data: updated });
});

// Admin: enable/disable driver
router.patch('/:id/enable', authenticate, requirePermission('driver.edit'), async (req, res) => {
  const { id } = req.params; const { enabled } = req.body || {};
  const updated = await Driver.findByIdAndUpdate(id, { enabled: !!enabled }, { new: true }).lean();
  if (!updated) { res.status(404); throw new Error('Driver not found'); }
  res.json({ success: true, data: updated });
});

module.exports = router;


