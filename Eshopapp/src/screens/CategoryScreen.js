import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import ViewCartFooter from '../components/ViewCartFooter';

const categories = [
  {
    id: '1',
    name: 'Dresses',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/92265483-9E7E-4FC3-A355-16CCA677C11C_zbsxfe.png',
    itemCount: 152,
    color: '#FFE4E1'
  },
  {
    id: '2',
    name: 'Tops',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410272/Placeholder_01-1_maxcyi.png',
    itemCount: 89,
    color: '#E6F3FF'
  },
  {
    id: '3',
    name: 'Bottoms',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_01_zfhxws.png',
    itemCount: 76,
    color: '#F0FFF0'
  },
  {
    id: '4',
    name: 'Shoes',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410274/32EB245A-E30D-4D15-B57A-23A577C43459_f3x5xd.png',
    itemCount: 134,
    color: '#FFF8DC'
  },
  {
    id: '5',
    name: 'Accessories',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/aaa_qer6ir.png',
    itemCount: 67,
    color: '#F5F0FF'
  },
  {
    id: '6',
    name: 'Bags',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/A70864C8-1B1F-4014-84A4-450CD75C9CEF_vedkuw.png',
    itemCount: 45,
    color: '#FFE4E6'
  },
  {
    id: '7',
    name: 'Jewelry',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_101_mdvn5x.png',
    itemCount: 98,
    color: '#E8F4FD'
  },
  {
    id: '8',
    name: 'Beauty',
    image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410395/Placeholder_01_1_y1m8t0.png',
    itemCount: 156,
    color: '#FFF0F5'
  }
];

const CategoryScreen = () => {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleCategoryPress = (category) => {
    setSelectedCategory(category.id);
    navigation.navigate('ProductList', { 
      category: category.name,
      categoryId: category.id 
    });
  };

  const renderCategoryItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.categoryCard, { backgroundColor: item.color }]}
      onPress={() => handleCategoryPress(item)}
    >
      <Image source={{ uri: item.image }} style={styles.categoryImage} />
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.itemCount}>{item.itemCount} items</Text>
      </View>
      <Icon name="chevron-forward-outline" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')}>
          <Icon name="search-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Categories Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Browse by Category</Text>
        
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />

        {/* Featured Categories */}
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>Featured Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.slice(0, 4).map((item) => (
              <TouchableOpacity
                key={`featured-${item.id}`}
                style={styles.featuredCard}
                onPress={() => handleCategoryPress(item)}
              >
                <Image source={{ uri: item.image }} style={styles.featuredImage} />
                <Text style={styles.featuredName}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
                 </View>
       </ScrollView>
       
       <ViewCartFooter />
     </View>
   );
 };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
  },
  categoryImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
  },
  featuredSection: {
    marginTop: 30,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  featuredCard: {
    width: 120,
    marginRight: 16,
    alignItems: 'center',
  },
  featuredImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  featuredName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
});

export default CategoryScreen;