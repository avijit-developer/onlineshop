import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ProductCard from '../components/ProductCard';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../utils/api';
import ViewCartFooter from '../components/ViewCartFooter';

const placeholder = 'https://via.placeholder.com/300x300.png?text=Product';

const ProductList = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { categoryId, title } = route.params || {};
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [resultCount, setResultCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getProductsPublic({ category: categoryId, limit: 40 });
        const items = (res?.data || []).map(p => ({
          id: p._id || p.id,
          name: p.name,
          price: '₹' + (p.specialPrice ?? p.regularPrice ?? 0),
          oldPrice: null,
          rating: p.rating || 0,
          reviews: 0,
          image: (Array.isArray(p.images) && p.images[0]) || placeholder,
          liked: false,
        }));
        setFilteredProducts(items);
        setResultCount(items.length);
      } catch (_) {
        setFilteredProducts([]);
        setResultCount(0);
      }
    })();
  }, [categoryId]);

  const applyFilters = (filters) => {
    let filtered = [...filteredProducts];

    // Apply category filter
    if (filters.categories && filters.categories.length > 0) {
      // For demo purposes, we'll assume all current products are dresses
      // In a real app, you'd filter based on product categories
    }

    // Apply price filter
    if (filters.priceRange) {
      filtered = filtered.filter(item => {
        const price = parseFloat(String(item.price).replace('₹', ''));
        return price >= filters.priceRange[0] && price <= filters.priceRange[1];
      });
    }

    // Apply rating filter
    if (filters.rating > 0) {
      filtered = filtered.filter(item => item.rating >= filters.rating);
    }

    // Apply on sale filter
    if (filters.onSale) {
      filtered = filtered.filter(item => item.oldPrice);
    }

    setFilteredProducts(filtered);
    setResultCount(filtered.length);
    setAppliedFilters(filters);
  };

  const handleFilterPress = () => {
    navigation.navigate('Filter', {
      onApplyFilters: applyFilters,
    });
  };

  const renderItem = ({ item }) => <ProductCard item={item} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView style={{padding: 16, backgroundColor: '#fff'}} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Icon name="arrow-back-outline" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{title || 'Products'}</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Filter & Count */}
      <View style={styles.filterRow}>
        <Text style={styles.resultText}>Found {resultCount} Results</Text>
        <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
          <Text style={styles.filterText}>Filter</Text>
          <Icon name="chevron-down-outline" size={16} />
        </TouchableOpacity>
      </View>

      {/* Product Grid */}
      <FlatList
        data={filteredProducts}
        numColumns={2}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      </ScrollView>
      <ViewCartFooter />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    marginRight: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 16,
  },
  column: {
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    width: '45%',
    margin:5
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 10,
  },
  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    padding: 5,
    borderRadius: 100,
    elevation: 3,
  },
  name: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
  },
  priceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginRight: 6,
  },
  oldPrice: {
    fontSize: 13,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  ratingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reviewCount: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
});

export default ProductList;
