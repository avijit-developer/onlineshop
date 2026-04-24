import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';
import { createDriverSocket } from '../../utils/driverSocket';

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const normalizeDriverStep = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'delivery_completed') return 'delivered';
  if (['assigned', 'pickup_completed', 'on_the_way', 'delivered'].includes(v)) return v;
  return '';
};

const getStatusMeta = (status) => {
  switch (status) {
    case 'pickup_completed':
      return { label: 'Pickup Completed', bg: '#fef3c7', color: '#92400e' };
    case 'on_the_way':
      return { label: 'On the Way', bg: '#dbeafe', color: '#1d4ed8' };
    case 'delivered':
      return { label: 'Delivered', bg: '#dcfce7', color: '#166534' };
    default:
      return { label: 'Assigned', bg: '#e5e7eb', color: '#374151' };
  }
};

const StatusButton = ({ label, onPress, disabled }) => (
  <TouchableOpacity style={[styles.statusBtn, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
    <Text style={styles.statusBtnText}>{label}</Text>
  </TouchableOpacity>
);

const isDriverOrderMatch = (order, driverId) => {
  if (!driverId) return false;
  const assignedDriverId = String(order?.driver?._id || order?.driver?.id || order?.driver || '');
  return assignedDriverId === String(driverId);
};

const isActiveDriverOrder = (order) => {
  const status = String(order?.status || '').toLowerCase();
  const driverStatus = String(order?.driverStatus || '').toLowerCase();
  if (['cancelled', 'canceled', 'refunded'].includes(status)) return false;
  return !['delivered', 'delivery_completed'].includes(driverStatus);
};

const DriverOrders = ({ navigation, socket, driverId = '' }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(false);

  const load = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver?mode=active&page=1&limit=50`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to load');
      setOrders(json.data || []);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to load orders');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let localSocket = null;
    const activeSocket = socket || null;

    const handleRelevantUpdate = (payload = {}) => {
      const order = payload?.order || payload || {};
      if (!isDriverOrderMatch(order, driverId)) return;
      if (!isActiveDriverOrder(order)) return;
      load({ showLoading: false });
    };

    const bindSocket = async () => {
      if (activeSocket) {
        activeSocket.on('driver:order_assigned', handleRelevantUpdate);
        activeSocket.on('driver:order_unassigned', () => {
          load({ showLoading: false });
        });
        activeSocket.on('order:updated', handleRelevantUpdate);
        return;
      }

      const token = await AsyncStorage.getItem('driverAuthToken');
      localSocket = createDriverSocket(token);
      if (!localSocket) return;
      localSocket.on('driver:order_assigned', handleRelevantUpdate);
      localSocket.on('driver:order_unassigned', () => {
        load({ showLoading: false });
      });
      localSocket.on('order:updated', handleRelevantUpdate);
    };

    bindSocket();

    return () => {
      if (activeSocket) {
        activeSocket.off('driver:order_assigned', handleRelevantUpdate);
        activeSocket.off('driver:order_unassigned');
        activeSocket.off('order:updated', handleRelevantUpdate);
      }
      if (localSocket) {
        localSocket.off('driver:order_assigned', handleRelevantUpdate);
        localSocket.off('driver:order_unassigned');
        localSocket.off('order:updated', handleRelevantUpdate);
        localSocket.disconnect();
      }
    };
  }, [socket, driverId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        load({ showLoading: false });
      }
    });
    return () => subscription.remove();
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load({ showLoading: false });
    } finally {
      setRefreshing(false);
    }
  };

  const updateStatus = async (order, status, deliveryPaymentMethod = null) => {
    try {
      setUpdating(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver/${order._id || order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ status, deliveryPaymentMethod }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed');
      await load({ showLoading: false });
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update');
    } finally {
      setUpdating(false);
      setShowPaymentModal(false);
      setSelectedOrder(null);
    }
  };

  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  const renderItem = ({ item }) => {
    const ds = normalizeDriverStep(item.driverStatus) || 'assigned';
    const statusMeta = getStatusMeta(ds);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('DriverOrderDetails', { order: item, orderId: item._id || item.id })}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderEyebrow}>Order</Text>
            <Text style={styles.orderNum}>#{item.orderNumber}</Text>
          </View>
          <Text style={[styles.badge, { backgroundColor: statusMeta.bg, color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Customer</Text>
          <Text style={styles.customer}>{item.user?.name || item.user?.email || 'Customer'}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Delivery Address</Text>
          <Text style={styles.address} numberOfLines={2}>{item.shippingAddress}</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Order Value</Text>
            <Text style={styles.summaryValue}>{formatMoney(item.total)}</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Commission</Text>
            <Text style={styles.summaryValue}>{formatMoney(item.driverCommission)}</Text>
          </View>
        </View>
        <View style={styles.btnRow}>
          <StatusButton label="Pickup completed" onPress={() => updateStatus(item, 'pickup_completed')} disabled={ds && ds !== 'assigned'} />
          <StatusButton label="On the way" onPress={() => updateStatus(item, 'on_the_way')} disabled={ds !== 'pickup_completed'} />
          <StatusButton label="Delivered" onPress={() => openPaymentModal(item)} disabled={ds !== 'on_the_way'} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        data={orders}
        keyExtractor={(i) => String(i._id || i.id)}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Driver Portal</Text>
            <Text style={styles.heroTitle}>Orders</Text>
            <Text style={styles.heroSubtitle}>Manage your assigned deliveries and update progress from here.</Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStatBox}>
                <Text style={styles.heroStatValue}>{orders.length}</Text>
                <Text style={styles.heroStatLabel}>Assigned</Text>
              </View>
              <View style={styles.heroStatBox}>
                <Text style={styles.heroStatValue}>
                  {orders.filter((o) => ['on_the_way', 'pickup_completed'].includes(normalizeDriverStep(o.driverStatus))).length}
                </Text>
                <Text style={styles.heroStatLabel}>Active</Text>
              </View>
            </View>
          </View>
        }
        contentContainerStyle={[styles.listContent, orders.length === 0 ? styles.listContentEmpty : null]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f7ab18" colors={['#f7ab18']} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#f7ab18" />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No assigned orders</Text>
              <Text style={styles.emptyText}>New delivery tasks will appear here as soon as they are assigned.</Text>
            </View>
          )
        }
      />

      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!updating) {
            setShowPaymentModal(false);
            setSelectedOrder(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              disabled={updating}
              onPress={() => {
                if (!updating) {
                  setShowPaymentModal(false);
                  setSelectedOrder(null);
                }
              }}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            <Text style={styles.modalSubtitle}>Choose one before completing delivery.</Text>
            <View style={styles.paymentRow}>
              <TouchableOpacity
                style={styles.paymentOption}
                disabled={updating}
                onPress={() => selectedOrder && updateStatus(selectedOrder, 'delivered', 'cash')}
              >
                <Text style={styles.paymentOptionText}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.paymentOption}
                disabled={updating}
                onPress={() => selectedOrder && updateStatus(selectedOrder, 'delivered', 'online')}
              >
                <Text style={styles.paymentOptionText}>Online</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f3f4f6' },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: { color: '#fbbf24', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 6 },
  heroSubtitle: { color: '#cbd5e1', marginTop: 8, lineHeight: 20 },
  heroStats: { flexDirection: 'row', gap: 12, marginTop: 18 },
  heroStatBox: { flex: 1, backgroundColor: '#1f2937', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  heroStatValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroStatLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#64748b', fontWeight: '600', marginTop: 10 },
  listContent: { paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, padding: 16, marginBottom: 12, backgroundColor: '#fff' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  orderEyebrow: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  orderNum: { fontWeight: '900', fontSize: 20, color: '#111827', marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontWeight: '800', fontSize: 12 },
  infoBlock: { marginTop: 14 },
  infoLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  customer: { fontWeight: '700', color: '#0f172a', fontSize: 16 },
  address: { color: '#475569', lineHeight: 20 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  summaryChip: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  summaryValue: { color: '#111827', fontWeight: '900', fontSize: 16, marginTop: 6 },
  btnRow: { flexDirection: 'row', marginTop: 16, gap: 8, justifyContent: 'space-between' },
  statusBtn: { flex: 1, backgroundColor: '#f7ab18', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  statusBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center', paddingHorizontal: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    zIndex: 2,
  },
  modalCloseText: {
    fontSize: 22,
    lineHeight: 22,
    color: '#111827',
    fontWeight: '700',
    marginTop: -1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    paddingRight: 40,
  },
  modalSubtitle: {
    marginTop: 6,
    color: '#64748b',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  paymentOption: {
    flex: 1,
    backgroundColor: '#f7ab18',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  paymentOptionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default DriverOrders;
