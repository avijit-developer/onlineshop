const express = require('express');
const mongoose = require('mongoose');
const { authenticate, requireAdmin, requireRole, requireAnyPermission, requirePermission } = require('../middleware/auth');
const Vendor = require('../models/Vendor');
const router = express.Router();
const VendorUser = require('../models/VendorUser');
const Role = require('../models/Role');
const bcrypt = require('bcryptjs');
const { sendMail, buildEmailHtml } = require('../utils/mailer');
// Public: customer can submit vendor application (creates pending vendor)
// Make public for app submission; if logged in, we still accept and use req.user when present
router.post('/apply', async (req, res) => {
  try {
    // Allow anonymous or logged-in customer/vendor to apply
    if (req.user && (req.user.role !== 'customer' && req.user.role !== 'vendor')) {
      res.status(403);
      throw new Error('Not allowed');
    }
    const {
      name,
      companyName,
      phone,
      email,
      address1,
      address2,
      city,
      zip,
      address,
      commission,
      useExistingVendorUser,
      vendorUserEmail,
      vendorUserName,
      vendorUserPassword
    } = req.body || {};

    const applicantEmail = (email || req.user.email || '').trim().toLowerCase();
    if (!companyName || !applicantEmail || !phone) {
      res.status(400);
      throw new Error('companyName, email and phone are required');
    }
    if (!isValidEmail(applicantEmail)) {
      res.status(400);
      throw new Error('Invalid email format');
    }

    const exists = await Vendor.findOne({ email: applicantEmail }).lean();
    if (exists) {
      res.status(409);
      throw new Error('A vendor with this email already exists');
    }

    // Removed pre-validation for creating vendor user; account will be created on approval

    const created = await Vendor.create({
      name: String(name || req.user?.name || '').trim() || 'Applicant',
      companyName: String(companyName).trim(),
      email: applicantEmail,
      phone: String(phone).trim(),
      address1: address1 ? String(address1).trim() : '',
      address2: address2 ? String(address2).trim() : '',
      city: city ? String(city).trim() : '',
      zip: zip ? String(zip).trim() : '',
      address: address ? String(address).trim() : '',
      commission: commission !== undefined ? Number(commission) : undefined,
      status: 'pending',
      enabled: false
    });

    // Handle vendor user association/creation logic
    const wantsExisting = String(useExistingVendorUser || '').toLowerCase() === 'true' || useExistingVendorUser === true;
    if (wantsExisting) {
      const vuEmail = String(vendorUserEmail || '').trim().toLowerCase();
      if (!isValidEmail(vuEmail)) {
        res.status(400);
        throw new Error('Valid vendor user email is required when using existing vendor user');
      }
      let vu = await VendorUser.findOne({ email: vuEmail });
      if (vu) {
        // assign vendor to existing vendor user
        vu.vendors = Array.from(new Set([...(vu.vendors || []), created._id]));
        if (!vu.vendor) vu.vendor = created._id; // legacy single vendor field if empty
        await vu.save();
      } else {
        // do not create new vendor user at application time; will be created on approval
      }
    } else {
      // NO to using existing vendor user: ensure we create/assign a vendor user if email provided
      const vuEmail = String(vendorUserEmail || '').trim().toLowerCase();
      if (isValidEmail(vuEmail)) {
        let vu = await VendorUser.findOne({ email: vuEmail });
        if (vu) {
          // Assign the newly created vendor to this user
          vu.vendors = Array.from(new Set([...(vu.vendors || []), created._id]));
          if (!vu.vendor) vu.vendor = created._id; // legacy single vendor field if empty
          await vu.save();
        } else {
          // do not create new vendor user at application time; will be created on approval
        }
      }
    }

    // Notify applicant (and optional vendor user) via email (best-effort)
    try {
      const subject = 'Thank you for registering - awaiting admin approval';
      const contentHtml = `<p>Hi ${name || 'there'},</p><p>Thank you for registering your business <b>${companyName}</b>.</p><p>Your application has been received and is <b>awaiting admin approval</b>. We will notify you once it is reviewed.</p>`;
      const html = await buildEmailHtml({ subject, contentHtml });
      await sendMail({ to: applicantEmail, subject, html });
      const vuEmail = String(vendorUserEmail || '').trim().toLowerCase();
      if (isValidEmail(vuEmail) && vuEmail !== applicantEmail) {
        await sendMail({ to: vuEmail, subject, html });
      }
    } catch (_) {}

    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /vendors/me (vendor user)
router.get('/me', authenticate, requireRole(['vendor']), async (req, res) => {
  const v = await Vendor.findById(req.user.vendorId).lean();
  if (!v) { res.status(404); throw new Error('Vendor not found'); }
  res.json({ success: true, data: v });
});

// GET /vendors?status=&q=&page=&limit=
router.get('/', authenticate, requireAnyPermission(['vendor.view', 'vendor.edit']), async (req, res) => {
  console.log('Vendors GET request - User:', req.user);
  console.log('Vendors GET request - User permissions:', req.user.permissions);
  
  const { status = 'all', q = '', page = 1, limit = 10 } = req.query;
  const filters = {};
  
  // If user is a vendor, only show their own vendor information
  if (req.user.role === 'vendor') {
    const vendorIds = Array.isArray(req.user.vendors) && req.user.vendors.length > 0
      ? req.user.vendors
      : (req.user.vendorId ? [req.user.vendorId] : []);
    if (vendorIds.length > 0) {
      filters._id = { $in: vendorIds.map(id => new mongoose.Types.ObjectId(id)) };
    } else {
      // No vendors associated; return empty
      filters._id = { $in: [] };
    }
    console.log('Vendor user - filtering to own vendors:', vendorIds);
  }
  
  if (status !== 'all') filters.status = status;
  if (q) {
    filters.$or = [
      { companyName: { $regex: String(q), $options: 'i' } },
      { email: { $regex: String(q), $options: 'i' } },
      { phone: { $regex: String(q), $options: 'i' } }
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  console.log('Final filters applied:', JSON.stringify(filters, null, 2));

  const [items, total] = await Promise.all([
    Vendor.find(filters)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
    Vendor.countDocuments(filters)
  ]);

  console.log('Query results - items count:', items.length);
  console.log('Query results - total count:', total);
  console.log('Query results - items:', items.map(item => ({ id: item._id, companyName: item.companyName })));

  res.json({ success: true, data: items, meta: { total, page: pageNum, limit: perPage } });
});

// POST /vendors (accepts direct upload fields imageUrl/imagePublicId for logo)
router.post('/', authenticate, requirePermission('vendor.add'), async (req, res) => {
  const { name, companyName, email, phone, address1, address2, city, zip, address, commission, imageUrl, imagePublicId } = req.body || {};
  if (!name || !companyName || !email || !phone || !address1 || !city || !zip) {
    res.status(400);
    throw new Error('name, companyName, email, phone, address1, city and zip are required');
  }
  if (!isValidEmail(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const exists = await Vendor.findOne({ email: email.trim().toLowerCase() }).lean();
  if (exists) {
    res.status(409);
    throw new Error('Vendor with this email already exists');
  }

  const created = await Vendor.create({
    name: String(name).trim(),
    companyName: String(companyName).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    address1: String(address1).trim(),
    address2: address2 ? String(address2).trim() : '',
    city: String(city).trim(),
    zip: String(zip).trim(),
    address: address ? String(address).trim() : '',
    commission: commission !== undefined ? Number(commission) : undefined,
    logo: imageUrl || '',
    logoPublicId: imagePublicId || ''
  });

  // If the user creating the vendor is a vendor user, automatically assign them to this new vendor
  if (req.user.role === 'vendor') {
    try {
      const VendorUser = require('../models/VendorUser');
      await VendorUser.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { vendors: created._id } }
      );
      console.log(`Vendor user ${req.user.id} automatically assigned to new vendor ${created._id}`);
    } catch (error) {
      console.error('Error assigning vendor user to new vendor:', error);
    }
  }

  res.status(201).json({ success: true, data: created });
});

// PUT /vendors/:id
router.put('/:id', authenticate, requirePermission('vendor.edit'), async (req, res) => {
  const { id } = req.params;
  const { name, companyName, email, phone, address1, address2, city, zip, address, commission, imageUrl, imagePublicId, status, enabled } = req.body || {};

  // If user is a vendor, ensure they can only edit their own vendor
  if (req.user.role === 'vendor' && req.user.vendorId !== id) {
    console.log('Vendor user trying to edit different vendor:', { userVendorId: req.user.vendorId, requestedVendorId: id });
    res.status(403);
    throw new Error('You can only edit your own vendor information');
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  if (name !== undefined) vendor.name = String(name).trim();
  if (companyName !== undefined) vendor.companyName = String(companyName).trim();
  if (email !== undefined) {
    if (!isValidEmail(email)) {
      res.status(400);
      throw new Error('Invalid email format');
    }
    vendor.email = String(email).trim().toLowerCase();
  }
  if (phone !== undefined) vendor.phone = String(phone).trim();
  if (address1 !== undefined) vendor.address1 = String(address1).trim();
  if (address2 !== undefined) vendor.address2 = String(address2).trim();
  if (city !== undefined) vendor.city = String(city).trim();
  if (zip !== undefined) vendor.zip = String(zip).trim();
  if (address !== undefined) vendor.address = String(address).trim();
  if (commission !== undefined) vendor.commission = Number(commission);
  if (status !== undefined) vendor.status = status;
  if (enabled !== undefined) vendor.enabled = Boolean(enabled);
  if (imageUrl !== undefined) vendor.logo = imageUrl;
  if (imagePublicId !== undefined) vendor.logoPublicId = imagePublicId;

  const updated = await vendor.save();
  res.json({ success: true, data: updated });
});

// PATCH /vendors/:id/status
router.patch('/:id/status', authenticate, requirePermission('vendor.approve'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }
  const updated = await Vendor.findByIdAndUpdate(id, { status, enabled: status === 'approved' ? true : false }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  try {
    if (status === 'approved') {
      // Ensure at least one vendor user exists; if none, create one with a temp password
      const vendorId = updated._id;
      const tempPassword = Math.random().toString(36).slice(-10) + Math.floor(1000 + Math.random() * 9000);
      const users = await VendorUser.find({ $or: [{ vendor: vendorId }, { vendors: vendorId }] }).lean();
      let targetUsers = users;
      if (!users || users.length === 0) {
        // Create a vendor user using vendor email if valid
        const vEmail = String(updated.email || '').trim().toLowerCase();
        if (isValidEmail(vEmail)) {
          const passwordHash = await bcrypt.hash(String(tempPassword), 10);
          const createdVU = await VendorUser.create({ name: updated.companyName || 'Vendor', email: vEmail, passwordHash, vendor: vendorId, vendors: [vendorId] });
          targetUsers = [createdVU.toObject()];
        }
      } else {
        // Reset passwords to temp for all vendor users
        const passwordHash = await bcrypt.hash(String(tempPassword), 10);
        await VendorUser.updateMany({ _id: { $in: users.map(u => u._id) } }, { $set: { passwordHash } });
      }
      // Ensure default role for vendor users
      let vendorRole = await Role.findOne({ name: 'Vendor' }).lean();
      if (!vendorRole) {
        const createdRole = await Role.create({ name: 'Vendor', description: 'Default vendor role', permissions: ['vendor.view','vendor.edit','products.view'] });
        vendorRole = createdRole.toObject();
      }
      if (targetUsers && targetUsers.length > 0) {
        await VendorUser.updateMany({ _id: { $in: targetUsers.map(u => u._id || u.id) } }, { $set: { roleRef: vendorRole._id } });
      }
      // Send approval email with credentials to vendor email and vendor users
      try {
        const subject = 'Your vendor account has been approved';
        const credsHtml = targetUsers && targetUsers.length > 0
          ? `<ul>${targetUsers.map(u => `<li><b>Username:</b> ${u.email} — <b>Password:</b> ${tempPassword}</li>`).join('')}</ul>`
          : `<p>Please use your registered email to sign in. You can reset your password if needed.</p>`;
        const contentHtml = `<p>Hi ${updated.name || 'there'},</p><p>Your vendor application for <b>${updated.companyName}</b> has been <b>approved</b>.</p>${credsHtml}<p>You can now sign in to the Vendor Portal.</p>`;
        const html = await buildEmailHtml({ subject, contentHtml });
        if (isValidEmail(updated.email)) await sendMail({ to: updated.email, subject, html });
        for (const u of (targetUsers || [])) {
          if (u && isValidEmail(u.email)) {
            await sendMail({ to: u.email, subject, html });
          }
        }
      } catch (_) {}
    } else if (status === 'rejected') {
      try {
        const subject = 'Vendor application not approved';
        const contentHtml = `<p>Hi ${updated.name || 'there'},</p><p>Your vendor application for <b>${updated.companyName}</b> has been <b>rejected</b>.</p><p>Please contact support if you have questions.</p>`;
        const html = await buildEmailHtml({ subject, contentHtml });
        if (isValidEmail(updated.email)) await sendMail({ to: updated.email, subject, html });
      } catch (_) {}
    }
  } catch (mailErr) {
    // Non-fatal; continue
  }
  res.json({ success: true, data: updated });
});

// PATCH /vendors/:id/enable
router.patch('/:id/enable', authenticate, requirePermission('vendor.edit'), async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body || {};
  
  // If user is a vendor, ensure they can only modify their own vendor
  if (req.user.role === 'vendor' && req.user.vendorId !== id) {
    console.log('Vendor user trying to modify different vendor:', { userVendorId: req.user.vendorId, requestedVendorId: id });
    res.status(403);
    throw new Error('You can only modify your own vendor information');
  }
  
  const updated = await Vendor.findByIdAndUpdate(id, { enabled: Boolean(enabled) }, { new: true }).lean();
  if (!updated) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  res.json({ success: true, data: updated });
});

// DELETE /vendors/:id
router.delete('/:id', authenticate, requirePermission('vendor.delete'), async (req, res) => {
  const { id } = req.params;
  const deleted = await Vendor.findByIdAndDelete(id).lean();
  if (!deleted) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  res.json({ success: true });
});

module.exports = router;