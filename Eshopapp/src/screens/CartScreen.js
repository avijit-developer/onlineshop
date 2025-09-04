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
  RefreshControl,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import api from '../utils/api';
// shipping settings loaded from API

const CartScreen = () => {
  const navigation = useNavigation();
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart, getItemTotal, getItemImage, isLoading, isAuthenticated, refreshCart, cartCoupon } = useCart();
  const [couponCode, setCouponCode] = React.useState('');
  const [couponError, setCouponError] = React.useState('');
  const [validating, setValidating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const handleApplyCoupon = async () => {
    try {
      setValidating(true);
      setCouponError('');
      // Apply without enforcing a payment method at cart stage
      const res = await api.applyCouponToCart(couponCode.trim(), undefined);
      if (res?.success && res?.data) {
        await refreshCart();
        console.log('[Coupon] Applied and saved to cart:', res.data);
      } else {
        const reason = res?.message || 'Invalid coupon';
        setCouponError(reason);
        console.warn('[Coupon] Apply failed:', { code: couponCode.trim(), reason });
      }
    } catch (_) {
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
    setCouponCode('');
    setCouponError('');
    await refreshCart();
  };

  useFocusEffect(
    React.useCallback(() => {
      refreshCart();
    }, [refreshCart])
  );

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshCart();
      // also refetch shipping settings
      try { const res = await api.getShippingSettings(); if (res?.success) setShippingSettings(res.data || {}); } catch (_) {}
    } finally {
      setRefreshing(false);
    }
  }, [refreshCart]);

  // Restore applied coupon from backend cart when screen is focused and cart reloads
  React.useEffect(() => {
    if (cartCoupon) {
      setCouponCode(cartCoupon.couponCode || '');
    } else {
      setCouponCode('');
    }
  }, [cartCoupon]);

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
  // Avoid changing hooks order; render empty state via conditional content

  const renderCartItem = ({ item }) => {
    const isUnavailable = (item.enabled === false) || ((item.variantInfo?.stock || item.stock || 0) <= 0);
    return (
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
              style={[styles.quantityButton, (item.quantity >= (item.variantInfo?.stock || item.stock) || item.enabled === false) && styles.quantityButtonDisabled]}
              onPress={() => handleQuantityChange(item.cartId, 1)}
              disabled={item.quantity >= (item.variantInfo?.stock || item.stock) || item.enabled === false}
            >
              <Icon name="add-outline" size={16} color={item.quantity >= (item.variantInfo?.stock || item.stock) ? "#ccc" : "#333"} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Additional info section */}
        <View style={styles.additionalInfo}>
          {isUnavailable ? (
            <Text style={[styles.stockInfo, { color: '#d32f2f' }]}>Not available</Text>
          ) : (
            <Text style={styles.stockInfo}>
              Stock: {String(item.variantInfo?.stock || item.stock || 0)} available
            </Text>
          )}
          <Text style={styles.itemTotal}>
            Total: ₹{String(getItemTotal(item))}
          </Text>
        </View>
      </View>

      {isUnavailable && (
        <View style={styles.unavailableOverlay} pointerEvents="none">
          <Text style={styles.unavailableText}>Not available</Text>
        </View>
      )}
    </View>
  ); };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Icon name="cart-outline" size={84} color="#ccc" />
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

  const availableItems = cartItems.filter(ci => (ci.enabled !== false) && (ci.stock > 0 || (ci.variantInfo?.stock || 0) > 0));
  const subtotal = availableItems.reduce((sum, it) => sum + getItemTotal(it), 0);
  const [shippingSettings, setShippingSettings] = React.useState({});
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try { const res = await api.getShippingSettings(); if (mounted) setShippingSettings((res?.data || res || {})); } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);
  const pickDeep = (obj, paths, fallback) => {
    for (const path of paths) {
      let cur = obj; let ok = true;
      for (const key of path) { if (cur && Object.prototype.hasOwnProperty.call(cur, key)) cur = cur[key]; else { ok = false; break; } }
      if (ok && cur != null && cur !== '') return cur;
    }
    return fallback;
  };
  const freeShipThresholdRaw = pickDeep(shippingSettings, [
    ['freeShippingThreshold'], ['free_shipping_threshold'], ['freeShippingMin'], ['freeMin'],
    ['settings','freeShippingThreshold'], ['config','freeShippingThreshold'], ['data','freeShippingThreshold']
  ], null);
  const FREE_SHIPPING_MIN = (freeShipThresholdRaw != null ? Number(freeShipThresholdRaw) : null);
  const baseShippingRaw = pickDeep(shippingSettings, [
    ['flatShippingFee'], ['flat_rate'], ['flat'], ['price'], ['amount'],
    ['defaultShippingCost'], ['settings','flatShippingFee'], ['config','flatShippingFee'], ['data','flatShippingFee']
  ], 0);
  const BASE_SHIPPING = Number(baseShippingRaw || 0);
  const meetsFree = (FREE_SHIPPING_MIN != null && subtotal >= Number(FREE_SHIPPING_MIN));
  const shipping = (cartCoupon?.freeShipping || meetsFree) ? 0 : BASE_SHIPPING;
  const taxRate = Number(pickDeep(shippingSettings, [['taxRate'], ['settings','taxRate'], ['config','taxRate'], ['data','taxRate']], 0)) || 0;
  const tax = Math.max(0, subtotal * (taxRate / 100));
  const discount = cartCoupon?.discountAmount || 0;
  const total = Math.max(0, subtotal + shipping + tax - discount);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Shopping Cart</Text>
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
          <View style={styles.metaBar}>
            <Text style={styles.metaText}>{availableItems.length} items • Subtotal ₹{subtotal.toFixed(2)}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              <Text style={styles.metaLink}>Continue shopping</Text>
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: 180 }}
            ListFooterComponent={() => (
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
                  {!cartCoupon ? (
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
                      <Text style={{ color: '#2e7d32', fontWeight: '600' }}>Applied: {cartCoupon.couponCode}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ color: '#2e7d32', fontWeight: '700' }}>- ₹{String((cartCoupon.discountAmount || 0).toFixed(2))}</Text>
                        <TouchableOpacity onPress={handleRemoveCoupon} accessibilityLabel="Remove coupon" style={{
                          width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#c8e6c9', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'
                        }}>
                          <Text style={{ color: '#666', fontSize: 14 }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {!!couponError && (
                    <Text style={{ color: '#d32f2f', fontSize: 12, marginBottom: 8 }}>{couponError}</Text>
                  )}
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
                    <Text style={styles.summaryLabel}>Tax ({taxRate}%)</Text>
                    <Text style={styles.summaryValue}>₹{tax.toFixed(2)}</Text>
                  </View>
                  
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
                  </View>

                  {(shipping > 0 && FREE_SHIPPING_MIN != null && subtotal < FREE_SHIPPING_MIN) && (
                    <View style={styles.freeShippingNote}>
                      <Icon name="information-circle-outline" size={16} color="#f7ab18" />
                      <Text style={styles.freeShippingText}>Add ₹{Math.max(0, (FREE_SHIPPING_MIN - subtotal)).toFixed(2)} more for free shipping</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          />

          {/* Checkout Button */}
          <View style={styles.checkoutBar}>
            <View style={styles.checkoutInfo}>
              <Text style={styles.checkoutLabel}>Total</Text>
              <Text style={styles.checkoutTotal}>₹{total.toFixed(2)}</Text>
              <Text style={styles.checkoutNote}>Incl. tax and shipping</Text>
            </View>
            <TouchableOpacity style={[styles.checkoutCta, (availableItems.length === 0) && { opacity: 0.6 }]} onPress={handleCheckout} disabled={availableItems.length === 0}>
              <Icon name="card-outline" size={20} color="#fff" />
              <Text style={styles.checkoutCtaText}>Checkout</Text>
            </TouchableOpacity>
          </View>
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
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff8e6',
    borderTopWidth: 1,
    borderTopColor: '#f0e3c2',
  },
  metaText: { color: '#333', fontSize: 13, fontWeight: '600' },
  metaLink: { color: '#f7ab18', fontSize: 13, fontWeight: '600' },
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
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableText: {
    color: '#fff',
    fontWeight: '700',
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
  checkoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  checkoutInfo: { flexDirection: 'column' },
  checkoutLabel: { color: '#666', fontSize: 12 },
  checkoutTotal: { color: '#333', fontSize: 18, fontWeight: '700' },
  checkoutNote: { color: '#777', fontSize: 11 },
  checkoutCta: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutCtaText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
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