import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';

const ProductCard = ({ item }) => {
  const navigation = useNavigation();
  const { addToCart } = useCart();

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart(item, 1);
    Alert.alert('Added to Cart', `${item.name} has been added to your cart`);
  };

  const handleBuyNow = (e) => {
    e.stopPropagation();
    addToCart(item, 1);
    navigation.navigate('Cart');
  };

  const handleProductPress = () => {
    navigation.navigate('ProductDetails', { product: item });
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={handleProductPress}>
        <Image source={{ uri: item.image }} style={styles.image} />
        <TouchableOpacity style={styles.heartIcon}>
          <Icon
            name={item.liked ? 'heart' : 'heart-outline'}
            size={20}
            color={item.liked ? '#FFA726' : '#FFA726'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
      
      <View style={{padding:10, paddingTop:3}}>
        <TouchableOpacity onPress={handleProductPress}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.priceWrapper}>
            {item.oldPrice ? (
              <>
                <Text style={[styles.price, { color: '#e53935' }]}>{String(item.price).replace('$', '₹')}</Text>
                <Text style={styles.oldPrice}>{item.oldPrice}</Text>
              </>
            ) : (
              <Text style={styles.price}>{String(item.price).replace('$', '₹')}</Text>
            )}
          </View>
          <View style={styles.ratingWrapper}>
            <Icon name="star" size={14} color="#FFA726" />
            <Icon name="star" size={14} color="#FFA726" />
            <Icon name="star" size={14} color="#FFA726" />
            <Icon name="star" size={14} color="#FFA726" />
            <Icon name="star-outline" size={14} color="#FFA726" />
            <Text style={styles.reviewCount}>({item.reviews})</Text>
          </View>
        </TouchableOpacity>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
            <Icon name="add-outline" size={14} color="#f7ab18" />
            <Text style={styles.addToCartText}>Add</Text>
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
      width: '46%',
    borderRadius: 6,
    backgroundColor: '#fff',
    overflow: 'hidden',
    elevation: 3,
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
  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(250, 250, 250, .9)',
    padding: 5,
    borderRadius: 100,
    elevation: 3,
  },
  name: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
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
