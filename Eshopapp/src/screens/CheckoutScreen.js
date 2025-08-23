import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';

const CheckoutScreen = () => {
  const navigation = useNavigation();
  const { cartItems, getCartTotal, clearCart } = useCart();

  // Form state
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

  const [paymentMethod, setPaymentMethod] = useState('cod'); // cod, card, upi
  const [isProcessing, setIsProcessing] = useState(false);

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

  const validateForm = () => {
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];
    for (const field of requiredFields) {
      if (!shippingInfo[field] || shippingInfo[field].trim() === '') {
        Alert.alert('Validation Error', `Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shippingInfo.email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }

    // Basic phone validation
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(shippingInfo.phone)) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;

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

  const renderShippingForm = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="location-outline" size={20} color="#f7ab18" />
        <Text style={styles.sectionTitle}>Shipping Information</Text>
      </View>
      
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
        {renderShippingForm()}
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
});

export default CheckoutScreen;