import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const VendorDashboard = ({ navigation }) => {
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sumRes, meRes] = await Promise.allSettled([
          api.getVendorSummary(),
          api.getVendorProfile(),
        ]);
        if (sumRes.status === 'fulfilled' && sumRes.value?.success) {
          setSummary(sumRes.value.data);
        }
        if (meRes.status === 'fulfilled') {
          const me = meRes.value?.data || meRes.value;
          setProfile(me);
        }
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Dashboard</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}> <ActivityIndicator /> </View>
      ) : (
        <>
          {profile && (
            <View style={styles.profileCard}>
              <Text style={styles.profileTitle}>Signed in as</Text>
              <Text style={styles.profileName}>{profile?.name || profile?.user?.name || 'Vendor'}</Text>
              <View style={styles.profileRow}><Text style={styles.profileLabel}>Email: </Text><Text style={styles.profileValue}>{profile?.email || profile?.user?.email || '-'}</Text></View>
              <View style={styles.profileRow}><Text style={styles.profileLabel}>Mobile: </Text><Text style={styles.profileValue}>{profile?.phone || profile?.user?.phone || '-'}</Text></View>
            </View>
          )}
          <View style={styles.cards}>
          <View style={styles.card}><Text style={styles.cardLabel}>Orders</Text><Text style={styles.cardValue}>{summary?.orderCount || 0}</Text></View>
          <View style={styles.card}><Text style={styles.cardLabel}>Subtotal</Text><Text style={styles.cardValue}>₹{(summary?.vendorSubtotal || 0).toFixed(2)}</Text></View>
          <View style={styles.card}><Text style={styles.cardLabel}>Commission</Text><Text style={styles.cardValue}>₹{(summary?.vendorCommission || 0).toFixed(2)}</Text></View>
          <View style={styles.card}><Text style={styles.cardLabel}>Net</Text><Text style={styles.cardValue}>₹{(summary?.vendorNet || 0).toFixed(2)}</Text></View>
          </View>
        </>
      )}

      {/* Actions removed per requirement */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileCard: { margin: 16, padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12 },
  profileTitle: { color: '#8791a1', fontSize: 12, marginBottom: 4 },
  profileName: { color: '#333', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  profileRow: { flexDirection: 'row', marginTop: 2 },
  profileLabel: { color: '#8791a1', fontSize: 12 },
  profileValue: { color: '#333', fontSize: 12, fontWeight: '600' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  card: { width: '47%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 14 },
  cardLabel: { color: '#8791a1', fontSize: 12, marginBottom: 4 },
  cardValue: { color: '#333', fontSize: 18, fontWeight: '700' },
  actions: { padding: 16, gap: 10 },
  actionBtn: { backgroundColor: '#f7ab18', borderRadius: 8, alignItems: 'center', paddingVertical: 12 },
  actionText: { color: '#fff', fontWeight: '700' },
});

export default VendorDashboard;