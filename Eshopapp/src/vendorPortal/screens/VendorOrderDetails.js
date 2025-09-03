import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const currency = (n) => `₹${Number(n || 0).toFixed(2)}`;
const shortId = (id) => (id || '').slice(-6);

const VendorOrderDetails = ({ route, navigation }) => {
  const { order } = route.params || {};
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const customer = order.user || order.customer || {};
  const shippingString = typeof order.shippingAddress === 'string' ? order.shippingAddress : null;
  const shipping = shippingString ? {} : (order.shippingAddress || order.address || {});
  const totals = {
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shippingCost,
    discount: order.discountAmount,
    total: order.total,
    coupon: order.couponCode
  };
  const vendor = order.vendor || order.vendorInfo || (items.find(i => i?.product?.vendor) ? items.find(i => i.product.vendor).product.vendor : {});
  const status = String(order.status || '').toUpperCase();
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
        <TouchableOpacity onPress={() => navigation && navigation.goBack && navigation.goBack()}>
          <Icon name="arrow-back-outline" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 22 }} />
      </View>
      {/* Header summary */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Order #{order.orderNumber || shortId(order._id)}</Text>
          <Text style={[styles.badge, statusStyles(status)]}>{status}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.kvGrid}>
          <KV label="Date" value={formatDate(order.createdAt)} />
          <KV label="Items" value={String(items.length)} />
          <KV label="Subtotal" value={currency(order.vendorSubtotal)} />
          <KV label="Commission" value={currency(order.vendorCommission)} />
          <KV label="Net" value={currency(order.vendorNet ?? (Number(order.vendorSubtotal||0) - Number(order.vendorCommission||0)))} highlight />
        </View>
      </View>

      {/* Customer details */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <View style={styles.divider} />
        <KV label="Name" value={customer.name || '-'} />
        <KV label="Email" value={customer.email || '-'} />
        {order.customerPhone ? <KV label="Phone" value={order.customerPhone} /> : null}
        {shippingString ? (
          <KV label="Shipping" value={shippingString} />
        ) : (shipping && (shipping.address || shipping.city || shipping.state || shipping.zipCode)) ? (
          <KV label="Shipping" value={formatAddress(shipping)} />
        ) : null}
        {order.paymentMethod ? <KV label="Payment" value={String(order.paymentMethod).toUpperCase()} /> : null}
        {order.orderNote ? <KV label="Note" value={String(order.orderNote)} /> : null}
      </View>

      {/* Vendor details */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vendor</Text>
        <View style={styles.divider} />
        <KV label="Company" value={vendor.companyName || vendor.name || '-'} />
        <KV label="Email" value={vendor.email || '-'} />
        {vendor.phone ? <KV label="Phone" value={vendor.phone} /> : null}
        {vendor.address1 || vendor.address || vendor.city || vendor.zip ? (
          <KV label="Address" value={[vendor.address1 || vendor.address, vendor.address2, vendor.city, vendor.zip].filter(Boolean).join(', ')} />
        ) : null}
        {vendor.status ? <KV label="Status" value={String(vendor.status)} /> : null}
        {vendor.enabled != null ? <KV label="Enabled" value={vendor.enabled ? 'Yes' : 'No'} /> : null}
        {vendor.commission != null ? <KV label="Commission" value={String(vendor.commission) + '%'} /> : null}
        {vendor.balance != null ? <KV label="Balance" value={currency(vendor.balance)} /> : null}
        {vendor.totalEarnings != null ? <KV label="Total Earnings" value={currency(vendor.totalEarnings)} /> : null}
        {vendor.createdAt ? <KV label="Created" value={formatDate(vendor.createdAt)} /> : null}
        {vendor.updatedAt ? <KV label="Updated" value={formatDate(vendor.updatedAt)} /> : null}
      </View>

      {/* Items */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.divider} />
        <FlatList
          data={items}
          keyExtractor={(it, i) => String(it._id || i)}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              {item.image ? <Image source={{ uri: item.image }} style={styles.itemThumb} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product?.name || item.name}</Text>
                {!!item.sku && <Text style={styles.itemMeta}>SKU: {item.sku}</Text>}
                {item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0 && (
                  <Text style={styles.itemMeta}>Attrs: {Object.entries(item.selectedAttributes).map(([k,v]) => `${k}:${v}`).join(', ')}</Text>
                )}
                {!!item.vendor && <Text style={styles.itemMeta}>Vendor: {String(item.vendor)}</Text>}
                {item.commissionRate != null && <Text style={styles.itemMeta}>Commission: {String(item.commissionRate)}% ({currency(item.commissionAmount)})</Text>}
              </View>
              <Text style={styles.itemMeta}>x{item.quantity}</Text>
              <Text style={styles.itemPrice}>{currency(item.price)}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>

      {/* Totals */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Totals</Text>
        <View style={styles.divider} />
        <KV label="Subtotal" value={currency(totals.subtotal)} />
        {totals.tax != null && <KV label="Tax" value={currency(totals.tax)} />}
        {totals.shipping != null && <KV label="Shipping" value={currency(totals.shipping)} />}
        {totals.discount ? <KV label="Discount" value={currency(totals.discount)} /> : null}
        {totals.coupon ? <KV label="Coupon" value={String(totals.coupon)} /> : null}
        <KV label="Total" value={currency(totals.total)} highlight />
      </View>

      {/* Status History */}
      {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status History</Text>
          <View style={styles.divider} />
          {order.statusHistory.map((h, idx) => (
            <View key={idx} style={styles.statusRow}>
              <Text style={styles.kvValue}>{String(h.status).toUpperCase()}</Text>
              <Text style={styles.kvLabel}>{formatDate(h.timestamp)} • {h.updatedBy || 'system'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Additional Details */}
      {otherEntries.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          <View style={styles.divider} />
          {otherEntries.map(([k, v]) => (
            <View key={k} style={styles.kvRow}>
              <Text style={styles.kvLabel}>{formatKey(k)}</Text>
              <Text style={styles.kvValue}>{String(v)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const KV = ({ label, value, highlight }) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={[styles.kvValue, highlight && { color: '#2e7d32', fontWeight: '700' }]} numberOfLines={1}>{value}</Text>
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
  container: { flex: 1, backgroundColor: '#f7f8fa', padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerTitle: { fontWeight: '800', color: '#333', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', padding: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  title: { fontWeight: '800', color: '#333', fontSize: 16 },
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
  separator: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 8 },
});

export default VendorOrderDetails;