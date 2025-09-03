import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import VendorDashboard from './screens/VendorDashboard';
import VendorOrders from './screens/VendorOrders';
import VendorProducts from './screens/VendorProducts';
import VendorReports from './screens/VendorReports';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const VendorTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: '#f7ab18',
      tabBarInactiveTintColor: '#999',
      tabBarStyle: { borderTopColor: '#eee' },
      tabBarIcon: ({ color, size }) => {
        let name = 'grid-outline';
        if (route.name === 'VDashboard') name = 'home-outline';
        else if (route.name === 'VOrders') name = 'list-outline';
        else if (route.name === 'VProducts') name = 'cube-outline';
        else if (route.name === 'VReports') name = 'stats-chart-outline';
        return <Icon name={name} size={size} color={color} />;
      }
    })}
  >
    <Tab.Screen name="VDashboard" component={VendorDashboard} options={{ title: 'Dashboard' }} />
    <Tab.Screen name="VOrders" component={VendorOrders} options={{ title: 'Orders' }} />
    <Tab.Screen name="VProducts" component={VendorProducts} options={{ title: 'Products' }} />
    <Tab.Screen name="VReports" component={VendorReports} options={{ title: 'Reports' }} />
  </Tab.Navigator>
);

const VendorPortalNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="VendorAuth">
      <Stack.Screen name="VendorAuth" component={require('./screens/VendorAuth').default} />
      <Stack.Screen name="VendorTabs" component={VendorTabs} />
    </Stack.Navigator>
  );
};

export default VendorPortalNavigator;