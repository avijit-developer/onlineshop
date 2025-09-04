import React, { useEffect, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../utils/api';
import ViewCartFooter from '../components/ViewCartFooter';

const placeholder = 'https://via.placeholder.com/80x80.png?text=Cat';

const CategoryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { categoryId, title } = route.params || {};
  const [children, setChildren] = useState([]);
  const [featuredCategories, setFeaturedCategories] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getCategoriesPublic({ parent: categoryId, limit: 100 });
        if (res?.success) {
          const mapped = (res.data || []).map(c => ({ id: c._id, name: c.name, image: c.image }));
          setChildren(mapped);
          if (mapped.length === 0) {
            navigation.replace('ProductList', { categoryId, title });
          }
        }
      } catch (_) {
        navigation.replace('ProductList', { categoryId, title });
      }
    })();
  }, [categoryId]);

  useEffect(() => {
    (async () => {
      try {
        // Fetch featured categories from root level
        const res = await api.getCategoriesPublic({ parent: 'root', limit: 100 });
        if (res?.success) {
          // Filter only featured categories
          const featured = (res.data || [])
            .filter(c => c.featured === true)
            .map(c => ({ id: c._id, name: c.name, image: c.image }))
            .slice(0, 6); // Show max 6 featured categories
          setFeaturedCategories(featured);
        }
      } catch (_) {
        // Ignore error for featured categories
      }
    })();
  }, []);

  const handleCategoryPress = (category) => {
    navigation.navigate('ProductList', { title: category.name, categoryId: category.id });
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.categoryCard}
      onPress={() => handleCategoryPress(item)}
    >
      <Image source={{ uri: item.image || placeholder }} style={styles.categoryImage} />
      <Text
        style={styles.categoryName}
        numberOfLines={(item?.name?.length || 0) > 10 ? 2 : 1}
      >
        {item.name}
      </Text>
      <Text style={styles.itemCount}>View products</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{title || 'Categories'}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')}>
          <Icon name="search-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Categories Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Subcategories</Text>
        
        <FlatList
          data={children}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />

        {/* Featured Categories */}
        {featuredCategories.length > 0 && (
          <View style={styles.featuredSection}>
            <Text style={styles.sectionTitle}>Featured Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {featuredCategories.map((item) => (
                <TouchableOpacity
                  key={`featured-${item.id}`}
                  style={styles.featuredCard}
                  onPress={() => handleCategoryPress(item)}
                >
                  <Image source={{ uri: item.image || placeholder }} style={styles.featuredImage} />
                  <Text
                    style={styles.featuredName}
                    numberOfLines={(item?.name?.length || 0) > 10 ? 2 : 1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
       </ScrollView>
       
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
    marginBottom: 14,
  },
  categoryCard: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  categoryImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 10,
  },
  categoryInfo: {
    flex: 1,
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
    flexShrink: 1,
    lineHeight: 18,
  },
  itemCount: {
    fontSize: 12,
    color: '#8791a1',
    textAlign: 'center',
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
    marginRight: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  featuredImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
  },
  featuredName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default CategoryScreen;