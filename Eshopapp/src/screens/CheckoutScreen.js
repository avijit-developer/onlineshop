import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import { useAddress } from '../contexts/AddressContext';
import api from '../utils/api';
import { useUser } from '../contexts/UserContext';
import { geocodeAddress } from '../utils/locationUtils';

const CheckoutScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { cartItems, getCartTotal, getItemTotal, clearCart, cartCoupon } = useCart();
  const { addresses, getDefaultAddress, addAddress, refreshAddresses, isLoading } = useAddress();
  const { addOrder, refreshOrders } = useUser();

  // Get selected address from navigation params or use default
  const selectedAddressFromParams = route.params?.selectedAddress;
  const [selectedAddress, setSelectedAddress] = useState(null);

  // Form state for new address (when no addresses exist)
  const [shippingInfo, setShippingInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
  });

  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  useEffect(() => {
    if (cartCoupon) {
      setAppliedCoupon(cartCoupon);
      setCouponCode(cartCoupon.couponCode || '');
    } else {
      setAppliedCoupon(null);
      setCouponCode('');
    }
  }, [cartCoupon]);
  const [couponError, setCouponError] = useState('');
  const [validating, setValidating] = useState(false);
  const [shippingSettings, setShippingSettings] = useState(null);
  const [isAddressValid, setIsAddressValid] = useState(true);
  const [deliveryAreaError, setDeliveryAreaError] = useState('');
  const [validatingAddress, setValidatingAddress] = useState(false);
  const lastValidatedAddressId = useRef(null);
  // Store validated coordinates to reuse during order placement
  const validatedCoordinates = useRef({ latitude: null, longitude: null, addressKey: null });
  
  // Memoize default address to avoid unnecessary re-renders
  const defaultAddress = useMemo(() => {
    return getDefaultAddress();
  }, [addresses]);

  useEffect(() => {
    (async () => {
      try {
        console.log('🔍 Fetching shipping settings...');
        const res = await api.getShippingSettings();
        console.log('🔍 Raw API Response:', JSON.stringify(res, null, 2));
        const data = res?.data || res;
        console.log('🔍 Extracted Data:', JSON.stringify(data, null, 2));
        console.log('🔍 Delivery Area in Data:', data?.deliveryArea);
        setShippingSettings(data || {});
        console.log('🔍 Shipping Settings State Set:', JSON.stringify(data || {}, null, 2));
      } catch (error) {
        console.error('❌ Error fetching shipping settings:', error);
        setShippingSettings(null);
      }
    })();
  }, []);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Validate address against delivery area (only once per address change)
  useEffect(() => {
    const validateAddressForDelivery = async () => {
      // Wait for shipping settings to be loaded
      if (!shippingSettings) {
        console.log('⏳ Waiting for shipping settings to load...');
        return;
      }

      const address = selectedAddress || getDefaultAddress();
      if (!address) {
        setIsAddressValid(true); // Allow if no address selected yet
        setDeliveryAreaError('');
        lastValidatedAddressId.current = null;
        validatedCoordinates.current = { latitude: null, longitude: null, addressKey: null };
        return;
      }

      // Check if we already validated this address
      const addressId = address.id || address._id;
      const addressKey = `${addressId}_${address.latitude}_${address.longitude}`;
      
      if (lastValidatedAddressId.current === addressKey) {
        console.log('Address already validated, skipping...');
        return;
      }

      const deliveryArea = shippingSettings?.deliveryArea;
      console.log('========================================');
      console.log('🔍 ADDRESS VALIDATION DEBUG');
      console.log('========================================');
      console.log('📍 Validation started. Address:', JSON.stringify(address, null, 2));
      console.log('⚙️ Shipping settings FULL:', JSON.stringify(shippingSettings, null, 2));
      console.log('⚙️ Shipping settings keys:', shippingSettings ? Object.keys(shippingSettings) : 'null');
      console.log('📍 Delivery area:', deliveryArea);
      console.log('📍 Delivery area type:', typeof deliveryArea);
      console.log('📍 Delivery area keys:', deliveryArea ? Object.keys(deliveryArea) : 'null');
      console.log('========================================');
      
      if (!deliveryArea || deliveryArea.latitude == null || deliveryArea.longitude == null || deliveryArea.radius == null) {
        // No delivery area restriction configured
        console.log('⚠️ No delivery area configured - allowing order');
        setIsAddressValid(true);
        setDeliveryAreaError('');
        lastValidatedAddressId.current = addressKey;
        validatedCoordinates.current = { latitude: null, longitude: null, addressKey: null };
        return;
      }

      setValidatingAddress(true);
      try {
        let addressLat = null;
        let addressLon = null;

        // Priority 1: Try direct latitude/longitude fields (from AddressMapScreen)
        if (address.latitude != null && address.longitude != null) {
          addressLat = Number(address.latitude);
          addressLon = Number(address.longitude);
          console.log('Using direct latitude/longitude from address:', addressLat, addressLon);
        }
        // Priority 2: Try coordinates from location object
        else if (address.location?.coordinates && Array.isArray(address.location.coordinates) && address.location.coordinates.length >= 2) {
          addressLat = Number(address.location.coordinates[1]);
          addressLon = Number(address.location.coordinates[0]);
          console.log('Using coordinates from address.location:', addressLat, addressLon);
        }

        // If still no coordinates, geocode the address (fallback)
        if (!addressLat || !addressLon || isNaN(addressLat) || isNaN(addressLon)) {
          console.log('No coordinates found, attempting geocoding...');
          // Build address string more carefully - try multiple formats
          const addressFormats = [];
          
          // Format 1: Full address
          const addressParts = [];
          if (address.address) addressParts.push(address.address);
          if (address.city) addressParts.push(address.city);
          if (address.state) addressParts.push(address.state);
          if (address.zipCode) addressParts.push(address.zipCode);
          if (address.country) addressParts.push(address.country);
          if (addressParts.length > 0) {
            addressFormats.push(addressParts.join(', ').trim());
          }
          
          // Format 2: City, State, Country (if full address fails)
          if (address.city && address.state && address.country) {
            addressFormats.push(`${address.city}, ${address.state}, ${address.country}`.trim());
          }
          
          // Format 3: City, Country (minimal)
          if (address.city && address.country) {
            addressFormats.push(`${address.city}, ${address.country}`.trim());
          }
          
          console.log('Trying geocoding with formats:', addressFormats);
          
          for (const addressStr of addressFormats) {
            if (addressStr && addressStr.length > 3) {
              try {
                const coords = await geocodeAddress(addressStr);
                console.log('Geocoding result for', addressStr, ':', coords);
                if (coords && coords.latitude && coords.longitude) {
                  addressLat = Number(coords.latitude);
                  addressLon = Number(coords.longitude);
                  console.log('Successfully geocoded. Coordinates:', addressLat, addressLon);
                  break; // Success, stop trying other formats
                }
              } catch (err) {
                console.error('Geocoding error for format', addressStr, ':', err);
              }
            }
          }
          
          if (!addressLat || !addressLon || isNaN(addressLat) || isNaN(addressLon)) {
            console.warn('All geocoding attempts failed for address');
          }
        }

        // If still no coordinates, cannot validate - block order to be safe
        if (!addressLat || !addressLon || isNaN(addressLat) || isNaN(addressLon)) {
          console.warn('Cannot determine address coordinates for validation');
          setIsAddressValid(false);
          setDeliveryAreaError('Delivery is not available at this address. Please select a different address within our delivery area or contact us for assistance.');
          lastValidatedAddressId.current = addressKey;
          validatedCoordinates.current = { latitude: null, longitude: null, addressKey: null };
          return;
        }

        console.log('Delivery area:', deliveryArea);
        console.log('Address coordinates:', addressLat, addressLon);
        console.log('Delivery center:', deliveryArea.latitude, deliveryArea.longitude);
        console.log('Delivery radius:', deliveryArea.radius, 'km');

        const distance = calculateDistance(
          addressLat,
          addressLon,
          Number(deliveryArea.latitude),
          Number(deliveryArea.longitude)
        );

        console.log('========================================');
        console.log('📍 DELIVERY AREA VALIDATION');
        console.log('========================================');
        console.log('📍 Address Coordinates:', addressLat, addressLon);
        console.log('📍 Delivery Center:', deliveryArea.latitude, deliveryArea.longitude);
        console.log('📍 Calculated Distance:', distance.toFixed(2), 'km');
        console.log('📍 Delivery Radius:', deliveryArea.radius, 'km');
        console.log('📍 Distance Comparison:', distance.toFixed(2), 'km <=', deliveryArea.radius, 'km =', distance <= Number(deliveryArea.radius));
        console.log('📍 Status:', distance <= Number(deliveryArea.radius) ? '✅ WITHIN DELIVERY AREA' : '❌ OUTSIDE DELIVERY AREA');
        console.log('========================================');

        if (distance > Number(deliveryArea.radius)) {
          setIsAddressValid(false);
          setDeliveryAreaError(`This address is ${distance.toFixed(2)} km away from our delivery area. Maximum delivery distance is ${deliveryArea.radius} km.`);
          console.log('Address is OUTSIDE delivery area');
          validatedCoordinates.current = { latitude: null, longitude: null, addressKey: null };
        } else {
          setIsAddressValid(true);
          setDeliveryAreaError('');
          console.log('Address is WITHIN delivery area');
          // Store validated coordinates for use during order placement
          validatedCoordinates.current = { 
            latitude: addressLat, 
            longitude: addressLon, 
            addressKey: addressKey 
          };
        }
        
        // Mark this address as validated
        lastValidatedAddressId.current = addressKey;
      } catch (error) {
        console.error('Error validating address:', error);
        // On error, block order to be safe
        setIsAddressValid(false);
        setDeliveryAreaError('Delivery is not available at this address. Please select a different address within our delivery area.');
        lastValidatedAddressId.current = addressKey;
      } finally {
        setValidatingAddress(false);
      }
    };

    validateAddressForDelivery();
  }, [
    selectedAddress?.id, 
    selectedAddress?.latitude, 
    selectedAddress?.longitude,
    // Also check default address if no selected address
    defaultAddress?.id,
    defaultAddress?.latitude,
    defaultAddress?.longitude,
    shippingSettings?.deliveryArea?.latitude,
    shippingSettings?.deliveryArea?.longitude,
    shippingSettings?.deliveryArea?.radius,
    shippingSettings // Add full shippingSettings to trigger when it's loaded
  ]);

  // Refresh addresses when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      refreshAddresses();
    }, [refreshAddresses])
  );

  // Only set selectedAddress when explicit param provided; otherwise derive from default
  useEffect(() => {
    if (selectedAddressFromParams) {
      setSelectedAddress(selectedAddressFromParams);
    } else {
      setSelectedAddress(null);
    }
  }, [selectedAddressFromParams]);

  // Helpers to read settings safely
  const pick = (obj, keys, fallback) => {
    for (const k of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== '') {
        return obj[k];
      }
    }
    return fallback;
  };
  const pickDeep = (obj, paths, fallback) => {
    for (const path of paths) {
      let cur = obj;
      let ok = true;
      for (const key of path) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, key)) cur = cur[key]; else { ok = false; break; }
      }
      if (ok && cur != null && cur !== '') return cur;
    }
    return fallback;
  };

  // Calculate totals using admin shipping settings (flat fee + optional threshold)
  const availableItems = (cartItems || []).filter(ci => (ci.enabled !== false) && ((ci.variantInfo?.stock || ci.stock || 0) > 0));
  const subtotal = availableItems.reduce((sum, it) => sum + getItemTotal(it), 0);
  const flatShipping = Number(pickDeep(shippingSettings || {}, [
    ['flatShippingFee'], ['flat_rate'], ['flat'], ['price'], ['amount'],
    ['settings','flatShippingFee'], ['config','flatShippingFee'], ['data','flatShippingFee']
  ], 0)) || 0;
  const freeShipThresholdRaw = pickDeep(shippingSettings || {}, [
    ['freeShippingThreshold'], ['free_shipping_threshold'], ['freeShippingMin'], ['freeMin'],
    ['settings','freeShippingThreshold'], ['config','freeShippingThreshold'], ['data','freeShippingThreshold']
  ], null);
  const freeShipThreshold = freeShipThresholdRaw != null ? Number(freeShipThresholdRaw) : null;
  const taxRate = Number(pickDeep(shippingSettings || {}, [
    ['taxRate'], ['tax_rate'], ['settings','taxRate'], ['config','taxRate'], ['data','taxRate']
  ], 0)) || 0;
  const computedShipping = (freeShipThreshold != null && subtotal >= Number(freeShipThreshold)) ? 0 : Number(flatShipping);
  const shipping = (cartCoupon?.freeShipping ? 0 : computedShipping);
  const tax = Math.max(0, subtotal * (taxRate / 100));
  const discount = appliedCoupon?.discountAmount || 0;
  const total = Math.max(0, subtotal + shipping + tax - discount);

  // Derive effective address: prefer selected (from params), else default
  const effectiveAddress = selectedAddress || getDefaultAddress();

  const handleInputChange = (field, value) => {
    setShippingInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddNewAddress = async () => {
    // Validate form
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];
    for (const field of requiredFields) {
      if (!shippingInfo[field] || shippingInfo[field].trim() === '') {
        Alert.alert('Validation Error', `Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return;
      }
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shippingInfo.email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    // Basic phone validation
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(shippingInfo.phone)) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    try {
      const newAddress = await addAddress(shippingInfo);
      setSelectedAddress(newAddress);
      setShowAddressForm(false);
      Alert.alert('Success', 'Address added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add address. Please try again.');
    }
  };

  const validateCheckout = () => {
    const addr = selectedAddress || getDefaultAddress();
    if (!addr) {
      Alert.alert('Validation Error', 'Please select or add a shipping address');
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateCheckout()) return;

    // Check if address is valid for delivery before proceeding
    if (!isAddressValid) {
      Alert.alert('Delivery Not Available', deliveryAreaError || 'This address is outside our delivery area. Please select a different address.');
      return;
    }

    setIsProcessing(true);

    try {
      // Get address coordinates - ensure we always extract from selected address
      let addressLatitude = null;
      let addressLongitude = null;
      
      const addressToUse = selectedAddress || getDefaultAddress();
      
      if (!addressToUse) {
        console.warn('⚠️ No address selected for order placement');
      } else {
        // Priority 1: Location coordinates array (most reliable - from database)
        if (addressToUse?.location?.coordinates && Array.isArray(addressToUse.location.coordinates) && addressToUse.location.coordinates.length >= 2) {
          addressLatitude = Number(addressToUse.location.coordinates[1]); // latitude is at index 1
          addressLongitude = Number(addressToUse.location.coordinates[0]); // longitude is at index 0
          console.log('✅ Order placement: Using location.coordinates from address:', addressLatitude, addressLongitude);
        }
        // Priority 2: Direct latitude/longitude fields (from AddressMapScreen)
        else if (addressToUse?.latitude != null && addressToUse?.longitude != null) {
          addressLatitude = Number(addressToUse.latitude);
          addressLongitude = Number(addressToUse.longitude);
          console.log('✅ Order placement: Using direct lat/long fields from address:', addressLatitude, addressLongitude);
        }
        // Priority 3: Use validated coordinates if they match the current address
        else {
          const addressId = addressToUse?.id || addressToUse?._id;
          const currentAddressKey = addressToUse ? `${addressId}_${addressToUse.latitude}_${addressToUse.longitude}` : null;
          
          if (validatedCoordinates.current.addressKey === currentAddressKey && 
              validatedCoordinates.current.latitude != null && 
              validatedCoordinates.current.longitude != null) {
            addressLatitude = validatedCoordinates.current.latitude;
            addressLongitude = validatedCoordinates.current.longitude;
            console.log('✅ Order placement: Using validated coordinates from previous validation:', addressLatitude, addressLongitude);
          } else {
            // Priority 4: If no coordinates in address, geocode the address string
            const shippingAddressStr = `${effectiveAddress.firstName} ${effectiveAddress.lastName}, ${effectiveAddress.address}, ${effectiveAddress.city}, ${effectiveAddress.state} ${effectiveAddress.zipCode}, ${effectiveAddress.country}`;
            try {
              console.log('⚠️ No coordinates found in address, geocoding...');
              const coords = await geocodeAddress(shippingAddressStr);
              if (coords) {
                addressLatitude = Number(coords.latitude);
                addressLongitude = Number(coords.longitude);
                console.log('✅ Order placement: Geocoded coordinates:', addressLatitude, addressLongitude);
              } else {
                console.warn('⚠️ Geocoding failed - no coordinates available');
              }
            } catch (err) {
              console.error('❌ Failed to geocode address:', err);
            }
          }
        }
      }
      
      // Final validation - ensure we have coordinates
      if (addressLatitude == null || addressLongitude == null) {
        console.warn('⚠️ WARNING: Order will be placed without coordinates!');
        console.warn('   Address used:', JSON.stringify(addressToUse, null, 2));
      }

      // Delivery area validation is already done on checkout screen
      // No need to validate again during order placement

      // Create order via API
      const shippingAddressStr = `${effectiveAddress.firstName} ${effectiveAddress.lastName}, ${effectiveAddress.address}, ${effectiveAddress.city}, ${effectiveAddress.state} ${effectiveAddress.zipCode}, ${effectiveAddress.country}`;
      
      console.log('========================================');
      console.log('📦 PLACING ORDER - COORDINATES CHECK');
      console.log('========================================');
      console.log('📍 addressLatitude:', addressLatitude, 'Type:', typeof addressLatitude);
      console.log('📍 addressLongitude:', addressLongitude, 'Type:', typeof addressLongitude);
      console.log('📍 Address to use:', JSON.stringify(addressToUse, null, 2));
      console.log('📍 Validated coordinates:', JSON.stringify(validatedCoordinates.current, null, 2));
      console.log('========================================');
      
      const orderPayload = {
        items: availableItems.map(ci => ({
          product: ci.id,
          name: ci.name,
          sku: ci.variantInfo?.sku || ci.sku || '',
          price: (ci.variantInfo?.specialPrice ?? ci.variantInfo?.price ?? ci.specialPrice ?? ci.regularPrice ?? ci.price ?? 0),
          quantity: ci.quantity,
          image: (ci.variantInfo?.images?.[0] || ci.images?.[0] || null),
          selectedAttributes: ci.selectedAttributes || {},
        })),
        shippingAddress: shippingAddressStr,
        paymentMethod,
        tax: taxRate,
        shippingCost: appliedCoupon?.freeShipping ? 0 : shipping,
        couponCode: (appliedCoupon?.couponCode || couponCode.trim()) || undefined,
        orderNote: orderNote.trim() || undefined,
        // Always send coordinates (even if null) - backend will handle null values
        addressLatitude: addressLatitude != null ? Number(addressLatitude) : null,
        addressLongitude: addressLongitude != null ? Number(addressLongitude) : null,
      };
      
      console.log('📦 Order payload (coordinates):', {
        addressLatitude: orderPayload.addressLatitude,
        addressLongitude: orderPayload.addressLongitude
      });
      
      const response = await api.createOrder(orderPayload);

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to place order');
      }

      await clearCart();
      try { await refreshOrders(); } catch (_) {}
      navigation.replace('OrderSuccess', { orderId: response.data._id });
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderAddressSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="location-outline" size={20} color="#f7ab18" />
        <Text style={styles.sectionTitle}>Shipping Address</Text>
        <TouchableOpacity 
          style={styles.changeButton}
          onPress={() => navigation.navigate('AddressList', { isSelecting: true })}
        >
          <Text style={styles.changeButtonText}>Change</Text>
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading addresses...</Text>
        </View>
      ) : effectiveAddress ? (
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <Text style={styles.addressLabel}>
              {effectiveAddress.label || `${effectiveAddress.firstName} ${effectiveAddress.lastName}`}
            </Text>
            {effectiveAddress.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>Default</Text>
              </View>
            )}
          </View>
          
          <View style={styles.addressContent}>
            <Text style={styles.addressText}>
              {effectiveAddress.firstName} {effectiveAddress.lastName}
            </Text>
            <Text style={styles.addressText}>
              {effectiveAddress.address}
            </Text>
            <Text style={styles.addressText}>
              {effectiveAddress.city}, {effectiveAddress.state} {effectiveAddress.zipCode}
            </Text>
            <Text style={styles.addressText}>
              {effectiveAddress.country}
            </Text>
            <Text style={styles.contactText}>
              📧 {effectiveAddress.email} | 📱 {effectiveAddress.phone}
            </Text>
          </View>
          
          {/* Delivery Area Validation Status */}
          {validatingAddress ? (
            <View style={styles.validationStatusContainer}>
              <ActivityIndicator size="small" color="#f7ab18" />
              <Text style={styles.validationStatusText}>Validating delivery area...</Text>
            </View>
          ) : deliveryAreaError ? (
            <View style={[styles.validationStatusContainer, styles.validationErrorContainer]}>
              <Icon name="close-circle" size={18} color="#d32f2f" />
              <Text style={[styles.validationStatusText, styles.validationErrorText]}>
                {deliveryAreaError}
              </Text>
            </View>
          ) : isAddressValid && effectiveAddress ? (
            <View style={[styles.validationStatusContainer, styles.validationSuccessContainer]}>
              <Icon name="checkmark-circle" size={18} color="#4caf50" />
              <Text style={[styles.validationStatusText, styles.validationSuccessText]}>
                Delivery available at this address
              </Text>
            </View>
          ) : null}
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.noAddressContainer}>
          <Text style={styles.noAddressText}>No addresses found</Text>
          <TouchableOpacity 
            style={styles.addAddressButton}
            onPress={() => setShowAddressForm(true)}
          >
            <Icon name="add-circle-outline" size={16} color="#f7ab18" />
            <Text style={styles.addAddressButtonText}>Add New Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noAddressContainer}>
          <Text style={styles.noAddressText}>Please select an address</Text>
          <TouchableOpacity 
            style={styles.selectAddressButton}
            onPress={() => navigation.navigate('AddressList', { isSelecting: true })}
          >
            <Icon name="location-outline" size={16} color="#f7ab18" />
            <Text style={styles.selectAddressButtonText}>Select Address</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* New Address Form (shown when no addresses exist) */}
      {showAddressForm && (
        <View style={styles.addressFormContainer}>
          <Text style={styles.formTitle}>Add New Address</Text>
          
          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>First Name *</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder="Enter first name"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Last Name *</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder="Enter last name"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.email}
                onChangeText={(value) => handleInputChange('email', value)}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Phone *</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Address *</Text>
          <TextInput
            style={[styles.textInput, styles.fullWidthInput]}
            value={shippingInfo.address}
            onChangeText={(value) => handleInputChange('address', value)}
            placeholder="Enter full address"
            multiline
            numberOfLines={3}
          />

          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>City *</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.city}
                onChangeText={(value) => handleInputChange('city', value)}
                placeholder="Enter city"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>State *</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.state}
                onChangeText={(value) => handleInputChange('state', value)}
                placeholder="Enter state"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>ZIP Code *</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.zipCode}
                onChangeText={(value) => handleInputChange('zipCode', value)}
                placeholder="Enter ZIP code"
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Country</Text>
              <TextInput
                style={styles.textInput}
                value={shippingInfo.country}
                onChangeText={(value) => handleInputChange('country', value)}
                placeholder="Enter country"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity 
              style={styles.cancelFormButton}
              onPress={() => setShowAddressForm(false)}
            >
              <Text style={styles.cancelFormButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveFormButton}
              onPress={handleAddNewAddress}
            >
              <Text style={styles.saveFormButtonText}>Save Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderPaymentMethods = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="card-outline" size={20} color="#f7ab18" />
        <Text style={styles.sectionTitle}>Payment Method</Text>
      </View>
      
      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionSelected]}
        onPress={() => setPaymentMethod('cod')}
      >
        <Icon name="cash-outline" size={24} color={paymentMethod === 'cod' ? '#f7ab18' : '#666'} />
        <View style={styles.paymentOptionText}>
          <Text style={[styles.paymentOptionTitle, paymentMethod === 'cod' && styles.paymentOptionTitleSelected]}>
            Cash on Delivery
          </Text>
          <Text style={[styles.paymentOptionSubtitle, paymentMethod === 'cod' && styles.paymentOptionSubtitleSelected]}>
            Pay when you receive your order
          </Text>
        </View>
        {paymentMethod === 'cod' && <Icon name="checkmark-circle" size={24} color="#f7ab18" />}
      </TouchableOpacity>
    </View>
  );

  const renderProductInformation = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="cube-outline" size={20} color="#f7ab18" />
        <Text style={styles.sectionTitle}>Products ({availableItems.length})</Text>
      </View>
      
      <View style={styles.productsContainer}>
        {availableItems.map((item, index) => {
          const itemImage = item.variantInfo?.images?.[0] || item.images?.[0] || item.image || null;
          const itemName = item.name || 'Product';
          const itemPrice = getItemTotal(item);
          const itemQuantity = item.quantity || 1;
          const itemSku = item.variantInfo?.sku || item.sku || '';
          const selectedAttrs = item.selectedAttributes || {};
          const attrEntries = Object.entries(selectedAttrs);
          
          return (
            <View key={item.cartId || index} style={styles.productItem}>
              {itemImage ? (
                <Image source={{ uri: itemImage }} style={styles.productImage} />
              ) : (
                <View style={[styles.productImage, styles.productImagePlaceholder]}>
                  <Icon name="image-outline" size={24} color="#ccc" />
                </View>
              )}
              
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>{itemName}</Text>
                
                {itemSku ? (
                  <Text style={styles.productSku}>SKU: {itemSku}</Text>
                ) : null}
                
                {attrEntries.length > 0 && (
                  <View style={styles.productAttributes}>
                    {attrEntries.map(([key, value]) => (
                      <Text key={key} style={styles.productAttribute}>
                        {key}: {String(value)}
                      </Text>
                    ))}
                  </View>
                )}
                
                <View style={styles.productPriceRow}>
                  <Text style={styles.productQuantity}>Qty: {itemQuantity}</Text>
                  <Text style={styles.productPrice}>₹{itemPrice.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderOrderSummary = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="receipt-outline" size={20} color="#f7ab18" />
        <Text style={styles.sectionTitle}>Order Summary</Text>
      </View>
      
      <View style={styles.summaryContent}>
        {appliedCoupon && (
          <View style={[styles.summaryRow, { justifyContent: 'space-between' }]}>
            <Text style={[styles.summaryLabel, { color: '#4caf50' }]}>Applied: {appliedCoupon.couponCode}</Text>
            <Text style={[styles.summaryValue, { color: '#4caf50' }]}>- ₹{String(discount.toFixed(2))}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₹{String(subtotal.toFixed(2))}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping</Text>
          <Text style={[styles.summaryValue, shipping === 0 && styles.freeShipping]}>
            {shipping === 0 ? 'FREE' : `₹${String(shipping.toFixed(2))}`}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax ({taxRate}%)</Text>
          <Text style={styles.summaryValue}>₹{String(tax.toFixed(2))}</Text>
        </View>
        
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{String(total.toFixed(2))}</Text>
        </View>

        {shipping > 0 && freeShipThreshold != null && (
          <View style={styles.freeShippingNote}>
            <Icon name="information-circle-outline" size={16} color="#f7ab18" />
            <Text style={styles.freeShippingText}>
              Add ₹{String((Number(freeShipThreshold) - subtotal).toFixed(2))} more for free shipping
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const handleApplyCoupon = async () => {
    try {
      setValidating(true);
      setCouponError('');
      const code = couponCode.trim();
      const res = await api.applyCouponToCart(code, paymentMethod);
      if (res?.success && res?.data) {
        // server is source of truth; rehydrated via cartCoupon
        console.log('[Coupon] Applied and saved to cart (checkout):', res.data);
        // Ensure UI reflects latest cart-coupon from backend
        try { const refreshed = await api.getUserCart(); } catch (_) {}
      } else {
        setAppliedCoupon(null);
        const reason = res?.message || 'Invalid coupon';
        setCouponError(reason);
        console.warn('[Coupon] Apply failed (checkout):', { code, reason });
      }
    } catch (e) {
      setAppliedCoupon(null);
      setCouponError('Invalid coupon');
      console.error('[Coupon] Validation error (checkout):', e?.message || e);
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = async () => {
    try { await api.removeCouponFromCart(); } catch (_) {}
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    try { const refreshed = await api.getUserCart(); } catch (_) {}
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderProductInformation()}
        {renderAddressSection()}
        {renderPaymentMethods()}
        {/* Coupon Code */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="pricetag-outline" size={20} color="#f7ab18" />
            <Text style={styles.sectionTitle}>Coupon</Text>
          </View>
          {!appliedCoupon ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={couponCode}
                onChangeText={setCouponCode}
                placeholder="Enter coupon code"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.addAddressButton, { paddingVertical: 12 }]} onPress={handleApplyCoupon} disabled={validating}
              >
                <Text style={styles.addAddressButtonText}>{validating ? 'Checking...' : 'Apply'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e8f5e9', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 }}>
              <Text style={{ color: '#2e7d32', fontWeight: '600' }}>Applied: {appliedCoupon.couponCode}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#2e7d32', fontWeight: '700', marginRight: 12 }}>- ₹{String(discount.toFixed(2))}</Text>
                <TouchableOpacity onPress={handleRemoveCoupon} accessibilityLabel="Remove coupon" style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#c8e6c9', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                  <Text style={{ color: '#666', fontSize: 14 }}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {!!couponError && (
            <Text style={{ color: '#d32f2f', fontSize: 12, marginTop: 6 }}>{couponError}</Text>
          )}
        </View>
        {/* Order Note */}
        <View style={styles.section}>
          <View className="sectionHeader" style={styles.sectionHeader}>
            <Icon name="chatbox-ellipses-outline" size={20} color="#f7ab18" />
            <Text style={styles.sectionTitle}>Order Notes</Text>
          </View>
          <TextInput
            style={[styles.textInput, styles.fullWidthInput]}
            value={orderNote}
            onChangeText={setOrderNote}
            placeholder="Add any delivery instructions or comments for your order"
            multiline
            numberOfLines={3}
          />
        </View>
        {renderOrderSummary()}
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
        {deliveryAreaError ? (
          <View style={styles.deliveryErrorContainer}>
            <Icon name="alert-circle-outline" size={20} color="#d32f2f" />
            <Text style={styles.deliveryErrorText}>{deliveryAreaError}</Text>
          </View>
        ) : validatingAddress ? (
          <View style={styles.validatingContainer}>
            <Text style={styles.validatingText}>Validating address...</Text>
          </View>
        ) : null}
        <TouchableOpacity 
          style={[
            styles.placeOrderButton, 
            (isProcessing || !isAddressValid || validatingAddress) && styles.placeOrderButtonDisabled
          ]} 
          onPress={handlePlaceOrder}
          disabled={isProcessing || !isAddressValid || validatingAddress}
        >
          {isProcessing ? (
            <>
              <Icon name="hourglass-outline" size={20} color="#fff" />
              <Text style={styles.placeOrderButtonText}>Processing...</Text>
            </>
          ) : (
            <>
              <Icon name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.placeOrderButtonText}>Place Order • ₹{String(total.toFixed(2))}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  changeButton: {
    marginLeft: 'auto',
  },
  changeButtonText: {
    fontSize: 14,
    color: '#f7ab18',
    textDecorationLine: 'underline',
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  defaultBadge: {
    backgroundColor: '#f7ab18',
    borderRadius: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  defaultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addressContent: {
    marginTop: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
  },
  noAddressContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noAddressText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7ab18',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  addAddressButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  selectAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7ab18',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  selectAddressButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  addressFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfInput: {
    flex: 0.48,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  fullWidthInput: {
    marginBottom: 16,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  paymentOptionSelected: {
    borderColor: '#f7ab18',
    backgroundColor: '#fff8e1',
  },
  paymentOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentOptionTitleSelected: {
    color: '#f7ab18',
  },
  paymentOptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  paymentOptionSubtitleSelected: {
    color: '#f7ab18',
  },
  summaryContent: {
    // Add any specific styles for the content area if needed
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  freeShipping: {
    color: '#f7ab18',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f7ab18',
  },
  freeShippingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  freeShippingText: {
    fontSize: 12,
    color: '#f7ab18',
    marginLeft: 5,
  },
  productsContainer: {
    gap: 12,
  },
  productItem: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productAttributes: {
    marginBottom: 4,
  },
  productAttribute: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  productPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  productQuantity: {
    fontSize: 13,
    color: '#666',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f7ab18',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7ab18',
    padding: 16,
    borderRadius: 12,
  },
  placeOrderButtonDisabled: {
    backgroundColor: '#ccc',
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  cancelFormButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  cancelFormButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveFormButton: {
    backgroundColor: '#f7ab18',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveFormButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  deliveryErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  deliveryErrorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  validatingContainer: {
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  validatingText: {
    color: '#666',
    fontSize: 14,
  },
  validationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  validationSuccessContainer: {
    backgroundColor: '#e8f5e9',
  },
  validationErrorContainer: {
    backgroundColor: '#ffebee',
  },
  validationStatusText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  validationSuccessText: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  validationErrorText: {
    color: '#d32f2f',
    fontWeight: '600',
  },
});

export default CheckoutScreen;