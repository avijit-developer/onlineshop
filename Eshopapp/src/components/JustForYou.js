import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import api from '../utils/api';
import AntDesign from 'react-native-vector-icons/AntDesign';
import { useWishlist } from '../contexts/WishlistContext';

const numColumns = 2;
const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 45) / 2; // 16px padding + 4px gap * 2

const JustForYou = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionConfig, setSectionConfig] = useState(null);
  const { toggleWishlist, isInWishlist } = useWishlist();

  useEffect(() => {
    fetchSectionData();
  }, []);

  const fetchSectionData = async () => {
    try {
      setLoading(true);
      const response = await api.getHomePageSections();
      if (response.success) {
        const justForYouSection = response.data.find(section => section.name === 'just-for-you');
        if (justForYouSection && justForYouSection.isActive) {
          setSectionConfig(justForYouSection);
          setProducts(justForYouSection.products || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch just for you products:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const productId = item._id || item.id;
    const wishlisted = isInWishlist(productId);
    const rp = Number(item.regularPrice || 0);
    const sp = Number(item.specialPrice ?? (item.price ?? 0));
    const showDiscount = rp > 0 && sp > 0 && sp < rp;
    const pct = showDiscount ? Math.round(100 - (sp / rp) * 100) : 0;
    const rating = Number(item.rating || 0);
    const ratingCount = Number(item.reviewsCount || 0);
    return (
      <TouchableOpacity 
        style={[styles.card, { width: cardWidth }]}
        onPress={() => navigation.navigate('ProductDetails', { productId })}
        activeOpacity={0.9}
      >
        <Image 
          source={{ uri: item.images && item.images[0] }} 
          style={styles.image}
          defaultSource={require('../assets/Placeholder_01.png')}
        />

        {/* Heart */}
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

        {/* Discount badge */}
        {showDiscount && (
          <View style={styles.discountBadge}><Text style={styles.discountText}>-{pct}%</Text></View>
        )}

        <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
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
              <Text style={styles.price}>₹{item.specialPrice ?? item.regularPrice ?? item.price}</Text>
            )
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Just For You</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFA726" />
        </View>
      </View>
    );
  }

  if (!sectionConfig || !sectionConfig.isActive) {
    return null;
  }

  if (products.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{sectionConfig.title || 'Just For You'}</Text>
        </View>
        <Text style={{ textAlign: 'center', color: '#666', padding: 20 }}>No products available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{sectionConfig.title}</Text>
      </View>
      <FlatList
        data={products}
        numColumns={numColumns}
        keyExtractor={(item) => item._id}
        columnWrapperStyle={styles.row}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    </View>
  );
};

export default JustForYou;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    top: -20
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  seeAll: {
    fontSize: 14,
    color: '#FFA726',
    fontWeight: '500',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  star: {
    fontSize: 16,
    color: '#b3111fff',
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  favicon:{
    position:'absolute',
    top:8,
    right:8,
    width:22,
    height:22,
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: 'rgba(250, 250, 250, .9)',
    borderRadius:20,
    paddingTop:2,
  },
  discountBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#e53935', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cardTitle: {
    fontSize: 13,
    padding: 8,
    color: '#333',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  ratingBadge: { fontSize: 12, color: '#333', fontWeight: '600' },
  price: { fontSize: 15, fontWeight: 'bold', color: '#FFA726' },
  oldPrice: { fontSize: 12, color: '#888', textDecorationLine: 'line-through' },
});
