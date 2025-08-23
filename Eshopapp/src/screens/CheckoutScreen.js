import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import { useAddress } from '../contexts/AddressContext';

const CheckoutScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { addresses, getDefaultAddress, addAddress, refreshAddresses, isLoading } = useAddress();

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

  // Refresh addresses when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      refreshAddresses();
    }, [refreshAddresses])
  );

  // Initialize selected address
  useEffect(() => {
    if (selectedAddressFromParams) {
      setSelectedAddress(selectedAddressFromParams);
    } else if (addresses.length > 0) {
      setSelectedAddress(getDefaultAddress());
    }
  }, [selectedAddressFromParams, addresses]);

  // Calculate totals
  const subtotal = getCartTotal();
  const shipping = subtotal > 50 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

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
    if (!selectedAddress) {
      Alert.alert('Validation Error', 'Please select or add a shipping address');
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateCheckout()) return;

    setIsProcessing(true);

    try {
      // Simulate order processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Show success message
      Alert.alert(
        'Order Placed Successfully!',
        `Your order has been placed. Order total: ₹${total.toFixed(2)}\n\nYou will receive a confirmation email shortly.`,
        [
          {
            text: 'View Orders',
            onPress: () => {
              clearCart();
              navigation.navigate('Orders'); // You'll need to create this screen
            }
          },
          {
            text: 'Continue Shopping',
            onPress: () => {
              clearCart();
              navigation.navigate('Home');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to place order. Please try again.');
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
      ) : selectedAddress ? (
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <Text style={styles.addressLabel}>
              {selectedAddress.label || `${selectedAddress.firstName} ${selectedAddress.lastName}`}
            </Text>
            {selectedAddress.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>Default</Text>
              </View>
            )}
          </View>
          
          <View style={styles.addressContent}>
            <Text style={styles.addressText}>
              {selectedAddress.firstName} {selectedAddress.lastName}
            </Text>
            <Text style={styles.addressText}>
              {selectedAddress.address}
            </Text>
            <Text style={styles.addressText}>
              {selectedAddress.city}, {selectedAddress.state} {selectedAddress.zipCode}
            </Text>
            <Text style={styles.addressText}>
              {selectedAddress.country}
            </Text>
            <Text style={styles.contactText}>
              📧 {selectedAddress.email} | 📱 {selectedAddress.phone}
            </Text>
          </View>
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
                style={[styles.textInput, styles.disabledInput]}
                value={shippingInfo.country}
                editable={false}
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

      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
        onPress={() => setPaymentMethod('card')}
      >
        <Icon name="card-outline" size={24} color={paymentMethod === 'card' ? '#f7ab18' : '#666'} />
        <View style={styles.paymentOptionText}>
          <Text style={[styles.paymentOptionTitle, paymentMethod === 'card' && styles.paymentOptionTitleSelected]}>
            Credit/Debit Card
          </Text>
          <Text style={[styles.paymentOptionSubtitle, paymentMethod === 'card' && styles.paymentOptionSubtitleSelected]}>
            Secure payment with your card
          </Text>
        </View>
        {paymentMethod === 'card' && <Icon name="checkmark-circle" size={24} color="#f7ab18" />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.paymentOption, paymentMethod === 'upi' && styles.paymentOptionSelected]}
        onPress={() => setPaymentMethod('upi')}
      >
        <Icon name="phone-portrait-outline" size={24} color={paymentMethod === 'upi' ? '#f7ab18' : '#666'} />
        <View style={styles.paymentOptionText}>
          <Text style={[styles.paymentOptionTitle, paymentMethod === 'upi' && styles.paymentOptionTitleSelected]}>
            UPI Payment
          </Text>
          <Text style={[styles.paymentOptionSubtitle, paymentMethod === 'upi' && styles.paymentOptionSubtitleSelected]}>
            Pay using UPI apps
          </Text>
        </View>
        {paymentMethod === 'upi' && <Icon name="checkmark-circle" size={24} color="#f7ab18" />}
      </TouchableOpacity>
    </View>
  );

  const renderOrderSummary = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="receipt-outline" size={20} color="#f7ab18" />
        <Text style={styles.sectionTitle}>Order Summary</Text>
      </View>
      
      <View style={styles.summaryContent}>
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
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>₹{String(tax.toFixed(2))}</Text>
        </View>
        
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{String(total.toFixed(2))}</Text>
        </View>

        {shipping > 0 && (
          <View style={styles.freeShippingNote}>
            <Icon name="information-circle-outline" size={16} color="#f7ab18" />
            <Text style={styles.freeShippingText}>
              Add ₹{String((50 - subtotal).toFixed(2))} more for free shipping
            </Text>
          </View>
        )}
      </View>
    </View>
  );

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
        {renderAddressSection()}
        {renderPaymentMethods()}
        {renderOrderSummary()}
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.placeOrderButton, isProcessing && styles.placeOrderButtonDisabled]} 
          onPress={handlePlaceOrder}
          disabled={isProcessing}
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
});

export default CheckoutScreen;