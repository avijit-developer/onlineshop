import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';

const ProductCard = ({ item }) => {
  const navigation = useNavigation();
  const { addToCart } = useCart();
  const [adding, setAdding] = React.useState(false);
  const { toggleWishlist, isInWishlist } = useWishlist();

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (adding) return;
    setAdding(true);
    try {
      const res = await addToCart(item, 1);
      // Optionally handle errors here
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async (e) => {
    e.stopPropagation();
    if (adding) return;
    setAdding(true);
    try {
      await addToCart(item, 1);
      navigation.navigate('Cart');
    } finally {
      setAdding(false);
    }
  };

  const handleProductPress = () => {
    navigation.navigate('ProductDetails', { productId: item.id || item._id });
  };

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    if (!item.id && !item._id) {
      Alert.alert('Error', 'Product information not available');
      return;
    }
    
    try {
      const productId = item.id || item._id;
      const result = await toggleWishlist(productId);
      if (result.success) {
        console.log('Wishlist updated successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to update wishlist');
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      Alert.alert('Error', 'Failed to update wishlist');
    }
  };

  // Compute discount percentage and normalize tags
  const toNumber = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };
  const regularPriceNum = toNumber(item.regularPrice ?? item.oldPrice);
  const specialPriceNum = toNumber(item.specialPrice ?? item.price);
  const hasDiscount = (regularPriceNum > 0 && specialPriceNum > 0 && specialPriceNum < regularPriceNum);
  const discountPercent = hasDiscount ? Math.round(100 - (specialPriceNum / regularPriceNum) * 100) : 0;
  const normalizeTags = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) {
      // Array of strings or objects
      return val.map(v => (typeof v === 'string' ? v : (v && (v.name || v.label || v.title)))).filter(Boolean);
    }
    if (typeof val === 'string') {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };
  const tags = normalizeTags(item.tags || item.labels || item.badges || item.tag);
  const tagsLimited = tags.slice(0, 2);

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={handleProductPress}>
        <Image source={{ uri: item.image }} style={styles.image} />

        {/* Top-left tags ribbon(s) */}
        {tagsLimited.length > 0 && (
          <View style={styles.tagsContainer}>
            {tagsLimited.map((t, idx) => (
              <View key={`${t}-${idx}`} style={[styles.tagRibbon, idx > 0 && { marginTop: 4 }]}> 
                <Text style={styles.tagRibbonText} numberOfLines={1}>{String(t)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top-right wishlist and discount */}
        <TouchableOpacity 
          style={[styles.heartIcon, isInWishlist(item.id || item._id) && styles.heartIconActive]} 
          onPress={handleWishlistToggle}
        >
          <Icon
            name={isInWishlist(item.id || item._id) ? 'heart' : 'heart-outline'}
            size={20}
            color={isInWishlist(item.id || item._id) ? '#e53935' : '#333'}
          />
        </TouchableOpacity>
        {hasDiscount && (
          <View style={styles.discountCornerContainer}>
            <View style={styles.discountCorner}>
              <Text style={styles.discountCornerText}>-{discountPercent}%</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
      
      <View style={{padding:10, paddingTop:3}}>
        <TouchableOpacity onPress={handleProductPress}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.priceWrapper}>
            {hasDiscount ? (
              <>
                <Text style={[styles.price, { color: '#e53935' }]}>₹{specialPriceNum}</Text>
                <Text style={styles.oldPrice}>₹{regularPriceNum}</Text>
              </>
            ) : (
              <Text style={styles.price}>₹{specialPriceNum || regularPriceNum || 0}</Text>
            )}
          </View>
          <View style={styles.ratingWrapper}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Icon
                key={`star-${idx}`}
                name={(item.rating || 0) >= idx + 1 ? 'star' : ((item.rating || 0) > idx ? 'star-half' : 'star-outline')}
                size={14}
                color="#FFA726"
              />
            ))}
            {!!item.rating && <Text style={styles.reviewCount}>{Number(item.rating).toFixed(1)}</Text>}
          </View>
        </TouchableOpacity>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.addToCartButton, adding && styles.addToCartButtonDisabled]} onPress={handleAddToCart} disabled={adding}>
            {adding ? (
              <ActivityIndicator size="small" color="#f7ab18" />
            ) : (
              <>
                <Icon name="add-outline" size={14} color="#f7ab18" />
                <Text style={styles.addToCartText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.buyNowButton} onPress={handleBuyNow}>
            <Text style={styles.buyNowText}>Buy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 0,
  },
  tagsContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 'auto',
  },
  tagRibbon: {
    backgroundColor: '#2e7d32',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    maxWidth: 100,
  },
  tagRibbonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(250, 250, 250, .9)',
    padding: 5,
    borderRadius: 100,
    elevation: 3,
  },
  heartIconActive: {
    backgroundColor: 'rgba(255, 255, 255, .95)',
    borderWidth: 1,
    borderColor: '#e53935',
  },
  discountCornerContainer: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
  discountCorner: { backgroundColor: '#e53935', paddingVertical: 2, paddingHorizontal: 18, transform: [{ rotate: '45deg' }], borderRadius: 2, elevation: 3 },
  discountCornerText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  name: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
    lineHeight: 18,
    height: 18,
  },
  priceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFA726',
    marginRight: 6,
    marginVertical:5
  },
  oldPrice: {
    fontSize: 13,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  ratingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reviewCount: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f7ab18',
    paddingVertical: 6,
    borderRadius: 6,
  },
  addToCartText: {
    fontSize: 12,
    color: '#f7ab18',
    fontWeight: '600',
    marginLeft: 2,
  },
  buyNowButton: {
    flex: 1,
    backgroundColor: '#f7ab18',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
});

export default React.memo(ProductCard);
