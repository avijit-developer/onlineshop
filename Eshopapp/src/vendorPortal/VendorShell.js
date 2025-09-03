import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VendorDashboard from './screens/VendorDashboard';
import VendorOrders from './screens/VendorOrders';
import VendorProducts from './screens/VendorProducts';
import VendorReports from './screens/VendorReports';
import api from '../utils/api';

const VendorShell = () => {
  const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [active, setActive] = React.useState('dashboard');
  const [assigned, setAssigned] = React.useState([]);
  
  useEffect(() => {
    const handler = () => true; // disable hardware back inside vendor shell
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    let removeBefore;
    if (navigation && navigation.addListener) {
      removeBefore = navigation.addListener('beforeRemove', (e) => {
        if (e.data?.action?.type === 'GO_BACK') {
          e.preventDefault();
        }
      });
    }
    return () => { sub.remove(); removeBefore && removeBefore(); };
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getAssignedVendors();
        if (res?.success) {
          setAssigned((res.data || []).map(v => ({ id: v._id || v.id, name: v.companyName })));
        }
      } catch (_) {}
    })();
  }, []);

  const Screen = active === 'dashboard' ? VendorDashboard
    : active === 'orders' ? VendorOrders
    : active === 'products' ? VendorProducts
    : VendorReports;

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('vendorAuthToken');
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

  const onMenuLogoutPress = async () => {
    setMenuOpen(false);
    // allow menu close animation to settle before resetting navigator
    setTimeout(() => { logout(); }, 10);
  };

  const goMainLogout = async () => {
    await logout();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(v => !v)}>
          <Icon name="menu-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor Portal</Text>
        <TouchableOpacity onPress={goMainLogout}>
          <Icon name="log-out-outline" size={22} color="#f00" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Screen navigation={navigation} />
      </View>

      {/* Side menu overlay */}
      {menuOpen && (
        <TouchableOpacity style={styles.overlay} onPress={() => setMenuOpen(false)} />
      )}

      {/* Side menu */}
      <View style={[styles.sideMenu, { transform: [{ translateX: menuOpen ? 0 : -260 }] }]}> 
        <Text style={styles.menuTitle}>Menu</Text>
        {assigned.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={[styles.menuTitle, { color: '#333' }]}>Assigned Vendors</Text>
            {assigned.map(v => (
              <Text key={v.id} style={{ color: '#666', marginBottom: 2 }} numberOfLines={1}>• {v.name}</Text>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('dashboard'); setMenuOpen(false); }}>
          <Icon name="home-outline" size={18} color={active==='dashboard' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active==='dashboard' && styles.menuTextActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('orders'); setMenuOpen(false); }}>
          <Icon name="list-outline" size={18} color={active==='orders' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active==='orders' && styles.menuTextActive]}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('products'); setMenuOpen(false); }}>
          <Icon name="cube-outline" size={18} color={active==='products' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active==='products' && styles.menuTextActive]}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setActive('reports'); setMenuOpen(false); }}>
          <Icon name="stats-chart-outline" size={18} color={active==='reports' ? '#f7ab18' : '#666'} />
          <Text style={[styles.menuText, active==='reports' && styles.menuTextActive]}>Reports</Text>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 8 }} />
        <TouchableOpacity style={styles.menuItem} onPress={onMenuLogoutPress}>
          <Icon name="log-out-outline" size={18} color="#f00" />
          <Text style={[styles.menuText, { color: '#f00', fontWeight: '700' }]}>Logout</Text>
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
  menuTitle: { fontWeight: '700', color: '#999', marginBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  menuText: { color: '#666', fontWeight: '600' },
  menuTextActive: { color: '#f7ab18' },
});

export default VendorShell;