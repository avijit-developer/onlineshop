import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverShell from './DriverShell';
import DriverOrders from './screens/DriverOrders';
import DriverOrderDetails from './screens/DriverOrderDetails';
import DriverPayments from './screens/DriverPayments';
import DriverProfile from './screens/DriverProfile';

const Stack = createNativeStackNavigator();

const DriverPortalNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="DriverShell">
      <Stack.Screen name="DriverShell" component={DriverShell} />
      <Stack.Screen name="DriverOrders" component={DriverOrders} />
      <Stack.Screen name="DriverOrderDetails" component={DriverOrderDetails} />
      <Stack.Screen name="DriverPayments" component={DriverPayments} />
      <Stack.Screen name="DriverProfile" component={DriverProfile} />
    </Stack.Navigator>
  );
};

export default DriverPortalNavigator;


