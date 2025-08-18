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

const API_BASE = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || 'http://10.0.2.2:5000';

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
            bgColor: '#42A5F5',
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
    <View style={[styles.slide, { backgroundColor: item.bgColor }]}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <Text style={styles.tag}>{item.tag}</Text>
      </View>
      <Image source={{ uri: item.image }} style={styles.image} />
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
            outputRange: ['#ccc', '#FFA726', '#ccc'],
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
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  tag: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  image: {
    width: 90,
    height: 120,
    resizeMode: 'contain',
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
