import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DriverOrders from './screens/DriverOrders';
import DriverHistoryOrders from './screens/DriverHistoryOrders';
import DriverPayments from './screens/DriverPayments';
import DriverProfile from './screens/DriverProfile';

const DriverShell = () => {
  const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('orders');
  const [me, setMe] = useState(null);

  useEffect(() => {
    const handler = () => true;
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    let removeBefore;
    if (navigation && navigation.addListener) {
      removeBefore = navigation.addListener('beforeRemove', (e) => {
        if (e.data?.action?.type === 'GO_BACK') {
          e.preventDefault();
        }
      });
    }
    return () => {
      sub.remove();
      removeBefore && removeBefore();
    };
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('driverUser');
        if (stored) setMe(JSON.parse(stored));
      } catch (_) {}
    })();
  }, []);

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('driverAuthToken');
      await AsyncStorage.removeItem('driverUser');
    } catch (_) {}
    const parent = navigation.getParent && navigation.getParent();
    const root = parent && parent.getParent ? parent.getParent() : null;
    const dispatcher = (root && root.dispatch) || (parent && parent.dispatch) || navigation.dispatch;
    dispatcher(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  };

  const Screen = active === 'orders'
    ? DriverOrders
    : active === 'history'
      ? DriverHistoryOrders
    : active === 'payments'
      ? DriverPayments
      : DriverProfile;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(v => !v)}>
          <Icon name="menu-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Portal</Text>
        <TouchableOpacity onPress={logout}>
          <Icon name="log-out-outline" size={22} color="#f00" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <Screen navigation={navigation} />
      </View>

      {menuOpen && (
        <TouchableOpacity style={styles.overlay} onPress={() => setMenuOpen(false)} />
      )}

      <View style={[styles.sideMenu, { transform: [{ translateX: menuOpen ? 0 : -260 }] }]}>
        <View style={styles.menuHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(me?.name || 'D').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Welcome {me?.name || 'Driver'}</Text>
            {me?.email ? <Text style={styles.subtle}>{me.email}</Text> : null}
          </View>
        </View>

        <Text style={styles.menuTitle}>Menu</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('orders'); setMenuOpen(false); }}>
          <Icon name="list-outline" size={18} color={active === 'orders' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active === 'orders' && styles.menuTextActive]}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('history'); setMenuOpen(false); }}>
          <Icon name="time-outline" size={18} color={active === 'history' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active === 'history' && styles.menuTextActive]}>History Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('payments'); setMenuOpen(false); }}>
          <Icon name="card-outline" size={18} color={active === 'payments' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active === 'payments' && styles.menuTextActive]}>Payments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('profile'); setMenuOpen(false); }}>
          <Icon name="person-outline" size={18} color={active === 'profile' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active === 'profile' && styles.menuTextActive]}>Profile</Text>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 8 }} />
        <TouchableOpacity style={styles.menuItem} onPress={logout}>
          <Icon name="log-out-outline" size={18} color="#f00" />
          <Text style={[styles.menuText, { color: '#f00', fontWeight: '700' }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 2 },
  sideMenu: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 260, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: '#eee', zIndex: 3, elevation: 4 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  welcome: { fontWeight: '800', color: '#333' },
  subtle: { color: '#6b7280', fontSize: 12 },
  menuTitle: { fontWeight: '700', color: '#999', marginBottom: 12, marginTop: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  menuText: { color: '#666', fontWeight: '600' },
  menuTextActive: { color: '#f7ab18' },
});

export default DriverShell;


