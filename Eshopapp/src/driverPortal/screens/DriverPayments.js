import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';

const DriverPayments = () => {
  const [loading, setLoading] = useState(true);
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
        const delivered = allOrders.filter(order => {
          const status = String(order.driverStatus || '').toLowerCase();
          return status === 'delivered' || status === 'delivery_completed';
        });
        const inProgress = allOrders.filter(order => ['assigned', 'pickup_completed', 'on_the_way'].includes(String(order.driverStatus || '').toLowerCase()));
        const totalAmount = delivered.reduce((sum, order) => sum + Number(order.driverCommission || 0), 0);
        const pendingAmount = inProgress.reduce((sum, order) => sum + Number(order.driverCommission || 0), 0);
        setSummary({ totalDelivered: delivered.length, totalAmount, pendingAmount });
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
              <Text style={styles.label}>Delivered Commission</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.num}>Rs {summary.pendingAmount.toFixed(2)}</Text>
              <Text style={styles.label}>Pending Commission</Text>
            </View>
          </View>
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
});

export default DriverPayments;
