import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const currency = (n) => `₹${Number(n || 0).toFixed(2)}`;
const shortId = (id) => (id || '').slice(-6);

const VendorOrderDetails = ({ route, navigation }) => {
  const { orderId, order: fallback } = route.params || {};
  const [order, setOrder] = useState(fallback || null);
  const [hydrating, setHydrating] = useState(!!orderId);

  useEffect(() => {
    (async () => {
      if (!orderId) return;
      setHydrating(true);
      try {
        const res = await api.getVendorOrderById(orderId);
        const payload = res?.order || res?.data?.order || res?.data || res || null;
        if (payload) setOrder(payload);
      } catch (_) {}
      finally { setHydrating(false); }
    })();
  }, [orderId]);

  if (!order && hydrating) return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator /></View>;
  if (!order) return null;

  // Helpers to pick first available field (supports nested keys like 'summary.total')
  const pick = (obj, keys, fallback) => {
    for (const key of keys) {
      const parts = key.split('.');
      let cur = obj;
      let ok = true;
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
        else { ok = false; break; }
      }
      if (ok && cur != null && cur !== '') return cur;
    }
    return fallback;
  };

  const items = pick(order, ['items', 'orderItems', 'products'], []);
  const customer = pick(order, ['user', 'customer', 'customerInfo'], {}) || {};
  const shippingString = typeof pick(order, ['shippingAddress', 'shipping_address'], '') === 'string' ? (pick(order, ['shippingAddress', 'shipping_address'], '') || null) : null;
  const shippingObj = pick(order, ['shippingAddress', 'shipping', 'shipping_address', 'address'], {});
  const shipping = shippingString ? {} : (shippingObj || {});
  const totals = {
    subtotal: pick(order, ['subtotal', 'vendorSubtotal', 'summary.subtotal', 'totals.subtotal'], 0),
    tax: pick(order, ['tax', 'summary.tax', 'totals.tax'], null),
    shipping: pick(order, ['shippingCost', 'shipping', 'summary.shipping', 'totals.shipping'], null),
    discount: pick(order, ['discountAmount', 'discount', 'summary.discount', 'totals.discount'], 0),
    total: pick(order, ['total', 'grandTotal', 'vendorNet', 'summary.total', 'totals.total'], 0),
    coupon: pick(order, ['couponCode', 'coupon', 'summary.couponCode', 'totals.couponCode'], null),
  };
  const vendor = pick(order, ['vendor', 'vendorInfo'], {}) || (Array.isArray(items) && items.find(i => i?.product?.vendor)?.product?.vendor) || {};
  const status = String(pick(order, ['status', 'orderStatus'], '') || '').toUpperCase();
  const displayed = new Set([
    '_id','id','user','customer','orderNumber','status','items','shippingAddress','address','paymentMethod','tax','shippingCost','discountAmount','couponCode','customerPhone','subtotal','total','orderNote','statusHistory','createdAt','updatedAt','__v','vendor','vendorInfo'
  ]);
  const otherEntries = Object.entries(order).filter(([k, v]) => {
    const isScalar = ['string','number','boolean'].includes(typeof v);
    return isScalar && !displayed.has(k) && String(v).length > 0;
  });

  return (
    <View style={styles.container}>
      {/* Header with back */}
      <View style={styles.header}>
        <View style={styles.navSlot}>
          <TouchableOpacity onPress={() => navigation && navigation.goBack && navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.navSlot} />
      </View>
      
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
      {/* Hero summary */}
      <View style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.heroTitle}>Order #{pick(order, ['orderNumber', 'order_no', 'number', 'code', '_id', 'id'], shortId(order._id))}</Text>
          <Text style={[styles.badge, statusStyles(status)]}>{status}</Text>
        </View>
        <View style={{ height: 10 }} />
        <Text style={styles.heroTotal}>{currency(totals.total)}</Text>
        <View style={{ height: 8 }} />
        <View style={styles.pillsRow}>
          <View style={[styles.pillBadge]}><Text style={styles.pillText}>Items: {String(items.length)}</Text></View>
          {pick(order, ['paymentMethod', 'payment_method']) ? (
            <View style={[styles.pillBadge]}><Text style={styles.pillText}>Payment: {String(pick(order, ['paymentMethod', 'payment_method'], '')).toUpperCase()}</Text></View>
          ) : null}
          {totals.coupon ? (<View style={[styles.pillBadge]}><Text style={styles.pillText}>Coupon: {String(totals.coupon)}</Text></View>) : null}
        </View>
        <Text style={styles.dateText}>{formatDate(pick(order, ['createdAt', 'created_at', 'date', 'placedAt'], ''))}</Text>
      </View>

      {/* Customer quick info */}
      <View style={styles.infoCard}>
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Customer</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Name</Text><Text style={styles.infoValue}>{customer.name || '-'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{customer.email || '-'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Mobile</Text><Text style={styles.infoValue}>{order.customerPhone || customer.phone || '-'}</Text></View>
      </View>

      {/* Customer details */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.divider} />
        <KV label="Name" value={pick(customer, ['name', 'fullName'], '-')} />
        <KV label="Email" value={pick(customer, ['email'], '-')} />
        <KV label="Mobile" value={pick(order, ['customerPhone', 'phone'], pick(customer, ['phone', 'mobile'], '-'))} />
        {shippingString ? (
          <KVWrap label="Shipping" value={shippingString} />
        ) : (shipping && (shipping.address || shipping.city || shipping.state || shipping.zipCode)) ? (
          <KVWrap label="Shipping" value={formatAddress(shipping)} />
        ) : null}
        {pick(order, ['paymentMethod', 'payment_method']) ? <KV label="Payment" value={String(pick(order, ['paymentMethod', 'payment_method'], '')).toUpperCase()} /> : null}
        {pick(order, ['orderNote', 'note']) ? <KV label="Note" value={String(pick(order, ['orderNote', 'note'], ''))} /> : null}
      </View>

      {/* Vendor details */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Vendor</Text></View>
        <View style={styles.divider} />
        <KV label="Name" value={vendor.companyName || vendor.name || '-'} />
      </View>

      {/* Items */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Items</Text></View>
        <View style={styles.divider} />
        {(Array.isArray(items) ? items : []).map((item, idx) => {
          const unitPrice = Number(pick(item, ['price', 'unitPrice'], 0));
          const qty = Number(pick(item, ['quantity', 'qty'], 0));
          const lineTotal = unitPrice * qty;
          const imageUri = pick(item, ['image'], '');
          return (
          <View key={item._id || idx}>
            <View style={styles.itemRow}>
              <View style={{ position: 'relative' }}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.itemThumb} /> : null}
                {!!qty && (
                  <View style={styles.qtyBadge}><Text style={styles.qtyBadgeText}>x{qty}</Text></View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{pick(item, ['product.name'], '') || pick(item, ['name'], '')}</Text>
                {pick(item, ['sku']) ? <Text style={styles.itemMeta}>SKU: {pick(item, ['sku'], '')}</Text> : null}
                {item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0 && (
                  <Text style={styles.itemMeta}>Attributes: {Object.entries(item.selectedAttributes).map(([k,v]) => `${k}: ${v}`).join(', ')}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemLineTotal}>{currency(lineTotal)}</Text>
                <Text style={styles.itemUnitMeta}>{currency(unitPrice)} × {qty}</Text>
              </View>
            </View>
            {idx < items.length - 1 && <View style={styles.separator} />}
          </View>
          );
        })}
      </View>

      {/* Totals */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Totals</Text></View>
        <View style={styles.divider} />
        <KV label="Subtotal" value={currency(totals.subtotal)} />
        {totals.tax != null && <KV label="Tax" value={currency(totals.tax)} />}
        {totals.shipping != null && <KV label="Shipping" value={currency(totals.shipping)} />}
        {totals.discount ? <KV label="Discount" value={`- ${currency(totals.discount)}`} /> : null}
        {totals.coupon ? <KV label="Coupon" value={String(totals.coupon)} /> : null}
        <View style={styles.divider} />
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Grand Total</Text>
          <Text style={styles.grandValue}>{currency(totals.total)}</Text>
        </View>
      </View>

      {/* Status History */}
      {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Status History</Text></View>
          <View style={styles.divider} />
          {order.statusHistory.map((h, idx) => (
            <View key={idx} style={styles.statusRow}>
              <Text style={styles.kvValue}>{String(h.status).toUpperCase()}</Text>
              <Text style={styles.kvLabel}>{formatDate(h.timestamp)} • {h.updatedBy || 'system'}</Text>
            </View>
          ))}
        </View>
      )}

      
      <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

const KV = ({ label, value, highlight }) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={[styles.kvValue, highlight && { color: '#2e7d32', fontWeight: '700' }]} numberOfLines={1}>{value}</Text>
  </View>
);

const KVWrap = ({ label, value }) => (
  <View style={[styles.kvRow, { width: '100%' }]}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={[styles.kvValue, { flexShrink: 1 }]}>{value}</Text>
  </View>
);

const formatDate = (d) => {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '-';
  }
};

const formatAddress = (a) => {
  const parts = [a.address, a.city, a.state, a.zipCode, a.country].filter(Boolean);
  return parts.join(', ');
};

function formatKey(s) {
  try {
    return String(s)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, m => m.toUpperCase());
  } catch { return String(s); }
}

const statusStyles = (status) => ({
  backgroundColor: status === 'COMPLETED' ? '#E6F4EA' : status === 'CANCELLED' ? '#FEECEF' : '#FFF8E1',
  color: status === 'COMPLETED' ? '#2e7d32' : status === 'CANCELLED' ? '#c62828' : '#b26a00',
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollBody: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 8 },
  navSlot: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontWeight: '800', color: '#333', fontSize: 16, textAlign: 'center' },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', padding: 14 },
  infoTitle: { color: '#8791a1', fontSize: 12, marginBottom: 6 },
  sectionHeader: { backgroundColor: '#f9fafb', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, marginBottom: 8 },
  sectionHeaderText: { color: '#6b7280', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
  infoRow: { flexDirection: 'row', marginTop: 2 },
  infoLabel: { color: '#8791a1', fontSize: 12, width: 64 },
  infoValue: { color: '#333', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', padding: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  title: { fontWeight: '800', color: '#333', fontSize: 16 },
  heroCard: { backgroundColor: '#111827', borderRadius: 14, padding: 16 },
  heroTitle: { color: '#f3f4f6', fontWeight: '800', fontSize: 16 },
  heroTotal: { color: '#ffffff', fontWeight: '900', fontSize: 24, letterSpacing: 0.3 },
  dateText: { color: '#d1d5db', fontSize: 12, marginTop: 6 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  pillBadge: { backgroundColor: '#1f2937', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: '#e5e7eb', fontSize: 12, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, overflow: 'hidden', fontWeight: '700' },
  sectionTitle: { fontWeight: '700', color: '#333' },
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kvRow: { width: '50%', paddingVertical: 6 },
  kvLabel: { color: '#8791a1', fontSize: 12 },
  kvValue: { color: '#333', fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#f4f4f4', marginRight: 10 },
  itemName: { color: '#333', fontWeight: '600', marginRight: 8, maxWidth: '60%' },
  itemMeta: { color: '#8791a1' },
  itemPrice: { color: '#333', fontWeight: '700', marginLeft: 10 },
  itemLineTotal: { color: '#111827', fontWeight: '800' },
  itemUnitMeta: { color: '#6b7280', fontSize: 12 },
  qtyBadge: { position: 'absolute', right: -6, top: -6, backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  qtyBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 8 },
  grandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grandLabel: { color: '#6b7280', fontWeight: '700' },
  grandValue: { color: '#111827', fontWeight: '800', fontSize: 18 },
});

export default VendorOrderDetails;