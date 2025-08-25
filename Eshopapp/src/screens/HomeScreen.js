import React, { useRef, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native';

import Header from '../components/Header';
import { useWishlist } from '../contexts/WishlistContext';

// Removed static Best Seller (RecentView)

import BottomNavigation from '../components/BottomNavigation';
import SliderBanner from '../components/SliderBanner';
import AllCategories from '../components/AllCategories';
import CategoriesGrid from '../components/CategoriesGrid';
import MostPopularSection from '../components/MostPopularSection';
import JustForYou from '../components/JustForYou';
import BestSellerSection from '../components/BestSellerSection';


const HomeScreen = ({ navigation }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const [prevScrollY, setPrevScrollY] = useState(0);
  const { getWishlistCount, toggleWishlist, isInWishlist } = useWishlist();

  const handleScroll = (event) => {
    const currentY = event.nativeEvent.contentOffset.y;

    if (currentY > prevScrollY + 10) {
      Animated.timing(translateY, {
        toValue: 80,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (currentY < prevScrollY - 10) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    setPrevScrollY(currentY);
  };



  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

       
        <Header />
        
        {/* Test Wishlist Button */}
        <TouchableOpacity 
          style={styles.testButton}
          onPress={() => {
            Alert.alert('Wishlist Test', `Wishlist count: ${getWishlistCount()}`);
          }}
        >
          <Text style={styles.testButtonText}>Test Wishlist ({getWishlistCount()})</Text>
        </TouchableOpacity>
        
        <SliderBanner />
        <AllCategories />
        <MostPopularSection navigation={navigation} />
        <BestSellerSection navigation={navigation} />
        <CategoriesGrid />
        <JustForYou navigation={navigation} />
      </ScrollView>

      <Animated.View
        style={[
          styles.bottomNavContainer,
          { transform: [{ translateY }] },
        ]}
      >
        <BottomNavigation />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  testButton: {
    backgroundColor: '#f7ab18',
    padding: 10,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HomeScreen;
