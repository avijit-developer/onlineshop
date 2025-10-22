import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import VendorShell from './VendorShell';
import VendorOrderDetails from './screens/VendorOrderDetails';
import VendorProductDetails from './screens/VendorProductDetails';

const Stack = createNativeStackNavigator();
const VendorTabs = () => <VendorShell />;

const VendorPortalNavigator = () => {
  const [initialRoute, setInitialRoute] = React.useState(null);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const vtok = await AsyncStorage.getItem('vendorAuthToken');
        if (!vtok) {
          setInitialRoute('VendorAuth');
          setChecking(false);
          return;
        }
        // Validate token by querying a vendor-protected endpoint
        try {
          const res = await fetch(`${require('../utils/api').API_BASE}/api/v1/auth/current-permissions`, { headers: { Authorization: `Bearer ${vtok}` } });
          if (res.status === 401) {
            await AsyncStorage.removeItem('vendorAuthToken');
            setInitialRoute('VendorAuth');
          } else {
            setInitialRoute('VendorTabs');
          }
        } catch (_) {
          setInitialRoute('VendorTabs');
        }
      } catch (_) {
        setInitialRoute('VendorAuth');
      }
      finally { setChecking(false); }
    })();
  }, []);

  if (checking && !initialRoute) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="VendorAuth" component={require('./screens/VendorAuth').default} />
      <Stack.Screen name="VendorTabs" component={VendorTabs} />
      <Stack.Screen name="VendorOrderDetails" component={VendorOrderDetails} />
      <Stack.Screen name="VendorProductDetails" component={VendorProductDetails} />
    </Stack.Navigator>
  );
};

export default VendorPortalNavigator;
 