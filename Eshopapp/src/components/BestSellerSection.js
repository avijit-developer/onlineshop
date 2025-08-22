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
        <TouchableOpacity
          style={styles.seeAll}
          onPress={() => navigation.navigate('ProductList', { title: sectionConfig.title, filter: 'best' })}
        >
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="arrow-forward-circle" size={18} color="#FFA726" />
        </TouchableOpacity>
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
  card: { width: 160, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  image: { width: '100%', height: 120, resizeMode: 'cover' },
  cardFooter: { padding: 8 },
  name: { fontSize: 13, color: '#333', marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '700', color: '#FFA726' },
});

export default BestSellerSection;

