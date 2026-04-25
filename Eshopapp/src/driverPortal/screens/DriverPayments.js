import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';

const CURRENCY_SYMBOL = '₹';
const formatMoney = (value) => `${CURRENCY_SYMBOL}${Number(value || 0).toFixed(2)}`;

const getLocalDayRange = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const isWithinToday = (value, today = new Date()) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return false;
  const { start, end } = getLocalDayRange(today);
  return parsed >= start && parsed <= end;
};

const getLatestHistoryTimestamp = (history = [], statuses = []) => {
  const wanted = new Set(statuses.map((status) => String(status || '').toLowerCase()));
  let latest = null;

  for (const entry of Array.isArray(history) ? history : []) {
    const status = String(entry?.status || '').toLowerCase();
    if (!wanted.has(status)) continue;
    const timestamp = entry?.timestamp ? new Date(entry.timestamp) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) continue;
    if (!latest || timestamp > latest) latest = timestamp;
  }

  return latest;
};

const getOrderAssignedAt = (order) => {
  const driverHistoryAssigned = getLatestHistoryTimestamp(order?.driverStatusHistory, ['assigned']);
  const statusHistoryAssigned = getLatestHistoryTimestamp(order?.statusHistory, ['driver:assigned']);
  return [driverHistoryAssigned, statusHistoryAssigned].reduce((latest, value) => {
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, null);
};

const getOrderDeliveredAt = (order) => {
  const driverHistoryDelivered = getLatestHistoryTimestamp(order?.driverStatusHistory, ['delivered', 'delivery_completed']);
  const statusHistoryDelivered = getLatestHistoryTimestamp(order?.statusHistory, ['driver:delivered', 'delivered']);
  return [driverHistoryDelivered, statusHistoryDelivered].reduce((latest, value) => {
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, null);
};

const isTodayAssignedOrder = (order) => isWithinToday(getOrderAssignedAt(order));
const isTodayDeliveredOrder = (order) => isWithinToday(getOrderDeliveredAt(order));
const isTodayPayout = (payout) => isWithinToday(payout?.createdAt);

const DriverPayments = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({ totalDelivered: 0, totalAmount: 0, pendingAmount: 0, totalPaid: 0, balance: 0 });
  const [transactions, setTransactions] = useState([]);

  const load = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const [activeRes, historyRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/orders/driver?mode=active&page=1&limit=100`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        }),
        fetch(`${API_BASE}/api/v1/orders/driver?mode=history&page=1&limit=100`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        }),
        fetch(`${API_BASE}/api/v1/drivers/me/payouts`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        })
      ]);
      const activeJson = await activeRes.json().catch(() => ({}));
      const historyJson = await historyRes.json().catch(() => ({}));
      const payoutsJson = await payoutsRes.json().catch(() => ({}));
      if (!activeRes.ok || !activeJson?.success) return;

      const activeOrders = Array.isArray(activeJson.data) ? activeJson.data : [];
      const deliveredOrders = Array.isArray(historyJson.data) ? historyJson.data : [];
      const todaysDelivered = deliveredOrders.filter((order) => isTodayDeliveredOrder(order));
      const todaysActive = activeOrders.filter((order) => isTodayAssignedOrder(order) && ['assigned', 'pickup_completed', 'on_the_way'].includes(String(order.driverStatus || '').toLowerCase()));
      const todaysPayouts = Array.isArray(payoutsJson?.data?.payouts) ? payoutsJson.data.payouts.filter(isTodayPayout) : [];

      const totalAmount = todaysDelivered.reduce((sum, order) => sum + Number(order.driverCommission || 0), 0);
      const pendingAmount = todaysActive.reduce((sum, order) => sum + Number(order.driverCommission || 0), 0);
      const totalPaid = todaysPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
      const balance = Math.max(0, totalAmount - totalPaid);

      setSummary({
        totalDelivered: todaysDelivered.length,
        totalAmount,
        pendingAmount,
        totalPaid,
        balance,
      });
      setTransactions(todaysPayouts);
    } catch (_) {
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    load();
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f7ab18" colors={['#f7ab18']} />}
    >
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#f7ab18" /></View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.eyebrow}>Driver Earnings</Text>
                <Text style={styles.title}>Payment Report</Text>
                <Text style={styles.subtitle}>Track only today's delivered commission, pending earnings, and payout history in one place.</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeValue}>{summary.totalDelivered}</Text>
                <Text style={styles.heroBadgeLabel}>Delivered</Text>
              </View>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroBottomRow}>
              <View>
                <Text style={styles.heroMetricLabel}>Balance Due</Text>
                <Text style={styles.heroMetricValue}>{formatMoney(summary.balance)}</Text>
              </View>
              <View style={styles.heroMiniStat}>
                <Text style={styles.heroMiniLabel}>Paid Out</Text>
                <Text style={styles.heroMiniValue}>{formatMoney(summary.totalPaid)}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.summaryGrid}>
            <View style={[styles.card, styles.tintAmber]}>
              <Text style={styles.cardLabel}>Delivered Commission</Text>
              <Text style={styles.num}>{formatMoney(summary.totalAmount)}</Text>
              <Text style={styles.cardHint}>Ready earnings from completed deliveries</Text>
            </View>
            <View style={[styles.card, styles.tintBlue]}>
              <Text style={styles.cardLabel}>Pending Commission</Text>
              <Text style={styles.num}>{formatMoney(summary.pendingAmount)}</Text>
              <Text style={styles.cardHint}>Expected from active assigned orders</Text>
            </View>
            <View style={[styles.card, styles.tintGreen]}>
              <Text style={styles.cardLabel}>Paid Out</Text>
              <Text style={styles.num}>{formatMoney(summary.totalPaid)}</Text>
              <Text style={styles.cardHint}>Commission already transferred</Text>
            </View>
            <View style={[styles.card, styles.tintSlate]}>
              <Text style={styles.cardLabel}>Delivered Orders</Text>
              <Text style={styles.num}>{summary.totalDelivered}</Text>
              <Text style={styles.cardHint}>Orders completed by you</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payout Transactions</Text>
            <Text style={styles.sectionMeta}>{transactions.length} record{transactions.length === 1 ? '' : 's'}</Text>
          </View>
          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyText}>Your payout history will appear here after admin records a payment.</Text>
            </View>
          ) : (
            transactions.map((item) => (
              <View key={String(item.id)} style={styles.transactionCard}>
                <View style={styles.transactionRow}>
                  <View>
                    <Text style={styles.transactionAmount}>{formatMoney(item.amount)}</Text>
                    <Text style={styles.transactionDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.methodChip}>
                    <Text style={styles.transactionMethod}>{item.method || 'Manual'}</Text>
                  </View>
                </View>
                {item.note ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>Note</Text>
                    <Text style={styles.transactionNote}>{item.note}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  heroTextBlock: { flex: 1 },
  eyebrow: { color: '#fbbf24', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 6 },
  subtitle: { color: '#cbd5e1', marginTop: 8, lineHeight: 20 },
  heroBadge: {
    minWidth: 82,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  heroBadgeValue: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroBadgeLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '700', marginTop: 2 },
  heroDivider: { height: 1, backgroundColor: '#374151', marginVertical: 18 },
  heroBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  heroMetricLabel: { color: '#9ca3af', fontWeight: '700', marginBottom: 4 },
  heroMetricValue: { color: '#fff', fontSize: 30, fontWeight: '900' },
  heroMiniStat: { alignItems: 'flex-end' },
  heroMiniLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  heroMiniValue: { color: '#fbbf24', fontSize: 18, fontWeight: '800', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  sectionMeta: { color: '#6b7280', fontWeight: '600' },
  summaryGrid: { gap: 12, marginBottom: 20 },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  tintAmber: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  tintBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  tintGreen: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  tintSlate: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  cardLabel: { color: '#475569', fontWeight: '700', fontSize: 13 },
  num: { fontSize: 24, fontWeight: '900', color: '#111827', marginTop: 8 },
  cardHint: { marginTop: 8, color: '#64748b', fontSize: 12, lineHeight: 18 },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  emptyTitle: { color: '#111827', fontWeight: '800', fontSize: 16, marginBottom: 6 },
  emptyText: { color: '#64748b', textAlign: 'center', lineHeight: 20 },
  transactionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transactionAmount: { fontSize: 19, fontWeight: '900', color: '#111827' },
  methodChip: { backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  transactionMethod: { color: '#92400e', fontWeight: '800', fontSize: 12 },
  transactionDate: { marginTop: 6, color: '#64748b', fontSize: 12, fontWeight: '600' },
  noteBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  noteLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  transactionNote: { color: '#334155', lineHeight: 20 },
});

export default DriverPayments;
