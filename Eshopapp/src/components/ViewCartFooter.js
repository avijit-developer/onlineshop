import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';

const ViewCartFooter = () => {
  const navigation = useNavigation();
  const { cartItems, getCartTotal, getCartItemsCount, getItemImage } = useCart();

  // Memoize calculations to prevent unnecessary re-renders
  const { total, itemsCount, displayItems } = useMemo(() => {
    if (cartItems.length === 0) {
      return { total: 0, itemsCount: 0, displayItems: [] };
    }

    const total = getCartTotal();
    const itemsCount = getCartItemsCount();
    const displayItems = cartItems.slice(0, 5);

    return { total, itemsCount, displayItems };
  }, [cartItems, getCartTotal, getCartItemsCount]);

  if (cartItems.length === 0) {
    return null;
  }

  const handleViewCart = () => {
    navigation.navigate('Cart');
  };

  return (
    <View style={styles.container}>
      <View style={styles.cartInfo}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.itemsScroll}
        >
          {displayItems.map((item, index) => {
            // Get the best available image for this item
            const imageUri = getItemImage(item);
            
            // If no image found, show a placeholder
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
                style={[
                  styles.itemImage,
                  index > 0 && { marginLeft: -8 }
                ]}
                onError={() => console.log('Image failed to load for item:', item.name)}
                onLoad={() => console.log('Image loaded successfully for:', item.name)}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cartInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemsScroll: {
    maxWidth: 180, // Increased from 120 to accommodate larger images
  },
  itemImage: {
    width: 48, // Increased from 32 to 48
    height: 48, // Increased from 32 to 48
    borderRadius: 24, // Increased from 16 to 24
    borderWidth: 2,
    borderColor: '#fff',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  moreItemsIndicator: {
    width: 48, // Increased from 32 to 48
    height: 48, // Increased from 32 to 48
    borderRadius: 24, // Increased from 16 to 24
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  viewCartText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default ViewCartFooter;