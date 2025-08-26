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

const MostPopularSection = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionConfig, setSectionConfig] = useState(null);

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
          setProducts(mostPopularSection.products || []);
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
    return (
    <View style={{ marginBottom: 5 }}>
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('ProductDetails', { productId: item._id })}
      >
        <Image 
          source={{ uri: item.images && item.images[0] }} 
          style={styles.image}
          defaultSource={require('../assets/Placeholder_01.png')}
        />
        <View style={styles.favicon}>
          <AntDesign name="heart" size={14} color="#FFA726" />
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.likes}>
            <Text style={styles.likesText}>{item.rating || 0}</Text>
          </View>
          {sectionConfig?.settings?.showPrice && (
            item.specialPrice != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.tag, { color: '#e53935', fontWeight: '700' }]}>₹{item.specialPrice}</Text>
                <Text style={[styles.tag, { textDecorationLine: 'line-through', color: '#888' }]}>₹{item.regularPrice}</Text>
              </View>
            ) : (
              price != null && <Text style={styles.tag}>₹{price}</Text>
            )
          )}
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
    width: 140,
    borderRadius: 6,
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
    height: 120,
    resizeMode: 'cover',
  },
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
