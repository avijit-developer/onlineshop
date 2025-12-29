import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const VendorReports = ({ navigation }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getVendorSummary();
        if (res?.success) setSummary(res.data);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <View style={{ padding: 16 }}>
          <Text style={styles.row}>Total Orders: {summary?.orderCount || 0}</Text>
          <Text style={styles.row}>Vendor Subtotal: ₹{(summary?.vendorSubtotal || 0).toFixed(2)}</Text>
          <Text style={styles.row}>Total Earnings: ₹{(summary?.vendorSubtotal || 0).toFixed(2)}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { color: '#333', marginBottom: 10, fontWeight: '600' },
});

export default VendorReports;