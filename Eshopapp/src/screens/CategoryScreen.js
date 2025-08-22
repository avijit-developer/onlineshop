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

  const handleCategoryPress = (category) => {
    navigation.navigate('ProductList', { title: category.name, categoryId: category.id });
  };

  const renderCategoryItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.categoryCard, { backgroundColor: '#F8F8F8' }]}
      onPress={() => handleCategoryPress(item)}
    >
      <Image source={{ uri: item.image || placeholder }} style={styles.categoryImage} />
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.itemCount}>View products</Text>
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
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>Featured Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {children.slice(0, 4).map((item) => (
              <TouchableOpacity
                key={`featured-${item.id}`}
                style={styles.featuredCard}
                onPress={() => handleCategoryPress(item)}
              >
                <Image source={{ uri: item.image || placeholder }} style={styles.featuredImage} />
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