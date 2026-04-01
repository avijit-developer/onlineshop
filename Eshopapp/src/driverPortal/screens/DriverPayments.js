import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';

const CURRENCY_SYMBOL = '₹';
const formatMoney = (value) => `${CURRENCY_SYMBOL}${Number(value || 0).toFixed(2)}`;

const DriverPayments = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalDelivered: 0, totalAmount: 0, pendingAmount: 0, totalPaid: 0, balance: 0 });
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('driverAuthToken');
        const [ordersRes, payoutsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/orders/driver?page=1&limit=100`, {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          }),
          fetch(`${API_BASE}/api/v1/drivers/me/payouts`, {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          })
        ]);
        const ordersJson = await ordersRes.json().catch(() => ({}));
        const payoutsJson = await payoutsRes.json().catch(() => ({}));
        if (!ordersRes.ok || !ordersJson?.success) return;
        const allOrders = Array.isArray(ordersJson.data) ? ordersJson.data : [];
        const delivered = allOrders.filter(order => {
          const status = String(order.driverStatus || '').toLowerCase();
          return status === 'delivered' || status === 'delivery_completed';
        });
        const inProgress = allOrders.filter(order => ['assigned', 'pickup_completed', 'on_the_way'].includes(String(order.driverStatus || '').toLowerCase()));
        const totalAmount = delivered.reduce((sum, order) => sum + Number(order.driverCommission || 0), 0);
        const pendingAmount = inProgress.reduce((sum, order) => sum + Number(order.driverCommission || 0), 0);
        setSummary({
          totalDelivered: delivered.length,
          totalAmount,
          pendingAmount,
          totalPaid: Number(payoutsJson?.data?.totalPaid || 0),
          balance: Number(payoutsJson?.data?.balance || 0),
        });
        setTransactions(Array.isArray(payoutsJson?.data?.payouts) ? payoutsJson.data.payouts : []);
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#f7ab18" /></View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.eyebrow}>Driver Earnings</Text>
                <Text style={styles.title}>Payment Report</Text>
                <Text style={styles.subtitle}>Track delivered commission, pending earnings, and payout history in one place.</Text>
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
