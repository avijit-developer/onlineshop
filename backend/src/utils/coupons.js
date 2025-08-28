const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const Order = require('../models/Order');

/**
 * Compute coupon discount and effects for a set of order items.
 * Supports: global, vendor, category, product, new_user, freeShipping, allowedPaymentMethods,
 * perUserLimit, usageLimit, max cap, BOGO (basic), minimum order amount.
 *
 * @param {Object} params
 * @param {String} params.couponCode
 * @param {Array<{product: string|ObjectId, price: number, quantity: number}>} params.items
 * @param {String} params.userId
 * @param {String} [params.paymentMethod]
 * @returns {Promise<{valid: boolean, message?: string, discountAmount?: number, applicableSubtotal?: number, freeShipping?: boolean, appliedCoupon?: any}>}
 */
async function validateAndComputeCoupon({ couponCode, items, userId, paymentMethod }) {
  if (!couponCode) return { valid: false, message: 'couponCode is required' };
  const code = String(couponCode).toUpperCase();
  const now = new Date();
  const coupon = await Coupon.findOne({ code, isActive: true, startDate: { $lte: now }, endDate: { $gte: now } }).lean();
  if (!coupon) return { valid: false, message: 'Invalid or expired coupon' };

  // Global usage limit
  if (coupon.usageLimit && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) {
    return { valid: false, message: 'Coupon usage limit reached' };
  }

  // Per-user limit
  if (coupon.perUserLimit && userId) {
    const userCouponCount = await Order.countDocuments({ user: userId, couponCode: coupon.code });
    if (userCouponCount >= Number(coupon.perUserLimit)) {
      return { valid: false, message: 'Coupon usage limit reached for this user' };
    }
  }

  // Payment method restriction
  if (Array.isArray(coupon.allowedPaymentMethods) && coupon.allowedPaymentMethods.length > 0) {
    if (!paymentMethod || !coupon.allowedPaymentMethods.includes(String(paymentMethod))) {
      return { valid: false, message: 'Coupon not valid for selected payment method' };
    }
  }

  const productIds = items.map(i => i.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).select('_id vendor category').lean();
  const idToProduct = new Map(products.map(p => [String(p._id), p]));

  const getApplicable = () => {
    if (coupon.appliesTo === 'all' || coupon.appliesTo === 'new_user') return items;
    if (coupon.appliesTo === 'vendor') return items.filter(it => {
      const p = idToProduct.get(String(it.product));
      return p && coupon.vendorIds && coupon.vendorIds.find(id => String(id) === String(p.vendor));
    });
    if (coupon.appliesTo === 'category') return items.filter(it => {
      const p = idToProduct.get(String(it.product));
      return p && coupon.categoryIds && coupon.categoryIds.find(id => String(id) === String(p.category));
    });
    if (coupon.appliesTo === 'product') return items.filter(it => coupon.productIds && coupon.productIds.find(id => String(id) === String(it.product)));
    return items;
  };

  // New user check
  if (coupon.appliesTo === 'new_user' && userId) {
    const existing = await Order.countDocuments({ user: userId });
    if (existing > 0) return { valid: false, message: 'Coupon valid for new users only' };
  }

  const applicable = getApplicable();
  if (applicable.length === 0) return { valid: false, message: 'Coupon does not apply to selected items' };

  const applicableSubtotal = applicable.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
  const orderSubtotal = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);

  if (coupon.minimumAmount && orderSubtotal < Number(coupon.minimumAmount)) {
    return { valid: false, message: `Minimum order amount is ${coupon.minimumAmount}` };
  }

  let discountAmount = 0;
  let freeShipping = !!coupon.freeShipping;

  if (coupon.ruleType === 'bogo') {
    // Basic BOGO: if cart has at least bogoBuyQty of any buyProductIds, apply percentage or fixed discount to getProductIds quantities (up to bogoGetQty)
    const buyIds = new Set((coupon.bogoBuyProductIds || []).map(id => String(id)));
    const getIds = new Set((coupon.bogoGetProductIds || []).map(id => String(id)));
    const totalBuyQty = items.filter(it => buyIds.has(String(it.product))).reduce((s, it) => s + Number(it.quantity || 0), 0);
    if (totalBuyQty >= Number(coupon.bogoBuyQty || 1)) {
      // Eligible freebies/discounted items
      const eligibleGetItems = items.filter(it => getIds.has(String(it.product)));
      let remainingGetQty = Number(coupon.bogoGetQty || 1);
      for (const it of eligibleGetItems) {
        const qtyToDiscount = Math.min(remainingGetQty, Number(it.quantity || 0));
        const linePrice = Number(it.price || 0) * qtyToDiscount;
        if (coupon.discountType === 'percentage') {
          discountAmount += (linePrice * Number(coupon.discountValue || 0)) / 100;
        } else {
          discountAmount += Number(coupon.discountValue || 0);
        }
        remainingGetQty -= qtyToDiscount;
        if (remainingGetQty <= 0) break;
      }
    }
  } else {
    // Standard discount on applicable subtotal
    if (coupon.discountType === 'percentage') {
      discountAmount = (applicableSubtotal * Number(coupon.discountValue || 0)) / 100;
      if (coupon.maximumDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscount));
    } else {
      discountAmount = Number(coupon.discountValue || 0);
    }
  }

  return { valid: true, discountAmount, applicableSubtotal, freeShipping, appliedCoupon: coupon };
}

module.exports = { validateAndComputeCoupon };

