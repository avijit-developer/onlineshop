import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../utils/api';

const BestSellerSection = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionConfig, setSectionConfig] = useState(null);

  useEffect(() => {
    fetchSectionData();
  }, []);

  const fetchSectionData = async () => {
    try {
      setLoading(true);
      const response = await api.getHomePageSections();
      if (response.success) {
        const section = response.data.find(s => s.name === 'best-seller');
        if (section && section.isActive) {
          setSectionConfig(section);
          setProducts(section.products || []);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const price = (item.specialPrice ?? item.regularPrice ?? item.price);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ProductDetails', { productId: item._id })}
      >
        <Image
          source={{ uri: item.images && item.images[0] }}
          style={styles.image}
          defaultSource={require('../assets/Placeholder_01.png')}
        />
        {/* Tags */}
        {(() => {
          const tags = Array.isArray(item.tags)
            ? item.tags.map(v => (typeof v === 'string' ? v : (v && (v.name || v.label || v.title)))).filter(Boolean)
            : (typeof item.tags === 'string' ? item.tags.split(',').map(s => s.trim()).filter(Boolean) : []);
          return tags.length > 0 ? (
          <View style={styles.tagsContainer}>
            {tags.slice(0,2).map((t, idx) => (
              <View key={`${t}-${idx}`} style={[styles.tagRibbon, idx > 0 && { marginTop: 4 }]}> 
                <Text style={styles.tagRibbonText} numberOfLines={1}>{String(t)}</Text>
              </View>
            ))}
          </View>
          ) : null;
        })()}
        <View style={styles.cardFooter}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {sectionConfig?.settings?.showPrice && (
            item.specialPrice != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#e53935' }}>₹{item.specialPrice}</Text>
                <Text style={{ fontSize: 13, color: '#888', textDecorationLine: 'line-through' }}>₹{item.regularPrice}</Text>
              </View>
            ) : (
              price != null && <Text style={styles.price}>₹{price}</Text>
            )
          )}
        </View>
        {(() => {
          const rp = Number(item.regularPrice || 0);
          const sp = Number(item.specialPrice ?? (item.price ?? 0));
          const show = rp > 0 && sp > 0 && sp < rp;
          const pct = show ? Math.round(100 - (sp / rp) * 100) : 0;
          return show ? (
            <View style={styles.discountCornerContainer}><View style={styles.discountCorner}><Text style={styles.discountCornerText}>-{pct}%</Text></View></View>
          ) : null;
        })()}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Best Sellers</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFA726" />
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
        <View style={styles.header}>
          <Text style={styles.title}>{sectionConfig.title || 'Best Sellers'}</Text>
        </View>
        <Text style={{ textAlign: 'center', color: '#666', padding: 20 }}>No products available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{sectionConfig.title}</Text>
      </View>
      <FlatList
        horizontal
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#000' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontSize: 14, color: '#FFA726', fontWeight: '500' },
  loadingContainer: { height: 120, justifyContent: 'center', alignItems: 'center' },
  card: { 
    width: 160, 
    borderRadius: 8, 
    backgroundColor: '#fff', 
    overflow: 'hidden', 
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 2 
  },
  image: { width: '100%', height: 120, resizeMode: 'cover' },
  tagsContainer: { position: 'absolute', top: 8, left: 8 },
  tagRibbon: { backgroundColor: '#2e7d32', paddingVertical: 2, paddingHorizontal: 6, borderTopRightRadius: 6, borderBottomRightRadius: 6, maxWidth: 100 },
  tagRibbonText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardFooter: { padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  name: { fontSize: 13, color: '#333', marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '700', color: '#FFA726' },
  discountCornerContainer: { position: 'absolute', top: 0, right: 0, width: 54, height: 54, overflow: 'hidden', zIndex: 10 },
  discountCorner: { position: 'absolute', top: 6, right: -18, backgroundColor: '#e53935', paddingVertical: 2, paddingHorizontal: 40, transform: [{ rotate: '45deg' }], borderRadius: 2, elevation: 3 },
  discountCornerText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },
});

export default BestSellerSection;

