import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

const VendorOrderDetails = ({ route }) => {
  const { order } = route.params || {};
  if (!order) return null;
  const items = order.items || [];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order #{order.orderNumber || (order._id || '').slice(-6)}</Text>
      <Text style={styles.meta}>Status: {order.status}</Text>
      <Text style={styles.meta}>Subtotal: ₹{(order.vendorSubtotal || 0).toFixed(2)}</Text>
      <Text style={styles.meta}>Commission: ₹{(order.vendorCommission || 0).toFixed(2)}</Text>
      <Text style={styles.meta}>Net: ₹{(order.vendorNet || 0).toFixed(2)}</Text>
      <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 10 }} />
      <FlatList
        data={items}
        keyExtractor={(it, i) => String(it._id || i)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.cell} numberOfLines={1}>{item.product?.name || item.name}</Text>
            <Text style={styles.cell}>x{item.quantity}</Text>
            <Text style={styles.cell}>₹{(item.price || 0).toFixed(2)}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#f0f0f0' }} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontWeight: '700', color: '#333', marginBottom: 6 },
  meta: { color: '#666', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  cell: { flex: 1, color: '#333' },
});

export default VendorOrderDetails;