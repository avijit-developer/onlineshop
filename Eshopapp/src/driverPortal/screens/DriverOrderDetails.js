import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_BASE } from '../../utils/api';

const actionConfig = {
  assigned: { next: 'pickup_completed', label: 'Mark Pickup Completed' },
  pickup_completed: { next: 'on_the_way', label: 'Mark On The Way' },
  on_the_way: { next: 'delivery_completed', label: 'Mark Delivered' },
};

const DriverOrderDetails = ({ navigation, route }) => {
  const initialOrder = route?.params?.order || null;
  const [order, setOrder] = useState(initialOrder);
  const [submitting, setSubmitting] = useState(false);

  const driverStatus = String(order?.driverStatus || 'assigned').toLowerCase();
  const nextAction = actionConfig[driverStatus];

  const totalItems = useMemo(
    () => (order?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [order]
  );

  const updateStatus = async () => {
    if (!order || !nextAction) return;
    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver/${order._id || order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ status: nextAction.next })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to update order');
      setOrder(json.data);
      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to update order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Order details are unavailable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="arrow-back-outline" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <Text style={styles.status}>Driver Status: {order.driverStatus || 'assigned'}</Text>
          <Text style={styles.meta}>Customer: {order.user?.name || order.user?.email || 'Customer'}</Text>
          <Text style={styles.meta}>Phone: {order.user?.phone || order.customerPhone || 'N/A'}</Text>
          <Text style={styles.meta}>Payment: {order.paymentMethod || 'N/A'}</Text>
          <Text style={styles.meta}>Total Items: {totalItems}</Text>
          <Text style={styles.meta}>Order Amount: Rs {Number(order.total || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.address}>{order.shippingAddress || 'No address available'}</Text>
          {(order.deliveryLatitude != null && order.deliveryLongitude != null) ? (
            <Text style={styles.coords}>Lat: {Number(order.deliveryLatitude).toFixed(6)} | Lng: {Number(order.deliveryLongitude).toFixed(6)}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {(order.items || []).map((item, index) => (
            <View key={`${item.product || item.name}-${index}`} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                {item.sku ? <Text style={styles.itemMeta}>SKU: {item.sku}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>Rs {Number(item.price || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {nextAction ? (
          <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.7 }]} onPress={updateStatus} disabled={submitting}>
            <Text style={styles.primaryText}>{submitting ? 'Updating...' : nextAction.label}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>This order has completed all driver steps.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  emptyText: { color: '#64748b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  iconButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 28 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 16, marginBottom: 14, backgroundColor: '#fff' },
  orderNumber: { fontSize: 20, fontWeight: '800', color: '#111827' },
  status: { marginTop: 8, color: '#f59e0b', fontWeight: '700', textTransform: 'capitalize' },
  meta: { marginTop: 6, color: '#475569' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  address: { color: '#334155', lineHeight: 22 },
  coords: { marginTop: 8, color: '#64748b', fontSize: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemName: { fontWeight: '700', color: '#111827' },
  itemMeta: { color: '#64748b', marginTop: 4, fontSize: 12 },
  itemPrice: { fontWeight: '700', color: '#0f172a' },
  primaryButton: { backgroundColor: '#f7ab18', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  doneBox: { padding: 14, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  doneText: { textAlign: 'center', color: '#475569', fontWeight: '600' },
});

export default DriverOrderDetails;
