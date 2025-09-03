import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import VendorDashboard from './screens/VendorDashboard';
import VendorOrders from './screens/VendorOrders';
import VendorProducts from './screens/VendorProducts';
import VendorReports from './screens/VendorReports';

const Stack = createNativeStackNavigator();
const VendorTabs = ({ navigation }) => {
  // Render active screen manually with a simple footer
  const [active, setActive] = React.useState('VDashboard');

  const Screen = active === 'VDashboard' ? VendorDashboard
    : active === 'VOrders' ? VendorOrders
    : active === 'VProducts' ? VendorProducts
    : VendorReports;

  const FooterButton = ({ id, title, icon }) => (
    <TouchableOpacity style={styles.tabBtn} onPress={() => setActive(id)}>
      <Icon name={icon} size={22} color={active === id ? '#f7ab18' : '#999'} />
      <Text style={[styles.tabText, active === id && { color: '#f7ab18' }]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Screen navigation={navigation} />
      <View style={styles.footer}>
        <FooterButton id="VDashboard" title="Dashboard" icon="home-outline" />
        <FooterButton id="VOrders" title="Orders" icon="list-outline" />
        <FooterButton id="VProducts" title="Products" icon="cube-outline" />
        <FooterButton id="VReports" title="Reports" icon="stats-chart-outline" />
      </View>
    </View>
  );
};

const VendorPortalNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="VendorAuth">
      <Stack.Screen name="VendorAuth" component={require('./screens/VendorAuth').default} />
      <Stack.Screen name="VendorTabs" component={VendorTabs} />
    </Stack.Navigator>
  );
};

export default VendorPortalNavigator;

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  tabBtn: { alignItems: 'center', gap: 2 },
  tabText: { fontSize: 11, color: '#999', fontWeight: '600' },
});