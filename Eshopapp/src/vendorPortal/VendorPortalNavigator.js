import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import VendorDashboard from './screens/VendorDashboard';
import VendorOrders from './screens/VendorOrders';
import VendorProducts from './screens/VendorProducts';
import VendorReports from './screens/VendorReports';

const Stack = createNativeStackNavigator();

const VendorPortalNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="VendorDashboard">
      <Stack.Screen name="VendorDashboard" component={VendorDashboard} />
      <Stack.Screen name="VendorOrders" component={VendorOrders} />
      <Stack.Screen name="VendorProducts" component={VendorProducts} />
      <Stack.Screen name="VendorReports" component={VendorReports} />
    </Stack.Navigator>
  );
};

export default VendorPortalNavigator;