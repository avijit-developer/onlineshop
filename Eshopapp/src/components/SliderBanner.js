import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';

const { width } = Dimensions.get('window');
import api, { API_BASE } from '../utils/api';

const ITEM_WIDTH = width * 0.9;

const SliderBanner = () => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/banners/public`);
        const json = await res.json();
        if (res.ok) {
          const items = (json.data || []).map((b, idx) => ({
            id: b._id || String(b.id) || String(idx),
            title: b.title,
            subtitle: b.description || '',
            tag: b.linkText || '',
            image: b.image || b.imageUrl,
          }));
          setBanners(items);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchBanners();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      <Image source={{ uri: item.image }} style={styles.bannerImage} />
      {(item.title || item.subtitle || item.tag) && (
        <View style={styles.overlayTextContainer}>
          {!!item.title && <Text style={styles.overlayTitle} numberOfLines={1}>{item.title}</Text>}
          {!!item.subtitle && <Text style={styles.overlaySubtitle} numberOfLines={1}>{item.subtitle}</Text>}
          {!!item.tag && <Text style={styles.overlayTag} numberOfLines={1}>{item.tag}</Text>}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.FlatList
        horizontal
        pagingEnabled
        data={banners}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        contentContainerStyle={{ paddingHorizontal: 10 }}
      />

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {banners.map((_, i) => {
          const inputRange = [(i - 1) * ITEM_WIDTH, i * ITEM_WIDTH, (i + 1) * ITEM_WIDTH];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 20, 8],
            extrapolate: 'clamp',
          });
          const dotColor = scrollX.interpolate({
            inputRange,
            outputRange: ['#bbb', '#444', '#bbb'],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    backgroundColor:'#fff'
  },
  slide: {
    width: ITEM_WIDTH,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlayTextContainer: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    right: 12,
    gap: 4,
  },
  overlayTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlaySubtitle: {
    color: '#fff',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayTag: {
    color: '#fff',
    fontSize: 11,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});

export default SliderBanner;