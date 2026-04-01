import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';

const DriverDashboard = () => {
  const [stats, setStats] = useState({ assigned: 0, inTransit: 0, delivered: 0, deliveredTotal: 0 });

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver?page=1&limit=100`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      const json = await res.json();
      if (!res.ok || !json?.success) return;
      const orders = json.data || [];
      const assigned = orders.filter(o => !o.driverStatus || o.driverStatus === 'assigned').length;
      const inTransit = orders.filter(o => o.driverStatus === 'pickup_completed' || o.driverStatus === 'on_the_way').length;
      const deliveredOrders = orders.filter(o => o.driverStatus === 'delivered' || o.driverStatus === 'delivery_completed');
      const delivered = deliveredOrders.length;
      const deliveredTotal = deliveredOrders.reduce((s, o) => s + Number(o.total || 0), 0);
      setStats({ assigned, inTransit, delivered, deliveredTotal });
    } catch (_) {}
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <View style={styles.grid}>
        <View style={styles.card}><Text style={styles.num}>{stats.assigned}</Text><Text style={styles.label}>Assigned</Text></View>
        <View style={styles.card}><Text style={styles.num}>{stats.inTransit}</Text><Text style={styles.label}>In Transit</Text></View>
        <View style={styles.card}><Text style={styles.num}>{stats.delivered}</Text><Text style={styles.label}>Delivered</Text></View>
        <View style={styles.card}><Text style={styles.num}>₹{(stats.deliveredTotal).toFixed(2)}</Text><Text style={styles.label}>Delivered Total</Text></View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({ container:{ flex:1, padding:16, backgroundColor:'#fff' }, title:{ fontSize:18, fontWeight:'700', marginBottom:8 }, grid:{ flexDirection:'row', flexWrap:'wrap', gap:12 }, card:{ flexBasis:'48%', backgroundColor:'#f9f9f9', padding:16, borderRadius:12 }, num:{ fontSize:20, fontWeight:'800', color:'#f7ab18' }, label:{ marginTop:4, color:'#666', fontWeight:'600' } });

export default DriverDashboard;


