import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import api from '../utils/api';

const CartScreen = () => {
  const navigation = useNavigation();
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart, getItemTotal, getItemImage, isLoading, isAuthenticated, refreshCart } = useCart();
  const [couponCode, setCouponCode] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState(null);
  const [couponError, setCouponError] = React.useState('');
  const [validating, setValidating] = React.useState(false);
  const handleApplyCoupon = async () => {
    try {
      setValidating(true);
      setCouponError('');
      const res = await api.applyCouponToCart(couponCode.trim(), 'cart');
      if (res?.success && res?.data) {
        setAppliedCoupon({ couponCode: res.data.couponCode, discountAmount: res.data.discountAmount, freeShipping: !!res.data.freeShipping });
        console.log('[Coupon] Applied and saved to cart:', res.data);
      } else {
        setAppliedCoupon(null);
        const reason = res?.message || 'Invalid coupon';
        setCouponError(reason);
        console.warn('[Coupon] Apply failed:', { code: couponCode.trim(), reason });
      }
    } catch (_) {
      setAppliedCoupon(null);
      setCouponError('Invalid coupon');
      console.error('[Coupon] Validation error (network or server):', _?.message || _);
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await api.removeCouponFromCart();
    } catch (_) {}
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  useFocusEffect(
    React.useCallback(() => {
      refreshCart();
    }, [refreshCart])
  );

  const handleQuantityChange = (cartId, change) => {
    const item = cartItems.find(item => item.cartId === cartId);
    if (item) {
      const newQuantity = item.quantity + change;
      updateQuantity(cartId, newQuantity);
    }
  };

  const handleRemoveItem = (cartId, itemName) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove ${itemName} from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(cartId) }
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearCart }
      ]
    );
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before checkout');
      return;
    }
    navigation.navigate('Checkout');
  };

  // Show loading state while cart is being loaded
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  // Show message if user is not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <Icon name="lock-closed-outline" size={64} color="#ccc" />
        <Text style={styles.authTitle}>Login Required</Text>
        <Text style={styles.authMessage}>Please log in to view and manage your cart</Text>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show empty cart message if authenticated but no items
  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="cart-outline" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
        <Text style={styles.emptyMessage}>Add some products to get started</Text>
        <TouchableOpacity 
          style={styles.shopButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemImageContainer}>
        <Image 
          source={{ uri: getItemImage(item) }} 
          style={styles.itemImage}
          onError={() => console.log('Cart image failed to load for:', item.name)}
        />
      </View>
      
      <View style={styles.itemDetails}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveItem(item.cartId, item.name)}
          >
            <Icon name="trash-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
        </View>
        
        {/* Display variant information if available */}
        {item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0 && (
          <View style={styles.variantContainer}>
            {Object.entries(item.selectedAttributes).map(([key, value]) => (
              <View key={key} style={styles.variantTag}>
                <Text style={styles.variantText}>{key}: {value}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Price and quantity section */}
        <View style={styles.priceQuantitySection}>
          <View style={styles.priceSection}>
            <Text style={styles.itemPrice}>
              ₹{String(item.specialPrice || item.variantInfo?.specialPrice || item.regularPrice || item.variantInfo?.price || item.price || 0)}
            </Text>
            {/* Show original price if special price exists */}
            {(item.specialPrice || item.variantInfo?.specialPrice) && (
              <Text style={styles.originalPrice}>
                ₹{String(item.regularPrice || item.variantInfo?.price || item.price || 0)}
              </Text>
            )}
          </View>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={[styles.quantityButton, item.quantity <= 1 && styles.quantityButtonDisabled]}
              onPress={() => handleQuantityChange(item.cartId, -1)}
              disabled={item.quantity <= 1}
            >
              <Icon name="remove-outline" size={16} color={item.quantity <= 1 ? "#ccc" : "#333"} />
            </TouchableOpacity>
            
            <Text style={styles.quantity}>{item.quantity}</Text>
            
            <TouchableOpacity
              style={[styles.quantityButton, item.quantity >= (item.variantInfo?.stock || item.stock) && styles.quantityButtonDisabled]}
              onPress={() => handleQuantityChange(item.cartId, 1)}
              disabled={item.quantity >= (item.variantInfo?.stock || item.stock)}
            >
              <Icon name="add-outline" size={16} color={item.quantity >= (item.variantInfo?.stock || item.stock) ? "#ccc" : "#333"} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Additional info section */}
        <View style={styles.additionalInfo}>
          <Text style={styles.stockInfo}>
            Stock: {String(item.variantInfo?.stock || item.stock || 0)} available
          </Text>
          <Text style={styles.itemTotal}>
            Total: ₹{String(getItemTotal(item))}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Icon name="bag-outline" size={80} color="#ddd" />
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptySubtitle}>Add some items to get started</Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.shopButtonText}>Continue Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  const subtotal = getCartTotal();
  const shipping = subtotal > 50 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const discount = appliedCoupon?.discountAmount || 0;
  const total = Math.max(0, subtotal + shipping + tax - discount);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Shopping Cart ({cartItems.length})</Text>
          <View style={styles.headerActions}>
            {cartItems.length > 0 && (
              <TouchableOpacity
                style={styles.clearCartButton}
                onPress={handleClearCart}
              >
                <Icon name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {cartItems.length > 0 && (
          <View style={styles.headerBottom}>
            <TouchableOpacity
              style={styles.continueShoppingButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Icon name="add-circle-outline" size={16} color="#f7ab18" />
              <Text style={styles.continueShoppingText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {cartItems.length === 0 ? (
        renderEmptyCart()
      ) : (
        <>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.cartId}
            style={styles.cartList}
            showsVerticalScrollIndicator={false}
          />

          {/* Order Summary */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryHeader}>
              <Icon name="receipt-outline" size={20} color="#f7ab18" />
              <Text style={styles.summaryTitle}>Order Summary</Text>
            </View>
            
            <View style={styles.summaryContent}>
              {/* Coupon */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Coupon</Text>
              </View>
              {!appliedCoupon ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={couponCode}
                    onChangeText={setCouponCode}
                    placeholder="Enter coupon"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity style={styles.applyButton} onPress={handleApplyCoupon} disabled={validating}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{validating ? 'Checking...' : 'Apply'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: '#e8f5e9', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8
                }}>
                  <Text style={{ color: '#2e7d32', fontWeight: '600' }}>Applied: {appliedCoupon.couponCode}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ color: '#2e7d32', fontWeight: '700' }}>- ₹{String(appliedCoupon.discountAmount.toFixed(2))}</Text>
                    <TouchableOpacity onPress={handleRemoveCoupon} accessibilityLabel="Remove coupon" style={{
                      width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#c8e6c9', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'
                    }}>
                      <Text style={{ color: '#666', fontSize: 14 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {/* Intentionally not showing error message in UI; logging to console instead */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={[styles.summaryValue, shipping === 0 && styles.freeShipping]}>
                  {shipping === 0 ? 'FREE' : `₹${shipping.toFixed(2)}`}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>₹{tax.toFixed(2)}</Text>
              </View>
              
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
              </View>

              {shipping > 0 && (
                <View style={styles.freeShippingNote}>
                  <Icon name="information-circle-outline" size={16} color="#f7ab18" />
                  <Text style={styles.freeShippingText}>
                    Add ₹{(50 - subtotal).toFixed(2)} more for free shipping
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Checkout Button */}
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Icon name="card-outline" size={20} color="#fff" />
            <Text style={styles.checkoutButtonText}>
              Proceed to Checkout
            </Text>
            <Text style={styles.checkoutAmount}>₹{total.toFixed(2)}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
  },
  headerBottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearCartButton: {
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 15,
  },
  continueShoppingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  continueShoppingText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  cartList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  removeButton: {
    padding: 8,
  },
  variantContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  variantTag: {
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 4,
  },
  variantText: {
    fontSize: 12,
    color: '#666',
  },
  priceQuantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f7ab18',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 5,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#e0e0e0',
    opacity: 0.7,
  },
  quantity: {
    marginHorizontal: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  additionalInfo: {
    marginTop: 8,
  },
  itemSku: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  stockInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f7ab18',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  summaryContent: {
    // Add any specific styles for the content area if needed
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  applyButton: {
    backgroundColor: '#f7ab18',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
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
  checkoutButton: {
    backgroundColor: '#f7ab18',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  authMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  loginButton: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

});

export default CartScreen;