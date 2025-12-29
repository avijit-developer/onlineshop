import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const VendorDashboard = ({ navigation }) => {
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isCompletedOrder = (order) => {
    const status = String(order?.status || '').toLowerCase();
    return ['delivered', 'completed'].includes(status);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumRes, meRes, reportRes, ordersRes] = await Promise.allSettled([
        api.getVendorSummary(),
        api.getVendorProfile(),
        api.getVendorReport().catch(() => null),
        api.getVendorOrders({ page: 1, limit: 100 }).catch(() => null),
      ]);
      if (sumRes.status === 'fulfilled' && sumRes.value?.success) {
        setSummary(sumRes.value.data);
      }
      if (meRes.status === 'fulfilled') {
        const me = meRes.value?.data || meRes.value;
        setProfile(me);
      }
      if (reportRes.status === 'fulfilled' && reportRes.value?.success) {
        setReportData(reportRes.value.data);
      }
      if (ordersRes.status === 'fulfilled' && ordersRes.value?.success) {
        const orders = ordersRes.value?.data || [];
        const completedCount = orders.filter(isCompletedOrder).length;
        setCompletedOrdersCount(completedCount);
      }
    } catch (_) {}
    finally { 
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Dashboard</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}> 
          <ActivityIndicator size="large" color="#f7ab18" /> 
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
              <Icon name="receipt-outline" size={24} color="#28a745" />
              <Text style={styles.statLabel}>Total Revenue</Text>
              <Text style={[styles.statValue, { color: '#28a745' }]}>
                {formatCurrency(reportData?.totalEarnings || summary?.vendorSubtotal || 0)}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
              <Icon name="cash-outline" size={24} color="#007bff" />
              <Text style={styles.statLabel}>Total Paid</Text>
              <Text style={[styles.statValue, { color: '#007bff' }]}>
                {formatCurrency(reportData?.totalPaid || 0)}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#ffebee' }]}>
              <Icon name="wallet-outline" size={24} color="#dc3545" />
              <Text style={styles.statLabel}>Balance (Due)</Text>
              <Text style={[styles.statValue, { color: '#dc3545' }]}>
                {formatCurrency(reportData?.balance || reportData?.due || 0)}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fff3e0' }]}>
              <Icon name="list-outline" size={24} color="#f7ab18" />
              <Text style={styles.statLabel}>Total Completed Orders</Text>
              <Text style={[styles.statValue, { color: '#f7ab18' }]}>
                {completedOrdersCount}
              </Text>
            </View>
          </View>

          {/* Profile Card */}
          {profile && (
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(profile?.name || profile?.user?.name || 'V').slice(0,1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.profileTitle}>Signed in as</Text>
                  <Text style={styles.profileName}>{profile?.name || profile?.user?.name || 'Vendor'}</Text>
                </View>
              </View>
              <View style={styles.profileDivider} />
              <View style={styles.profileRow}>
                <Icon name="mail-outline" size={16} color="#8791a1" />
                <Text style={styles.profileLabel}>Email: </Text>
                <Text style={styles.profileValue}>{profile?.email || profile?.user?.email || '-'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Icon name="call-outline" size={16} color="#8791a1" />
                <Text style={styles.profileLabel}>Mobile: </Text>
                <Text style={styles.profileValue}>{profile?.phone || profile?.user?.phone || '-'}</Text>
              </View>
              {(profile?.bankAccountHolderName || profile?.bankAccountNumber || profile?.bankName || profile?.bankIFSC) && (
                <View style={styles.bankDetailsSection}>
                  <Text style={styles.sectionTitle}>Bank Details</Text>
                  {profile?.bankAccountHolderName && (
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Account Holder: </Text>
                      <Text style={styles.profileValue}>{profile.bankAccountHolderName}</Text>
                    </View>
                  )}
                  {profile?.bankAccountNumber && (
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Account Number: </Text>
                      <Text style={styles.profileValue}>{profile.bankAccountNumber}</Text>
                    </View>
                  )}
                  {profile?.bankName && (
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Bank: </Text>
                      <Text style={styles.profileValue}>{profile.bankName}</Text>
                    </View>
                  )}
                  {profile?.bankIFSC && (
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>IFSC: </Text>
                      <Text style={styles.profileValue}>{profile.bankIFSC}</Text>
                    </View>
                  )}
                  {profile?.bankBranch && (
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Branch: </Text>
                      <Text style={styles.profileValue}>{profile.bankBranch}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    paddingTop: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff'
  },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '47%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileCard: { 
    margin: 16, 
    marginTop: 0,
    padding: 16, 
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: '#eef2f7', 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f7ab18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileTitle: { color: '#8791a1', fontSize: 11, marginBottom: 2 },
  profileName: { color: '#333', fontSize: 18, fontWeight: '700' },
  profileDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 12,
  },
  profileRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  profileLabel: { color: '#8791a1', fontSize: 13 },
  profileValue: { color: '#333', fontSize: 13, fontWeight: '600', flex: 1 },
  bankDetailsSection: { 
    marginTop: 16, 
    paddingTop: 16, 
    borderTopWidth: 1, 
    borderTopColor: '#e0e0e0' 
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
});

export default VendorDashboard;