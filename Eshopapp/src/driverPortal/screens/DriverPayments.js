import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';

const DriverPayments = () => {
  const [loading, setLoading] = useState(true);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [summary, setSummary] = useState({ totalDelivered: 0, totalAmount: 0, pendingAmount: 0 });

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('driverAuthToken');
        const res = await fetch(`${API_BASE}/api/v1/orders/driver?page=1&limit=100`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) return;
        const allOrders = Array.isArray(json.data) ? json.data : [];
        const delivered = allOrders.filter(order => String(order.driverStatus || '').toLowerCase() === 'delivery_completed');
        const inProgress = allOrders.filter(order => ['assigned', 'pickup_completed', 'on_the_way'].includes(String(order.driverStatus || '').toLowerCase()));
        const totalAmount = delivered.reduce((sum, order) => sum + Number(order.shippingCost || 0), 0);
        const pendingAmount = inProgress.reduce((sum, order) => sum + Number(order.shippingCost || 0), 0);
        setDeliveredOrders(delivered);
        setSummary({ totalDelivered: delivered.length, totalAmount, pendingAmount });
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.rowCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
        <Text style={styles.customer}>{item.user?.name || item.user?.email || 'Customer'}</Text>
        <Text style={styles.date}>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ''}</Text>
      </View>
      <Text style={styles.amount}>Rs {Number(item.shippingCost || 0).toFixed(2)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payments Report</Text>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#f7ab18" /></View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <View style={styles.card}>
              <Text style={styles.num}>{summary.totalDelivered}</Text>
              <Text style={styles.label}>Delivered Orders</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.num}>Rs {summary.totalAmount.toFixed(2)}</Text>
              <Text style={styles.label}>Delivered Shipping</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.num}>Rs {summary.pendingAmount.toFixed(2)}</Text>
              <Text style={styles.label}>Pending Shipping</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Delivered Orders</Text>
          <FlatList
            data={deliveredOrders}
            keyExtractor={(item) => String(item._id || item.id)}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={styles.emptyText}>No delivered orders yet.</Text>}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
  summaryGrid: { gap: 12, marginBottom: 20 },
  card: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  num: { fontSize: 20, fontWeight: '800', color: '#f7ab18' },
  label: { marginTop: 4, color: '#64748b', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  rowCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, marginBottom: 10, backgroundColor: '#fff' },
  orderNumber: { fontWeight: '700', color: '#111827' },
  customer: { marginTop: 4, color: '#475569' },
  date: { marginTop: 4, color: '#94a3b8', fontSize: 12 },
  amount: { fontWeight: '700', color: '#0f172a' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 },
});

export default DriverPayments;
