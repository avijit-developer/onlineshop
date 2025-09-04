import React, { useRef, useState, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
  RefreshControl,
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
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      // Trigger children to refetch by any means available
      // If sections expose refresh via context or events, call them here.
      // As a fallback, briefly unmount/mount SliderBanner to refetch internally.
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }, []);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

       
        <Header />
        
        {/* Removed test wishlist button */}
        
        <SliderBanner />
        <AllCategories />
        <MostPopularSection navigation={navigation} />
        <BestSellerSection navigation={navigation} />
        <CategoriesGrid navigation={navigation} />
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
  
});

export default HomeScreen;
