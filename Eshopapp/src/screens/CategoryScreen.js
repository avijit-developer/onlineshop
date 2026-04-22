import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import api from '../utils/api';
import ViewCartFooter from '../components/ViewCartFooter';

const placeholder = 'https://via.placeholder.com/80x80.png?text=Cat';

const CategoryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { categoryId, title } = route.params || {};
  const [children, setChildren] = useState([]);
  const [featuredCategories, setFeaturedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetchedRef = useRef(false);

  const fetchCategories = async (abortSignal) => {
    setLoading(true);
    setError(null);
    
    // If no categoryId provided (e.g., from footer navigation), fetch root categories
    const parentCategoryId = !categoryId || categoryId === 'all' ? 'root' : categoryId;
    
    try {
      const res = await api.getCategoriesPublic(
        { parent: parentCategoryId, limit: 200 },
        { signal: abortSignal, suppressNetworkErrorScreen: true }
      );
      
      if (abortSignal?.aborted) return;
      
      console.log('[CategoryScreen] API Response:', { 
        success: res?.success, 
        count: res?.data?.length || 0,
        categoryId: parentCategoryId,
        originalCategoryId: categoryId,
        meta: res?.meta 
      });
      
      if (res?.success) {
        const mapped = (res.data || []).map(c => ({ 
          id: c._id, 
          name: c.name, 
          image: c.image || placeholder 
        }));
        
        console.log('[CategoryScreen] Mapped categories:', mapped.length);
        setChildren(mapped);
        
        // Only navigate if truly no categories and we have a specific categoryId (not root)
        if (mapped.length === 0 && categoryId && categoryId !== 'all' && categoryId !== 'root') {
          // Wait a bit before navigating to allow user to see the state
          setTimeout(() => {
            if (!abortSignal?.aborted) {
              navigation.replace('ProductList', { categoryId, title });
            }
          }, 1500);
        }
      } else {
        console.error('[CategoryScreen] API returned unsuccessful response:', res);
        setError('Failed to load categories');
      }
    } catch (err) {
      if (abortSignal?.aborted) return;
      
      console.error('Error fetching categories:', err);
      setError(err.message || 'Failed to load categories');
      
      // Only navigate if it's a critical error (not timeout/network that might recover) and we have a specific categoryId
      if (err.status !== 408 && err.status !== 0 && categoryId && categoryId !== 'all' && categoryId !== 'root') {
        // Wait a bit before navigating to allow retry
        setTimeout(() => {
          if (!abortSignal?.aborted) {
            navigation.replace('ProductList', { categoryId, title });
          }
        }, 2000);
      }
    } finally {
      if (!abortSignal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    // Reset fetch flag when categoryId changes
    hasFetchedRef.current = false;

    (async () => {
      if (!isMounted) return;
      await fetchCategories(abortController.signal);
      hasFetchedRef.current = true;
    })();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [categoryId, title, navigation]);

  // Refetch when screen comes into focus (helps with delayed navigation issues)
  // This ensures data is fresh when user navigates to this screen
  useFocusEffect(
    React.useCallback(() => {
      let abortController = null;
      
      // Small delay to ensure navigation is complete before fetching
      const timer = setTimeout(() => {
        if (!hasFetchedRef.current && children.length === 0) {
          abortController = new AbortController();
          fetchCategories(abortController.signal);
          hasFetchedRef.current = true;
        }
      }, 100);
      
      return () => {
        clearTimeout(timer);
        if (abortController) {
          abortController.abort();
        }
      };
    }, [categoryId, children.length])
  );

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    (async () => {
      try {
        // Fetch featured categories from root level
        const res = await api.getCategoriesPublic(
          { parent: 'root', limit: 100 },
          { signal: abortController.signal, suppressNetworkErrorScreen: true }
        );
        
        if (!isMounted || abortController.signal.aborted) return;
        
        if (res?.success) {
          // Filter only featured categories
          const featured = (res.data || [])
            .filter(c => c.featured === true)
            .map(c => ({ id: c._id, name: c.name, image: c.image }))
            .slice(0, 6); // Show max 6 featured categories
          setFeaturedCategories(featured);
        }
      } catch (err) {
        // Ignore error for featured categories, but log it
        if (!abortController.signal.aborted) {
          console.warn('Error fetching featured categories:', err);
        }
      }
    })();

    return () => {
      isMounted = false;
      abortController.abort();
    };
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

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>{title || 'Categories'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Icon name="search-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      </View>
    );
  }

  if (error && children.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>{title || 'Categories'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Icon name="search-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={async () => {
              // Force re-fetch manually
              setError(null);
              setLoading(true);
              setChildren([]);
              
              // Use same logic as useEffect - if no categoryId, fetch root categories
              const parentCategoryId = !categoryId || categoryId === 'all' ? 'root' : categoryId;
              
              try {
                const res = await api.getCategoriesPublic(
                  { parent: parentCategoryId, limit: 200 },
                  { suppressNetworkErrorScreen: true }
                );
                console.log('[CategoryScreen] Retry response:', res);
                if (res?.success) {
                  const mapped = (res.data || []).map(c => ({ 
                    id: c._id, 
                    name: c.name, 
                    image: c.image || placeholder 
                  }));
                  setChildren(mapped);
                  setError(null);
                } else {
                  setError('Failed to load categories');
                }
              } catch (err) {
                console.error('Retry error:', err);
                setError(err.message || 'Failed to load categories');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        {children.length > 0 ? (
          <>
            <FlatList
              data={children}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.listContent}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No subcategories found</Text>
                </View>
              }
            />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="folder-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No subcategories available</Text>
            <Text style={styles.emptySubtext}>This category doesn't have any subcategories</Text>
            <TouchableOpacity 
              style={styles.viewProductsButton}
              onPress={() => navigation.navigate('ProductList', { categoryId, title })}
            >
              <Text style={styles.viewProductsButtonText}>View Products</Text>
            </TouchableOpacity>
          </View>
        )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  viewProductsButton: {
    marginTop: 24,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  viewProductsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CategoryScreen;
