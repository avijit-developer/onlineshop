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
import { useNavigation } from '@react-navigation/native';
import ViewCartFooter from '../components/ViewCartFooter';

const dresses = [
  {
    id: '1',
    name: 'Linen Dress',
    price: '$52.00',
    oldPrice: '$90.00',
    rating: 4.5,
    reviews: 64,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/92265483-9E7E-4FC3-A355-16CCA677C11C_zbsxfe.png',
    liked: true,
  },
  {
    id: '2',
    name: 'Filted Waist Dress',
    price: '$47.99',
    oldPrice: '$82.00',
    rating: 4.3,
    reviews: 53,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410272/Placeholder_01-1_maxcyi.png',
    liked: false,
  },
  {
    id: '3',
    name: 'Maxi Dress',
    price: '$68.00',
    rating: 4.0,
    reviews: 46,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_01_zfhxws.png',
    liked: false,
  },
  {
    id: '4',
    name: 'Front Tie Mini Dress',
    price: '$59.00',
    rating: 4.4,
    reviews: 38,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410274/32EB245A-E30D-4D15-B57A-23A577C43459_f3x5xd.png',
    liked: true,
  },
  {
    id: '5',
    name: 'Ohara Dress',
    price: '$85.00',
    rating: 4.0,
    reviews: 50,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/aaa_qer6ir.png',
    liked: true,
  },
  {
    id: '6',
    name: 'Tie Back Mini Dress',
    price: '$67.00',
    rating: 4.2,
    reviews: 39,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/A70864C8-1B1F-4014-84A4-450CD75C9CEF_vedkuw.png',
    liked: true,
  },
  {
    id: '7',
    name: 'Leaves Green Dress',
    price: '$64.00',
    rating: 4.6,
    reviews: 83,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_101_mdvn5x.png',
    liked: false,
  },
  {
    id: '8',
    name: 'Off Shoulder Dress',
    price: '$78.99',
    rating: 4.1,
    reviews: 25,
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410395/Placeholder_01_1_y1m8t0.png',
    liked: false,
  },
];

const ProductList = () => {
  const navigation = useNavigation();
  const [filteredProducts, setFilteredProducts] = useState(dresses);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [resultCount, setResultCount] = useState(dresses.length);

  const applyFilters = (filters) => {
    let filtered = [...dresses];

    // Apply category filter
    if (filters.categories && filters.categories.length > 0) {
      // For demo purposes, we'll assume all current products are dresses
      // In a real app, you'd filter based on product categories
    }

    // Apply price filter
    if (filters.priceRange) {
      filtered = filtered.filter(item => {
        const price = parseFloat(item.price.replace('$', ''));
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
        <Text style={styles.title}>Dresses</Text>
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
        keyExtractor={(item) => item.id}
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
