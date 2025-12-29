import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  ScrollView,
  FlatList,
  RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const VendorReports = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.getVendorReport();
      if (res?.success && res?.data) {
        setReportData(res.data);
        setPayments(res.data.payments || []);
        setPayouts(res.data.payouts || []);
      }
    } catch (error) {
      console.error('Error fetching vendor report:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReport();
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reports</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f7ab18" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={[styles.statValue, { color: '#28a745' }]}>
              {formatCurrency(reportData?.totalEarnings || 0)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Paid</Text>
            <Text style={[styles.statValue, { color: '#007bff' }]}>
              {formatCurrency(reportData?.totalPaid || 0)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Balance (Due)</Text>
            <Text style={[styles.statValue, { color: '#dc3545' }]}>
              {formatCurrency(reportData?.balance || 0)}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              Payment History
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
            onPress={() => setActiveTab('payments')}
          >
            <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
              Admin Payments
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment History Tab */}
        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            {payments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="receipt-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No payment history found</Text>
              </View>
            ) : (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Order ID</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Customer</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1.3 }]}>Earnings</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Method</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Date</Text>
                </View>
                <FlatList
                  data={payments}
                  keyExtractor={(item, index) => item.id || `payment-${index}`}
                  renderItem={({ item }) => (
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '600' }]}>{item.orderId || '-'}</Text>
                      <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={1}>
                        {item.customerName || '-'}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1.3, fontWeight: '600', color: '#28a745' }]}>
                        {formatCurrency(item.vendorEarnings)}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{item.paymentMethod || '-'}</Text>
                      <Text style={[styles.tableCell, { flex: 1, fontSize: 11 }]}>
                        {formatDate(item.date)}
                      </Text>
                    </View>
                  )}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>
        )}

        {/* Admin Payments Tab */}
        {activeTab === 'payments' && (
          <View style={styles.tabContent}>
            {payouts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="cash-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No admin payments found</Text>
              </View>
            ) : (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Amount</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1.3 }]}>Method</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Date & Time</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Processed By</Text>
                </View>
                <FlatList
                  data={payouts}
                  keyExtractor={(item, index) => item.id || `payout-${index}`}
                  renderItem={({ item }) => (
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '600', color: '#007bff' }]}>
                        {formatCurrency(item.amount)}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1.3 }]}>{item.method || 'Manual'}</Text>
                      <Text style={[styles.tableCell, { flex: 1.5, fontSize: 11 }]}>
                        {formatDateTime(item.updatedAt || item.createdAt)}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={1}>
                        {item.processedBy || '-'}
                      </Text>
                    </View>
                  )}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    paddingTop: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#f7ab18',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#f7ab18',
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999',
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCell: {
    fontSize: 13,
    color: '#333',
    paddingHorizontal: 4,
  },
});

export default VendorReports;
