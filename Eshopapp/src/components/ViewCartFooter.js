import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import api from '../utils/api';

const ViewCartFooter = ({ bottomOffset = 0 }) => {
  const navigation = useNavigation();
  const { cartItems, getCartTotal, getCartItemsCount, getItemImage, refreshCart, isAuthenticated, cartCoupon } = useCart();
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
  const { total, itemsCount, displayItems } = useMemo(() => {
    if (cartItems.length === 0) {
      return { total: 0, itemsCount: 0, displayItems: [] };
    }
    const subtotal = getCartTotal();
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
    const discount = cartCoupon?.discountAmount || 0;
    const total = Math.max(0, subtotal + shipping - discount);
    const itemsCount = getCartItemsCount();
    const displayItems = cartItems.slice(0, 5);

    return { total, itemsCount, displayItems };
  }, [cartItems, cartCoupon, shippingSettings, getCartTotal, getCartItemsCount]);

  const hidden = !isAuthenticated || cartItems.length === 0;

  const handleViewCart = () => { navigation.navigate('Cart'); };

  if (hidden) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { bottom: bottomOffset },
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.cartInfo}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemsScroll}>
          {displayItems.map((item, index) => {
            const imageUri = getItemImage(item);
            if (!imageUri) {
              return (
                <View key={item.cartId} style={[styles.itemImage, styles.placeholderImage, index > 0 && { marginLeft: -8 }]}>
                  <Icon name="image-outline" size={20} color="#ccc" />
                </View>
              );
            }
            return (
              <Image
                key={item.cartId}
                source={{ uri: imageUri }}
                style={[styles.itemImage, index > 0 && { marginLeft: -8 }]}
              />
            );
          })}
          {cartItems.length > 5 && (
            <View style={styles.moreItemsIndicator}>
              <Text style={styles.moreItemsText}>+{cartItems.length - 5}</Text>
            </View>
          )}
        </ScrollView>
        
        <View style={styles.cartDetails}>
          <Text style={styles.itemCount}>{itemsCount} item{itemsCount > 1 ? 's' : ''}</Text>
          <Text style={styles.totalAmount}>₹{total.toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.viewCartButton} onPress={handleViewCart}>
        <Text style={styles.viewCartText}>View Cart</Text>
        <Icon name="arrow-forward-outline" size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7e6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ffe1b3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  cartInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemsScroll: {
    maxWidth: 180,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  moreItemsIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreItemsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  cartDetails: {
    marginLeft: 12,
    flex: 1,
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f7ab18',
  },
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7ab18',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 28,
    minWidth: 120,
    justifyContent: 'center',
  },
  viewCartText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default ViewCartFooter;