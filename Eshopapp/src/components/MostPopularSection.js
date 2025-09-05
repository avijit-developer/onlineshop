import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import api from '../utils/api';
import { useWishlist } from '../contexts/WishlistContext';

const MostPopularSection = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionConfig, setSectionConfig] = useState(null);
  const { toggleWishlist, isInWishlist } = useWishlist();

  const pickValue = (obj, paths, fallback = null) => {
    for (const path of paths) {
      let cur = obj;
      let ok = true;
      for (const key of path) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, key)) {
          cur = cur[key];
        } else { ok = false; break; }
      }
      if (ok && cur != null) return cur;
    }
    return fallback;
  };
  const toNumber = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const n = parseFloat(val);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  useEffect(() => {
    fetchSectionData();
  }, []);

  const fetchSectionData = async () => {
    try {
      setLoading(true);
      console.log('MostPopularSection: Fetching homepage sections...');
      const response = await api.getHomePageSections();
      console.log('MostPopularSection: API response:', response);
      if (response.success) {
        const mostPopularSection = response.data.find(section => section.name === 'most-popular');
        console.log('MostPopularSection: Found section:', mostPopularSection);
        if (mostPopularSection && mostPopularSection.isActive) {
          setSectionConfig(mostPopularSection);
          const baseProducts = (mostPopularSection.products || []).map((p) => {
            const ratingRaw = pickValue(p, [
              ['rating'], ['avgRating'], ['averageRating'], ['ratingsAverage'], ['ratingValue'],
              ['reviews','average'], ['reviews','avg']
            ], 0);
            const countRaw = pickValue(p, [
              ['reviewsCount'], ['reviewCount'], ['numReviews'], ['reviews'], ['ratingsCount']
            ], 0);
            return { ...p, rating: toNumber(ratingRaw), reviewsCount: toNumber(countRaw) };
          });
          setProducts(baseProducts);
          // Enrich ratings if missing
          try {
            const enriched = await Promise.all(
              baseProducts.map(async (p) => {
                const hasRating = (p && toNumber(p.rating) > 0);
                if (!hasRating && (p && (p._id || p.id))) {
                  try {
                    const res = await api.getProductPublic(p._id || p.id);
                    const rd = res?.data || res;
                    // Normalize possible nesting
                    const prod = rd?.product || rd?.data?.product || rd;
                    if (prod) {
                      let rRaw = pickValue(prod, [
                        ['rating'], ['avgRating'], ['averageRating'], ['ratingsAverage'], ['ratingValue'],
                        ['reviewsSummary','average'], ['reviews','average'], ['reviews','avg']
                      ], p.rating);
                      let cRaw = pickValue(prod, [
                        ['reviewsCount'], ['reviewCount'], ['numReviews'], ['ratingsCount'], ['reviewsSummary','count'], ['reviews','count']
                      ], p.reviewsCount);
                      // Fallback: derive from reviews array
                      if ((!rRaw || toNumber(rRaw) === 0) && Array.isArray(prod.reviews) && prod.reviews.length > 0) {
                        const sum = prod.reviews.reduce((s, r) => s + toNumber(r.rating), 0);
                        rRaw = sum / prod.reviews.length;
                        cRaw = prod.reviews.length;
                      }
                      return { ...p, rating: toNumber(rRaw), reviewsCount: toNumber(cRaw) };
                    }
                  } catch (_) {}
                }
                return p;
              })
            );
            setProducts(enriched);
          } catch (_) {}
          console.log('MostPopularSection: Set products:', mostPopularSection.products?.length || 0);
        }
      }
    } catch (error) {
      console.error('MostPopularSection: Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const price = (item.specialPrice ?? item.regularPrice ?? item.price);
    const getNumeric = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const n = parseFloat(val);
        return isNaN(n) ? 0 : n;
      }
      return 0;
    };
    const rating = getNumeric(
      item.rating ?? item.avgRating ?? item.averageRating ?? item.ratingAverage ?? item.ratingsAverage ?? item.ratingValue ?? 0
    );
    const ratingCount = getNumeric(
      item.reviewsCount ?? item.reviews ?? item.numReviews ?? item.reviewCount ?? 0
    );
    const productId = item._id || item.id;
    const wishlisted = isInWishlist(productId);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('ProductDetails', { productId })}
        activeOpacity={0.9}
      >
        <Image 
          source={{ uri: item.images && item.images[0] }} 
          style={styles.image}
          defaultSource={require('../assets/Placeholder_01.png')}
        />
        {/* Tag ribbons */}
        {tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {tags.slice(0,2).map((t, idx) => (
              <View key={`${t}-${idx}`} style={[styles.tagRibbon, idx > 0 && { marginTop: 4 }]}> 
                <Text style={styles.tagRibbonText} numberOfLines={1}>{String(t)}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={styles.favicon}
          activeOpacity={0.8}
          onPress={async (e) => {
            e.stopPropagation();
            try { await toggleWishlist(productId); } catch (_) {}
          }}
        >
          <AntDesign name={wishlisted ? 'heart' : 'hearto'} size={14} color={wishlisted ? '#e53935' : '#FFA726'} />
        </TouchableOpacity>
        {/* Discount ribbon */}
        {(() => { 
          const rp = Number(item.regularPrice || 0);
          const sp = Number(item.specialPrice ?? (item.price ?? 0));
          const show = rp > 0 && sp > 0 && sp < rp;
          const pct = show ? Math.round(100 - (sp / rp) * 100) : 0;
          return show ? (
            <View style={styles.discountCornerContainer}><View style={styles.discountCorner}><Text style={styles.discountCornerText}>-{pct}%</Text></View></View>
          ) : null;
        })()}
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <View style={styles.metaRow}>
            {rating > 0 ? (
              <Text style={styles.ratingBadge}>★ {rating.toFixed(1)}{ratingCount ? ` (${ratingCount})` : ''}</Text>
            ) : <View />}
            {sectionConfig?.settings?.showPrice && (
              item.specialPrice != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.price, { color: '#e53935' }]}>₹{item.specialPrice}</Text>
                  <Text style={styles.oldPrice}>₹{item.regularPrice}</Text>
                </View>
              ) : (
                price != null && <Text style={styles.price}>₹{price}</Text>
              )
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Most Popular</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFA726" />
        </View>
      </View>
    );
  }

  if (!sectionConfig || !sectionConfig.isActive) {
    console.log('MostPopularSection: Section not active or not found');
    return null;
  }

  if (products.length === 0) {
    console.log('MostPopularSection: No products found, showing empty state');
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Most Popular</Text>
        </View>
        <Text style={{ textAlign: 'center', color: '#666', padding: 20 }}>No products available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{sectionConfig.title}</Text>
      </View>

      {/* Horizontal List */}
      <FlatList
        horizontal
        data={products}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      />
    </View>
  );
};

export default MostPopularSection;

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: '#FFA726',
    fontWeight: '500',
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 160,
    borderRadius: 10,
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
    height: 130,
    resizeMode: 'cover',
  },
  tagsContainer: { position: 'absolute', top: 8, left: 8 },
  tagRibbon: { backgroundColor: '#2e7d32', paddingVertical: 2, paddingHorizontal: 6, borderTopRightRadius: 6, borderBottomRightRadius: 6, maxWidth: 100 },
  tagRibbonText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody: { padding: 8 },
  name: { fontSize: 13, fontWeight: '600', color: '#222', height: 34, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  ratingBadge: { fontSize: 12, color: '#333', fontWeight: '600' },
  priceRow: { },
  price: { fontSize: 14, fontWeight: '700', color: '#f7ab18' },
  oldPrice: { fontSize: 12, color: '#888', textDecorationLine: 'line-through' },
  discountCornerContainer: { position: 'absolute', top: -6, right: -24, zIndex: 10 },
  discountCorner: { backgroundColor: '#e53935', paddingVertical: 2, paddingHorizontal: 30, transform: [{ rotate: '45deg' }], borderRadius: 2, elevation: 3 },
  discountCornerText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    fontSize: 13,
    color: '#000',
  },
  tag: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  favicon:{
    position:'absolute',
    top:'10',
    left:'10',
    width:22,
    height:22,
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: 'rgba(250, 250, 250, .9)',
    borderRadius:20,
    paddingTop:2,
  },
});
