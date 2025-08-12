import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const WishlistScreen = ({ navigation }) => {
  const [wishlistItems, setWishlistItems] = useState([
    {
      id: '1',
      name: 'Wireless Bluetooth Headphones',
      price: 99.99,
      originalPrice: 129.99,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300',
      rating: 4.5,
      reviews: 234,
      discount: '23%',
      inStock: true,
      brand: 'TechSound',
    },
    {
      id: '2',
      name: 'Summer Floral Dress',
      price: 45.99,
      originalPrice: 65.99,
      image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=300',
      rating: 4.2,
      reviews: 89,
      discount: '30%',
      inStock: true,
      brand: 'Fashion Co',
    },
    {
      id: '3',
      name: 'Premium Coffee Maker',
      price: 79.99,
      originalPrice: 99.99,
      image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300',
      rating: 4.7,
      reviews: 156,
      discount: '20%',
      inStock: false,
      brand: 'BrewMaster',
    },
    {
      id: '4',
      name: 'Running Shoes',
      price: 89.99,
      originalPrice: 119.99,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300',
      rating: 4.4,
      reviews: 312,
      discount: '25%',
      inStock: true,
      brand: 'SportFlex',
    },
    {
      id: '5',
      name: 'Skincare Essentials Set',
      price: 34.99,
      originalPrice: 49.99,
      image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300',
      rating: 4.6,
      reviews: 98,
      discount: '30%',
      inStock: true,
      brand: 'GlowUp',
    },
  ]);

  const removeFromWishlist = (itemId) => {
    Alert.alert(
      'Remove from Wishlist',
      'Are you sure you want to remove this item from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setWishlistItems(prev => prev.filter(item => item.id !== itemId));
          }
        }
      ]
    );
  };

  const addToCart = (item) => {
    Alert.alert('Added to Cart', `${item.name} has been added to your cart!`);
  };

  const moveAllToCart = () => {
    const inStockItems = wishlistItems.filter(item => item.inStock);
    if (inStockItems.length === 0) {
      Alert.alert('No Items', 'No items available to add to cart');
      return;
    }
    
    Alert.alert(
      'Move to Cart',
      `Move ${inStockItems.length} item${inStockItems.length > 1 ? 's' : ''} to cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move All',
          onPress: () => {
            Alert.alert('Success', `${inStockItems.length} items moved to cart!`);
          }
        }
      ]
    );
  };

  const renderWishlistItem = ({ item }) => (
    <View style={styles.wishlistItem}>
      <View style={styles.itemImageContainer}>
        <Image source={{ uri: item.image }} style={styles.itemImage} />
        {item.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}</Text>
          </View>
        )}
        {!item.inStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => removeFromWishlist(item.id)}
        >
          <Icon name="x" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.itemBrand}>{item.brand}</Text>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        
        <View style={styles.ratingContainer}>
          <Icon name="star" size={12} color="#FFA726" />
          <Text style={styles.ratingText}>{item.rating}</Text>
          <Text style={styles.reviewsText}>({item.reviews})</Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          {item.originalPrice > item.price && (
            <Text style={styles.originalPrice}>${item.originalPrice.toFixed(2)}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.addToCartButton,
            !item.inStock && styles.disabledButton
          ]}
          onPress={() => addToCart(item)}
          disabled={!item.inStock}
        >
          <Icon name="shopping-cart" size={14} color={item.inStock ? "#fff" : "#999"} />
          <Text style={[
            styles.addToCartText,
            !item.inStock && styles.disabledButtonText
          ]}>
            {item.inStock ? 'Add to Cart' : 'Out of Stock'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={styles.wishlistBadge}>
          <Text style={styles.wishlistBadgeText}>{wishlistItems.length}</Text>
        </View>
      </View>

      {wishlistItems.length === 0 ? (
        <View style={styles.emptyWishlist}>
          <Icon name="heart" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyText}>
            Save items you love to buy them later
          </Text>
          <TouchableOpacity 
            style={styles.shopNowButton}
            onPress={() => navigation.navigate('Category')}
          >
            <Text style={styles.shopNowButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Wishlist Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{wishlistItems.length}</Text>
              <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                ${wishlistItems.reduce((sum, item) => sum + item.price, 0).toFixed(0)}
              </Text>
              <Text style={styles.statLabel}>Total Value</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {wishlistItems.filter(item => item.inStock).length}
              </Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.moveAllButton}
              onPress={moveAllToCart}
            >
              <Icon name="shopping-cart" size={16} color="#fff" />
              <Text style={styles.moveAllButtonText}>Move All to Cart</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.shareButton}
              onPress={() => Alert.alert('Share', 'Wishlist sharing feature coming soon!')}
            >
              <Icon name="share" size={16} color="#FFA726" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Wishlist Items */}
          <FlatList
            data={wishlistItems}
            renderItem={renderWishlistItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.wishlistGrid}
            columnWrapperStyle={styles.wishlistRow}
            showsVerticalScrollIndicator={false}
          />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  wishlistBadge: {
    backgroundColor: '#FFA726',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  wishlistBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyWishlist: {
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
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopNowButton: {
    backgroundColor: '#FFA726',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopNowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFA726',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 15,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 10,
  },
  moveAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFA726',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  moveAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFA726',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  shareButtonText: {
    color: '#FFA726',
    fontSize: 14,
    fontWeight: '600',
  },
  wishlistGrid: {
    padding: 20,
  },
  wishlistRow: {
    justifyContent: 'space-between',
  },
  wishlistItem: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  itemImageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f8f8f8',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF5722',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    padding: 12,
  },
  itemBrand: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFA726',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFA726',
    borderRadius: 6,
    paddingVertical: 8,
    gap: 6,
  },
  disabledButton: {
    backgroundColor: '#f0f0f0',
  },
  addToCartText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
});

export default WishlistScreen;