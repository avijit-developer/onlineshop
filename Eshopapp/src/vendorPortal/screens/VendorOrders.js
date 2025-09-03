import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const VendorOrders = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getVendorOrders({ page: 1, limit: 100 });
        if (res?.success) setOrders(res.data || []);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('VendorOrderDetails', { order: item })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.orderId}>#{item.orderNumber || item._id?.slice(-6)}</Text>
        <Text style={styles.status}>{String(item.status || '').toUpperCase()}</Text>
      </View>
      <Text style={styles.amount}>Subtotal: ₹{(item.vendorSubtotal || 0).toFixed(2)}</Text>
      <Text style={styles.amount}>Commission: ₹{(item.vendorCommission || 0).toFixed(2)}</Text>
      <Text style={styles.amount}>Net: ₹{(item.vendorNet || 0).toFixed(2)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Orders</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o, i) => String(o._id || i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12, marginBottom: 12 },
  orderId: { fontWeight: '700', color: '#333' },
  status: { color: '#8791a1', fontWeight: '600' },
  amount: { color: '#333', marginTop: 4 },
});

export default VendorOrders;