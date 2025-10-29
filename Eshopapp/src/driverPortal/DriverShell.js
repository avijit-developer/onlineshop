import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TabButton = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.tabBtn, active && styles.tabActive]}>
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const DriverShell = ({ navigation }) => {
  const [tab, setTab] = useState('dash');
  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Driver Portal</Text></View>
      <View style={{ flex:1 }}>
        {tab === 'dash' && navigation.replace('DriverDashboard')}
        {tab === 'orders' && navigation.replace('DriverOrders')}
        {tab === 'profile' && navigation.replace('DriverProfile')}
      </View>
      <View style={styles.tabs}>
        <TabButton label="Dashboard" active={tab==='dash'} onPress={() => setTab('dash')} />
        <TabButton label="Orders" active={tab==='orders'} onPress={() => setTab('orders')} />
        <TabButton label="Profile" active={tab==='profile'} onPress={() => setTab('profile')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff' }, header:{ padding:16, borderBottomWidth:1, borderBottomColor:'#eee' }, title:{ fontSize:18, fontWeight:'700' }, tabs:{ flexDirection:'row', borderTopWidth:1, borderTopColor:'#eee' }, tabBtn:{ flex:1, padding:12, alignItems:'center' }, tabActive:{ borderTopWidth:2, borderTopColor:'#f7ab18' }, tabText:{ color:'#666' }, tabTextActive:{ color:'#f7ab18', fontWeight:'700' }
});

export default DriverShell;


