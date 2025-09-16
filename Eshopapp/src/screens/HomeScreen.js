import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import HomeSkeleton from '../components/HomeSkeleton';
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
  const fadeIn = useRef(new Animated.Value(0)).current;
  const [showSkeleton, setShowSkeleton] = useState(true);
  const { getWishlistCount, toggleWishlist, isInWishlist } = useWishlist();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      // Trigger children to refetch by remounting via key
      setRefreshKey((k) => k + 1);
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }, []);

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowSkeleton(false));
  }, [fadeIn, refreshKey]);

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
        style={{ opacity: undefined }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

       
        {showSkeleton && refreshKey === 0 ? (
          <HomeSkeleton />
        ) : (
          <Animated.View style={{ opacity: fadeIn }}>
            <Header key={`Header-${refreshKey}`} />
            
            {/* Removed test wishlist button */}
            
            <SliderBanner key={`SliderBanner-${refreshKey}`} />
            <AllCategories key={`AllCategories-${refreshKey}`} />
            <MostPopularSection key={`MostPopular-${refreshKey}`} navigation={navigation} />
            <BestSellerSection key={`BestSeller-${refreshKey}`} navigation={navigation} />
            <CategoriesGrid key={`CategoriesGrid-${refreshKey}`} navigation={navigation} />
            <JustForYou key={`JustForYou-${refreshKey}`} navigation={navigation} />
          </Animated.View>
        )}
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
