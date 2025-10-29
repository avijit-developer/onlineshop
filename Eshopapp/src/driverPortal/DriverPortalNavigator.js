import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverShell from './DriverShell';
import DriverDashboard from './screens/DriverDashboard';
import DriverOrders from './screens/DriverOrders';
import DriverProfile from './screens/DriverProfile';

const Stack = createNativeStackNavigator();

const DriverPortalNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="DriverShell">
      <Stack.Screen name="DriverShell" component={DriverShell} />
      <Stack.Screen name="DriverDashboard" component={DriverDashboard} />
      <Stack.Screen name="DriverOrders" component={DriverOrders} />
      <Stack.Screen name="DriverProfile" component={DriverProfile} />
    </Stack.Navigator>
  );
};

export default DriverPortalNavigator;


