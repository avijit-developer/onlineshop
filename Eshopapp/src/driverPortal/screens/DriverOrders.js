import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';

const StatusButton = ({ label, onPress, disabled }) => (
  <TouchableOpacity style={[styles.statusBtn, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
    <Text style={styles.statusBtnText}>{label}</Text>
  </TouchableOpacity>
);

const DriverOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver?page=1&limit=50`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to load');
      setOrders(json.data || []);
    } catch (e) { Alert.alert('Error', e?.message || 'Failed to load orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (order, status) => {
    try {
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver/${order._id || order.id}/status`, { method: 'PATCH', headers: { 'Content-Type':'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ status }) });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed');
      setOrders(prev => prev.map(o => (String(o._id||o.id)===String(order._id||order.id)) ? json.data : o));
    } catch (e) { Alert.alert('Error', e?.message || 'Failed to update'); }
  };

  const renderItem = ({ item }) => {
    const ds = String(item.driverStatus || '').toLowerCase();
    return (
      <View style={styles.card}>
        <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
          <Text style={styles.orderNum}>#{item.orderNumber}</Text>
          <Text style={styles.badge}>{ds || 'assigned'}</Text>
        </View>
        <Text style={styles.customer}>{item.user?.name || item.user?.email || 'Customer'}</Text>
        <Text style={styles.address}>{item.shippingAddress}</Text>
        <View style={styles.btnRow}>
          <StatusButton label="Pickup completed" onPress={() => updateStatus(item, 'pickup_completed')} disabled={ds && ds !== 'assigned'} />
          <StatusButton label="On the way" onPress={() => updateStatus(item, 'on_the_way')} disabled={ds !== 'pickup_completed'} />
          <StatusButton label="Delivered" onPress={() => updateStatus(item, 'delivery_completed')} disabled={ds !== 'on_the_way'} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Assigned Orders</Text>
      {loading ? <Text>Loading...</Text> : (
        <FlatList data={orders} keyExtractor={(i)=>String(i._id||i.id)} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 24 }} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, padding:16, backgroundColor:'#fff' }, title:{ fontSize:18, fontWeight:'700', marginBottom:8 },
  card:{ borderWidth:1, borderColor:'#eee', borderRadius:12, padding:12, marginBottom:12 }, orderNum:{ fontWeight:'700' }, badge:{ backgroundColor:'#f1f5f9', color:'#334155', paddingHorizontal:8, paddingVertical:4, borderRadius:999, overflow:'hidden', textTransform:'capitalize' }, customer:{ marginTop:6, fontWeight:'600' }, address:{ color:'#555', marginTop:2 }, btnRow:{ flexDirection:'row', marginTop:12, gap:8, justifyContent:'space-between' }, statusBtn:{ flex:1, backgroundColor:'#f7ab18', borderRadius:8, paddingVertical:10, alignItems:'center' }, statusBtnText:{ color:'#fff', fontWeight:'700', fontSize:12 }
});

export default DriverOrders;


