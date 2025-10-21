import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import api from '../utils/api';

const ViewCartFooter = ({ bottomOffset = 0 }) => {
  const navigation = useNavigation();
  const { cartItems, getCartTotal, getCartItemsCount, getItemImage, getItemTotal, refreshCart, isAuthenticated, cartCoupon } = useCart();
  const route = useRoute();
  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(100)).current;
  const [shippingSettings, setShippingSettings] = useState({});

  // Refresh cart data when component mounts (only once)
  useEffect(() => {
    refreshCart();
    (async () => {
      try { const res = await api.getShippingSettings(); setShippingSettings((res?.data || res || {})); } catch (_) {}
    })();
  }, []); // run once on mount

  // Auto-expand when cart has items
  useEffect(() => {
    if (cartItems.length > 0) {
      if (!isExpanded) {
        setIsExpanded(true);
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }).start();
      }
    } else if (isExpanded) {
      setIsExpanded(false);
      Animated.spring(slideAnim, { toValue: 100, useNativeDriver: true, tension: 100, friction: 8 }).start();
    }
  }, [cartItems.length, isExpanded, slideAnim]);

  // Memoize calculations to prevent unnecessary re-renders
  const { total, itemsCount, displayItems, availableCount } = useMemo(() => {
    if (cartItems.length === 0) {
      return { total: 0, itemsCount: 0, displayItems: [], availableCount: 0 };
    }
    const availableItems = cartItems.filter(ci => (ci.enabled !== false) && ((ci.variantInfo?.stock || ci.stock || 0) > 0));
    const subtotal = availableItems.reduce((sum, it) => sum + getItemTotal(it), 0);
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
      ['flatShippingFee'], ['flat_rate'], ['flat'], ['price'], ['amount'], ['defaultShippingCost'],
      ['settings','flatShippingFee'], ['config','flatShippingFee'], ['data','flatShippingFee']
    ], 0);
    const BASE_SHIPPING = Number(baseShippingRaw || 0);
    const meetsFree = (FREE_SHIPPING_MIN != null && subtotal >= Number(FREE_SHIPPING_MIN));
    const shipping = (cartCoupon?.freeShipping || meetsFree) ? 0 : BASE_SHIPPING;
    const taxRateRaw = pickDeep(shippingSettings, [
      ['taxRate'], ['settings','taxRate'], ['config','taxRate'], ['data','taxRate']
    ], 0);
    const TAX_RATE = Number(taxRateRaw || 0);
    const tax = Math.max(0, subtotal * (TAX_RATE / 100));
    const discount = cartCoupon?.discountAmount || 0;
    const total = Math.max(0, subtotal + shipping + tax - discount);
    const itemsCount = availableItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const displayItems = availableItems.slice(0, 4);
    return { total, itemsCount, displayItems, availableCount: availableItems.length };
  }, [cartItems, cartCoupon, shippingSettings, getCartTotal, getCartItemsCount, getItemTotal]);

  const isCartScreen = route?.name === 'Cart';
  const hidden = !isAuthenticated || cartItems.length === 0 || isCartScreen;

  const handleViewCart = () => { navigation.navigate('Cart'); };

  if (hidden) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { bottom: Math.max(12, bottomOffset) },
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.leftArea}>
        <Icon name="cart-outline" size={18} color="#fff" />
        <Text style={styles.leftText} numberOfLines={1}>
          {itemsCount} item{itemsCount > 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.rightArea}>
        <Text style={styles.totalText}>₹{total.toFixed(2)}</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={handleViewCart}>
          <Text style={styles.ctaText}>View Cart</Text>
          <Icon name="arrow-forward-outline" size={16} color="#f7ab18" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f7ab18',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    width: '94%',
  },
  leftArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leftText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 6,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  ctaText: {
    color: '#f7ab18',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6,
  },
});

export default ViewCartFooter;