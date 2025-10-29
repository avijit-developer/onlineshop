import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ProductList from '../screens/ProductList';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import LoginScreen from '../screens/LoginScreen';
import AddressSelectionScreen from '../screens/AddressSelectionScreen';
import FilterScreen from '../screens/FilterScreen';
import CategoryScreen from '../screens/CategoryScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import PaymentScreen from '../screens/PaymentScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import OrderListScreen from '../screens/OrderListScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddressDetailsScreen from '../screens/AddressDetailsScreen';
import WishlistScreen from '../screens/WishlistScreen';
import VendorApplyScreen from '../screens/VendorApplyScreen';
import ReviewFormScreen from '../screens/ReviewFormScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import SplashScreen from '../screens/SplashScreen';
import SetupScreen from '../screens/SetupScreen';
import LegalWebViewScreen from '../screens/LegalWebViewScreen';
import VendorPortalNavigator from '../vendorPortal/VendorPortalNavigator';
import DriverApplyScreen from '../screens/DriverApplyScreen';
import DriverLoginScreen from '../screens/DriverLoginScreen';
import DriverPortalNavigator from '../driverPortal/DriverPortalNavigator';
import NetworkErrorScreen from '../screens/NetworkErrorScreen';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="NetworkError" component={NetworkErrorScreen} />
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="ProductList" component={ProductList} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="OrderList" component={OrderListScreen} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
      <Stack.Screen name="AddressList" component={AddressListScreen} />
      <Stack.Screen name="AddressDetails" component={AddressDetailsScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="VendorApply" component={VendorApplyScreen} />
      <Stack.Screen name="DriverApply" component={DriverApplyScreen} />
      <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
      <Stack.Screen name="DriverPortal" component={DriverPortalNavigator} />
      <Stack.Screen name="AddressSelection" component={AddressSelectionScreen} />
      <Stack.Screen name="Filter" component={FilterScreen} />
      <Stack.Screen name="ReviewForm" component={ReviewFormScreen} />
      <Stack.Screen name="LegalWebView" component={LegalWebViewScreen} />
      <Stack.Screen name="VendorPortal" component={VendorPortalNavigator} />
    </Stack.Navigator>
  );
};

export default RootNavigator;