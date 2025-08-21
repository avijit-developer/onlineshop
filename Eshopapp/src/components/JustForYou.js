import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import api from '../utils/api';

const numColumns = 2;
const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 45) / 2; // 16px padding + 4px gap * 2

const JustForYou = ({ navigation }) => {
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

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.card, { width: cardWidth }]}
      onPress={() => navigation.navigate('ProductDetails', { productId: item._id })}
    >
      <Image 
        source={{ uri: item.images && item.images[0] }} 
        style={styles.image}
        defaultSource={require('../assets/Placeholder_01.png')}
      />
      <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
      {sectionConfig?.settings?.showPrice && (
        <Text style={styles.price}>₹{item.price}</Text>
      )}
    </TouchableOpacity>
  );

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

  if (!sectionConfig || !sectionConfig.isActive || products.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{sectionConfig.title}</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ProductList', { 
            title: sectionConfig.title,
            filter: 'recommended'
          })}
        >
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
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
  cardTitle: {
    fontSize: 13,
    padding: 8,
    color: '#333',
  },
  price: {
    fontSize: 15,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingBottom: 12,
    color: '#FFA726'
  },
});
