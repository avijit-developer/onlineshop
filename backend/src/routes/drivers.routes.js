const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireAnyPermission, requirePermission, requireRole } = require('../middleware/auth');
const Driver = require('../models/Driver');
const DriverUser = require('../models/DriverUser');
const DriverPayout = require('../models/DriverPayout');
const Role = require('../models/Role');
const Order = require('../models/Order');
const { sendMail, buildEmailHtml } = require('../utils/mailer');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureDriverRole() {
  let role = await Role.findOne({ name: 'Driver' }).lean();
  if (!role) {
    role = (await Role.create({ name: 'Driver', description: 'Default driver role', permissions: ['driver.view'] })).toObject();
  }
  return role;
}

async function syncDriverUserAccount({ driver, password }) {
  if (!password || String(password).length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.statusCode = 400;
    throw err;
  }

  const role = await ensureDriverRole();
  let driverUser = await DriverUser.findOne({ email: driver.email });
  const passwordHash = await bcrypt.hash(String(password), 10);

  if (!driverUser) {
    driverUser = await DriverUser.create({
      name: driver.name,
      email: driver.email,
      passwordHash,
      driver: driver._id
    });
  } else {
    driverUser.name = driver.name;
    driverUser.email = driver.email;
    driverUser.passwordHash = passwordHash;
    driverUser.driver = driver._id;
    driverUser.isActive = true;
    await driverUser.save();
  }

  await DriverUser.updateOne({ _id: driverUser._id }, { $set: { roleRef: role._id } }).catch(() => {});
  return driverUser;
}

async function ensureUniqueDriverIdentity({ email, phone, excludeDriverId = null }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const phoneNorm = String(phone || '').trim();

  const excludeQuery = excludeDriverId ? { _id: { $ne: excludeDriverId } } : {};

  const existingDriver = await Driver.findOne({ email: normalizedEmail, ...excludeQuery }).lean();
  if (existingDriver) {
    const err = new Error('A driver with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  if (phoneNorm) {
    const [userPhone, vendorPhone, driverPhone] = await Promise.all([
      User.findOne({ phone: phoneNorm }).lean(),
      Vendor.findOne({ phone: phoneNorm }).lean(),
      Driver.findOne({ phone: phoneNorm, ...excludeQuery }).lean(),
    ]);
    if (userPhone || vendorPhone || driverPhone) {
      const err = new Error('Phone number already in use');
      err.statusCode = 409;
      throw err;
    }
  }
}

function buildActiveDriverOrderQuery(driverId) {
  return {
    driver: driverId,
    status: { $nin: ['delivered', 'cancelled', 'canceled', 'refunded'] },
    driverStatus: { $nin: ['delivery_completed'] },
  };
}

async function computeDriverBalance(driverId) {
  const [orders, payouts] = await Promise.all([
    Order.find({
      driver: driverId,
      $or: [
        { status: 'delivered' },
        { driverStatus: { $in: ['delivered', 'delivery_completed'] } }
      ]
    }).select('driverCommission').lean(),
    DriverPayout.find({ driver: driverId }).select('amount').lean(),
  ]);

  const totalEarnings = orders.reduce((sum, order) => sum + Number(order.driverCommission || 0), 0);
  const totalPaid = payouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
  const balance = Math.max(0, totalEarnings - totalPaid);

  return {
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    balance: Math.round(balance * 100) / 100,
  };
}

// Public: apply to become a driver
router.post('/apply', async (req, res) => {
  try {
    const { name, email, phone, address1, address2, city, zip, address, driverUserEmail, driverUserName } = req.body || {};
    const applicantEmail = String(email || '').trim().toLowerCase();
    if (!name || !applicantEmail || !phone) { res.status(400); throw new Error('name, email and phone are required'); }
    if (!isValidEmail(applicantEmail)) { res.status(400); throw new Error('Invalid email'); }
    await ensureUniqueDriverIdentity({ email: applicantEmail, phone });

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

// Admin: create driver directly
router.post('/', authenticate, requireAnyPermission(['driver.add', 'driver.edit']), async (req, res) => {
  try {
    const { name, email, phone, address1, address2, city, zip, address, status, enabled, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedStatus = ['pending', 'approved', 'rejected'].includes(status) ? status : 'approved';

    if (!name || !normalizedEmail || !phone) {
      res.status(400);
      throw new Error('name, email and phone are required');
    }
    if (!password || String(password).length < 6) {
      res.status(400);
      throw new Error('password must be at least 6 characters');
    }
    if (!isValidEmail(normalizedEmail)) {
      res.status(400);
      throw new Error('Invalid email');
    }

    await ensureUniqueDriverIdentity({ email: normalizedEmail, phone });

    const driver = await Driver.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      address1: String(address1 || '').trim(),
      address2: String(address2 || '').trim(),
      city: String(city || '').trim(),
      zip: String(zip || '').trim(),
      address: String(address || '').trim(),
      status: normalizedStatus,
      enabled: typeof enabled === 'boolean' ? enabled : normalizedStatus === 'approved'
    });

    if (normalizedStatus === 'approved') {
      await syncDriverUserAccount({ driver, password });
    }

    res.status(201).json({ success: true, data: driver });
  } catch (e) {
    if (e?.statusCode) res.status(e.statusCode);
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

// Driver: get my profile
router.get('/me', authenticate, requireRole(['driver']), async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;
    const driver = await Driver.findById(driverId).lean();
    if (!driver) {
      res.status(404);
      throw new Error('Driver not found');
    }
    res.json({ success: true, data: driver });
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

// Driver: update my profile
router.put('/me/profile', authenticate, requireRole(['driver']), async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;
    const { name, address1, address2, city, zip, address } = req.body || {};

    if (!name || !String(name).trim()) {
      res.status(400);
      throw new Error('name is required');
    }

    const updated = await Driver.findByIdAndUpdate(
      driverId,
      {
        name: String(name).trim(),
        address1: String(address1 || '').trim(),
        address2: String(address2 || '').trim(),
        city: String(city || '').trim(),
        zip: String(zip || '').trim(),
        address: String(address || '').trim(),
      },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404);
      throw new Error('Driver not found');
    }

    await DriverUser.updateOne(
      { $or: [{ driver: updated._id }, { email: updated.email }] },
      { $set: { name: updated.name, driver: updated._id } }
    ).catch(() => {});

    res.json({ success: true, data: updated });
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

router.get('/me/payouts', authenticate, requireRole(['driver']), async (req, res) => {
  try {
    const driverId = req.user.driverId || req.user.id;
    const [driver, balanceInfo, payouts] = await Promise.all([
      Driver.findById(driverId).lean(),
      computeDriverBalance(driverId),
      DriverPayout.find({ driver: driverId })
        .sort({ createdAt: -1 })
        .select('amount method note createdAt updatedAt')
        .lean(),
    ]);

    if (!driver) {
      res.status(404);
      throw new Error('Driver not found');
    }

    res.json({
      success: true,
      data: {
        totalEarnings: balanceInfo.totalEarnings,
        totalPaid: balanceInfo.totalPaid,
        balance: balanceInfo.balance,
        payouts: payouts.map((payout) => ({
          id: payout._id,
          amount: Number(payout.amount || 0),
          method: payout.method || 'Manual',
          note: payout.note || '',
          createdAt: payout.createdAt,
          updatedAt: payout.updatedAt,
        })),
      }
    });
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

router.get('/:id/payouts', authenticate, requireAnyPermission(['driver.view', 'driver.edit']), async (req, res) => {
  try {
    const { id } = req.params;
    const [driver, balanceInfo, payouts] = await Promise.all([
      Driver.findById(id).lean(),
      computeDriverBalance(id),
      DriverPayout.find({ driver: id })
        .sort({ createdAt: -1 })
        .select('amount method note processedBy createdAt updatedAt')
        .populate('processedBy', 'name email')
        .lean(),
    ]);

    if (!driver) {
      res.status(404);
      throw new Error('Driver not found');
    }

    res.json({
      success: true,
      data: {
        driver: {
          id: driver._id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
        },
        totalEarnings: balanceInfo.totalEarnings,
        totalPaid: balanceInfo.totalPaid,
        balance: balanceInfo.balance,
        payouts: payouts.map((payout) => ({
          id: payout._id,
          amount: Number(payout.amount || 0),
          method: payout.method || 'Manual',
          note: payout.note || '',
          processedBy: payout.processedBy ? {
            name: payout.processedBy.name || '',
            email: payout.processedBy.email || '',
          } : null,
          createdAt: payout.createdAt,
          updatedAt: payout.updatedAt,
        })),
      }
    });
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

router.get('/payouts', authenticate, requireAnyPermission(['driver.view', 'driver.edit']), async (req, res) => {
  try {
    const { from = '', to = '', q = '', page = 1, limit = 10 } = req.query || {};
    const query = {};

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const payoutPage = Math.max(parseInt(page, 10) || 1, 1);
    const payoutLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const allItems = await DriverPayout.find(query)
      .sort({ createdAt: -1 })
      .select('driver amount method note processedBy createdAt updatedAt')
      .populate('driver', 'name email phone city status')
      .populate('processedBy', 'name email')
      .lean();

    const normalizedQ = String(q || '').trim().toLowerCase();
    const filteredItems = normalizedQ
      ? allItems.filter((item) => {
          const driverText = [item.driver?.name, item.driver?.email, item.driver?.phone, item.driver?.city]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const payoutText = [item.method, item.note, item.processedBy?.name, item.processedBy?.email]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return driverText.includes(normalizedQ) || payoutText.includes(normalizedQ);
        })
      : allItems;

    const total = filteredItems.length;
    const pagedItems = filteredItems.slice((payoutPage - 1) * payoutLimit, payoutPage * payoutLimit);

    const data = pagedItems.map((payout) => ({
      id: payout._id.toString(),
      driverId: String(payout.driver?._id || payout.driver || ''),
      driverName: payout.driver?.name || 'Unknown Driver',
      driverEmail: payout.driver?.email || '',
      driverPhone: payout.driver?.phone || '',
      driverCity: payout.driver?.city || '',
      amount: Number(payout.amount || 0),
      method: payout.method || 'Manual',
      note: payout.note || '',
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt,
      processedBy: payout.processedBy?.name || payout.processedBy?.email || '',
    }));

    return res.json({
      success: true,
      data,
      meta: { total, page: payoutPage, limit: payoutLimit }
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch driver payout ledger' });
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
  const driverIds = items.map(item => item._id).filter(Boolean);
  const activeOrders = driverIds.length > 0
    ? await Order.find(buildActiveDriverOrderQuery({ $in: driverIds }))
      .select('driver orderNumber')
      .sort({ createdAt: -1 })
      .lean()
    : [];
  const activeOrdersByDriver = new Map();
  activeOrders.forEach(order => {
    const key = String(order.driver || '');
    if (!key) return;
    const existing = activeOrdersByDriver.get(key) || [];
    existing.push(order);
    activeOrdersByDriver.set(key, existing);
  });
  const balanceEntries = await Promise.all(items.map(async item => [String(item._id), await computeDriverBalance(item._id)]));
  const balanceMap = new Map(balanceEntries);
  const enriched = items.map(item => {
    const activeDriverOrders = activeOrdersByDriver.get(String(item._id)) || [];
    const activeOrder = activeDriverOrders[0] || null;
    const balanceInfo = balanceMap.get(String(item._id)) || { totalEarnings: 0, totalPaid: 0, balance: 0 };
    return {
      ...item,
      isBusy: Boolean(activeOrder),
      busyOrderId: activeOrder?._id || null,
      busyOrderNumber: activeOrder?.orderNumber || null,
      activeOrderCount: activeDriverOrders.length,
      activeOrderNumbers: activeDriverOrders.map(order => order.orderNumber).filter(Boolean),
      totalEarnings: balanceInfo.totalEarnings,
      totalPaid: balanceInfo.totalPaid,
      balance: balanceInfo.balance,
    };
  });
  res.json({ success: true, data: enriched, meta: { total, page: p, limit: l } });
});

router.post('/:id/payouts', authenticate, requireAnyPermission(['driver.edit', 'driver.view']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, note } = req.body || {};
    const driver = await Driver.findById(id).lean();
    if (!driver) {
      res.status(404);
      throw new Error('Driver not found');
    }

    const numericAmount = Math.round(Number(amount) * 100) / 100;
    if (!(numericAmount > 0)) {
      res.status(400);
      throw new Error('amount must be greater than 0');
    }

    const balanceInfo = await computeDriverBalance(id);
    if (!(balanceInfo.balance > 0)) {
      res.status(400);
      throw new Error('Driver has no payable balance');
    }
    if (numericAmount - balanceInfo.balance > 0.01) {
      res.status(400);
      throw new Error('Payout exceeds available balance');
    }

    const payout = await DriverPayout.create({
      driver: id,
      amount: numericAmount,
      method: method || 'Manual',
      note: note || '',
      processedBy: req.user?.id,
    });

    const updatedBalance = await computeDriverBalance(id);
    await Driver.updateOne(
      { _id: id },
      { $set: { totalEarnings: updatedBalance.totalEarnings, balance: updatedBalance.balance } }
    ).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: payout._id,
        driverId: id,
        amount: payout.amount,
        method: payout.method,
        note: payout.note,
        createdAt: payout.createdAt,
        balance: updatedBalance.balance,
        totalPaid: updatedBalance.totalPaid,
        totalEarnings: updatedBalance.totalEarnings,
      }
    });
  } catch (e) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
});

// Admin: update driver
router.put('/:id', authenticate, requirePermission('driver.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address1, address2, city, zip, address, status, enabled, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedStatus = ['pending', 'approved', 'rejected'].includes(status) ? status : undefined;

    if (!name || !normalizedEmail || !phone) {
      res.status(400);
      throw new Error('name, email and phone are required');
    }
    if (!isValidEmail(normalizedEmail)) {
      res.status(400);
      throw new Error('Invalid email');
    }

    await ensureUniqueDriverIdentity({ email: normalizedEmail, phone, excludeDriverId: id });

    const update = {
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      address1: String(address1 || '').trim(),
      address2: String(address2 || '').trim(),
      city: String(city || '').trim(),
      zip: String(zip || '').trim(),
      address: String(address || '').trim(),
    };

    if (normalizedStatus) {
      update.status = normalizedStatus;
      if (normalizedStatus !== 'approved') {
        update.enabled = false;
      }
    }
    if (typeof enabled === 'boolean' && (!normalizedStatus || normalizedStatus === 'approved')) {
      update.enabled = enabled;
    }

    const updated = await Driver.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) {
      res.status(404);
      throw new Error('Driver not found');
    }

    if ((updated.status === 'approved' && password) || (normalizedStatus === 'approved' && password)) {
      await syncDriverUserAccount({ driver: updated, password });
    }

    res.json({ success: true, data: updated });
  } catch (e) {
    if (e?.statusCode) res.status(e.statusCode);
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    throw e;
  }
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
      const tempPassword = Math.random().toString(36).slice(-6) + Math.floor(1000 + Math.random() * 9000);
      await syncDriverUserAccount({ driver: updated, password: tempPassword });
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


