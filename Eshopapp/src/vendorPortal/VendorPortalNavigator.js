import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import VendorShell from './VendorShell';

const Stack = createNativeStackNavigator();
const VendorTabs = () => <VendorShell />;

const VendorPortalNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="VendorAuth">
      <Stack.Screen name="VendorAuth" component={require('./screens/VendorAuth').default} />
      <Stack.Screen name="VendorTabs" component={VendorTabs} />
    </Stack.Navigator>
  );
};

export default VendorPortalNavigator;
 