import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import VendorShell from './VendorShell';

const Stack = createNativeStackNavigator();
const VendorTabs = () => <VendorShell />;

const VendorPortalNavigator = () => {
  const [initialRoute, setInitialRoute] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const vtok = await AsyncStorage.getItem('vendorAuthToken');
        setInitialRoute(vtok ? 'VendorTabs' : 'VendorAuth');
      } catch (_) {
        setInitialRoute('VendorAuth');
      }
    })();
  }, []);

  if (!initialRoute) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="VendorAuth" component={require('./screens/VendorAuth').default} />
      <Stack.Screen name="VendorTabs" component={VendorTabs} />
    </Stack.Navigator>
  );
};

export default VendorPortalNavigator;
 