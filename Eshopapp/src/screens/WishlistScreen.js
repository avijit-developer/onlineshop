import React, { useState, useEffect } from 'react';
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
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import ViewCartFooter from '../components/ViewCartFooter';

const WishlistScreen = ({ navigation }) => {
  const { wishlist, isLoading, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleRemoveFromWishlist = async (itemId) => {
    Alert.alert(
      'Remove from Wishlist',
      'Are you sure you want to remove this item from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFromWishlist(itemId);
            if (result.success) {
              Alert.alert('Success', 'Item removed from wishlist');
            } else {
              Alert.alert('Error', result.error || 'Failed to remove item');
            }
          }
        }
      ]
    );
  };

  // Removed old add-to-cart alert flow and bulk move flow

  const renderWishlistItem = ({ item }) => {
    // Debug: Log the item structure
    console.log('Wishlist item:', JSON.stringify(item, null, 2));
    
    // Get the correct price
    const regularPrice = item.regularPrice || item.price || 0;
    const specialPrice = item.specialPrice;
    const displayPrice = specialPrice && specialPrice < regularPrice ? specialPrice : regularPrice;
    
    return (
      <View style={styles.wishlistItem}>
        <View style={styles.itemImageContainer}>
          <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }} style={styles.itemImage} />
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => handleRemoveFromWishlist(item._id)}
          >
            <Icon name="x" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.itemDetails}>
          <Text style={styles.itemBrand}>{item.brand?.name || 'Brand'}</Text>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          
          <View style={styles.priceContainer}>
            {specialPrice && specialPrice < regularPrice ? (
              <>
                <Text style={styles.price}>₹{specialPrice}</Text>
                <Text style={styles.originalPrice}>₹{regularPrice}</Text>
              </>
            ) : (
              <Text style={styles.price}>₹{displayPrice}</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => {
              if (item.productType === 'configurable') {
                navigation.navigate('ProductDetails', { productId: item._id });
                return;
              }
              // simple product: add directly
              (async () => {
                await addToCart(item, 1);
              })();
            }}
          >
            <Icon name="shopping-cart" size={14} color="#fff" />
            <Text style={styles.addToCartText}>
              {item.productType === 'configurable' ? 'Choose Options' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={styles.wishlistBadge}>
          <Text style={styles.wishlistBadgeText}>{wishlist.length}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading wishlist...</Text>
        </View>
      ) : wishlist.length === 0 ? (
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
          {/* Wishlist Items */}
          <FlatList
            data={wishlist}
            renderItem={renderWishlistItem}
            keyExtractor={(item) => item._id}
            numColumns={2}
            contentContainerStyle={styles.wishlistGrid}
            columnWrapperStyle={styles.wishlistRow}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
      <ViewCartFooter />
    </View>
  );
};





// Sticky cart footer
// Shows mini cart preview and checkout CTA


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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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