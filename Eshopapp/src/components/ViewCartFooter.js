import React from 'react';
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
  const { cartItems, getCartTotal, getCartItemsCount } = useCart();

  if (cartItems.length === 0) {
    return null;
  }

  const total = getCartTotal();
  const itemsCount = getCartItemsCount();

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
          {cartItems.slice(0, 5).map((item, index) => {
            const imageUri = item.images?.[0] || item.image;
            return (
              <Image
                key={item.cartId}
                source={{ uri: imageUri }}
                style={[
                  styles.itemImage,
                  index > 0 && { marginLeft: -8 }
                ]}
                onError={() => console.log('Image failed to load for item:', item.name)}
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
    maxWidth: 120,
  },
  itemImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreItemsIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
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