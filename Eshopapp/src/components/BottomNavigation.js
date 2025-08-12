import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
const BottomNavigation = () => {
  const navigation = useNavigation();
  const { getCartItemsCount } = useCart();
  const cartItemsCount = getCartItemsCount();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <Feather name="home" size={22} color="#FFA726" />
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Search')}>
        <Feather name="search" size={22} color="#FFA726" />
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Category')}>
        <Feather name="grid" size={22} color="#FFA726" />
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={styles.cartButton}>
        <Feather name="shopping-cart" size={22} color="#FFA726" />
        {cartItemsCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartItemsCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
        <Feather name="user" size={22} color="#FFA726" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  cartButton: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default BottomNavigation;