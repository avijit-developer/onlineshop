import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ProductCard from '../components/ProductCard';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../utils/api';
import ViewCartFooter from '../components/ViewCartFooter';
import ProductFilters from '../components/ProductFilters';
import FilterButton from '../components/FilterButton';
import FilterSummary from '../components/FilterSummary';

const placeholder = 'https://via.placeholder.com/300x300.png?text=Product';

const ProductList = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { categoryId, title, sectionName } = route.params || {};
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [resultCount, setResultCount] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null);
  const [currentFilters, setCurrentFilters] = useState({
    priceRange: [0, 1000],
    brands: [],
    productType: 'all',
    availability: 'all',
    minRating: 0,
    sortBy: 'newest'
  });
  const [filterLoading, setFilterLoading] = useState(false);

  useEffect(() => {
    // reset when category changes
    setFilteredProducts([]);
    setPage(1);
    setHasMore(true);
    setLoadedCount(0);
    setTotalAvailable(0);
  }, [categoryId, sectionName]);

  useEffect(() => {
    (async () => {
      try {
        // Don't load initial data if filters are active
        const hasActiveFilters = currentFilters.priceRange[0] !== (filterOptions?.priceRange?.min || 0) ||
                                currentFilters.priceRange[1] !== (filterOptions?.priceRange?.max || 1000) ||
                                currentFilters.brands.length > 0 ||
                                currentFilters.productType !== 'all' ||
                                currentFilters.availability !== 'all' ||
                                currentFilters.minRating > 0 ||
                                currentFilters.sortBy !== 'newest';
        
        if (hasActiveFilters) {
          console.log('🔍 Filters are active, skipping initial data load');
          return;
        }
        
        if (!hasMore && page !== 1) return;
        setLoadingMore(true);
        const fetcher = sectionName
          ? () => api.getHomePageSectionProducts(sectionName, { page, limit: 20 })
          : () => api.getProductsPublic({ category: categoryId, page, limit: 20 });
        const res = await fetcher();
        const items = (res?.data || []).map(p => ({
          id: p._id || p.id,
          name: p.name,
          price: '₹' + (p.specialPrice ?? p.regularPrice ?? 0),
          oldPrice: p.specialPrice != null ? ('₹' + (p.regularPrice ?? '')) : null,
          rating: p.rating || 0,
          reviews: 0,
          image: (Array.isArray(p.images) && p.images[0]) || placeholder,
          liked: false,
        }));
        const total = res?.meta?.total ?? 0;
        setTotalAvailable(total);
        setFilteredProducts(prev => page === 1 ? items : [...prev, ...items]);
        const newLoaded = page === 1 ? items.length : (loadedCount + items.length);
        setLoadedCount(newLoaded);
        setResultCount(total > 0 ? total : newLoaded);
        setHasMore(newLoaded < total && items.length > 0);
      } catch (_) {
        setHasMore(false);
      } finally {
        setLoadingMore(false);
      }
    })();
  }, [page, categoryId, sectionName, loadedCount, currentFilters, filterOptions]);

  const handleEndReached = () => {
    if (hasMore && !loadingMore) {
      setPage(prev => prev + 1);
    }
  };

  // Filter functions
  const loadFilterOptions = useCallback(async () => {
    try {
      setFilterLoading(true);
      const res = await api.getProductFilters({ category: categoryId });
      if (res?.success && res?.data) {
        setFilterOptions(res.data);
        // Initialize price range from filter options
        if (res.data.priceRange) {
          setCurrentFilters(prev => ({
            ...prev,
            priceRange: [res.data.priceRange.min, res.data.priceRange.max]
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load filter options:', error);
    } finally {
      setFilterLoading(false);
    }
  }, [categoryId]);

  const applyFilters = useCallback(async (filters) => {
    try {
      console.log('🚀 ProductList applyFilters called with:', filters);
      setFilterLoading(true);
      setCurrentFilters(filters);
      setPage(1);
      setHasMore(true);
      setLoadedCount(0);
      
      // Build API parameters
      const params = {
        category: categoryId,
        page: 1,
        limit: 20,
        ...filters,
        brands: filters.brands.length > 0 ? filters.brands.join(',') : undefined,
        minPrice: filters.priceRange[0],
        maxPrice: filters.priceRange[1]
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      console.log('🔍 ProductList applying filters with params:', params);
      
      const res = await api.getProductsPublic(params);
      console.log('📡 ProductList API response:', res);
      
      if (res?.success && res?.data) {
        const items = res.data.map(p => ({
          id: p._id || p.id,
          name: p.name,
          price: '₹' + (p.specialPrice ?? p.regularPrice ?? 0),
          oldPrice: p.specialPrice != null ? ('₹' + (p.regularPrice ?? '')) : null,
          rating: p.rating || 0,
          reviews: 0,
          image: (Array.isArray(p.images) && p.images[0]) || placeholder,
          liked: false,
        }));
        
        console.log('✅ ProductList filtered products:', items.length, 'items');
        console.log('💰 ProductList price ranges in results:', items.map(item => ({
          name: item.name,
          price: item.price,
          oldPrice: item.oldPrice
        })));
        
        const total = res?.meta?.total ?? 0;
        setTotalAvailable(total);
        setFilteredProducts(items);
        setLoadedCount(items.length);
        setResultCount(total > 0 ? total : items.length);
        setHasMore(items.length > 0 && items.length < total);
        
        console.log('📱 ProductList state updated: filteredProducts set to', items.length, 'items');
      }
    } catch (error) {
      console.error('❌ ProductList failed to apply filters:', error);
    } finally {
      setFilterLoading(false);
    }
  }, [categoryId]);

  const removeFilter = useCallback((filterKey) => {
    const newFilters = { ...currentFilters };
    
    switch (filterKey) {
      case 'priceRange':
        newFilters.priceRange = filterOptions?.priceRange ? 
          [filterOptions.priceRange.min, filterOptions.priceRange.max] : [0, 1000];
        break;
      case 'brands':
        newFilters.brands = [];
        break;
      case 'productType':
        newFilters.productType = 'all';
        break;
      case 'availability':
        newFilters.availability = 'all';
        break;
      case 'minRating':
        newFilters.minRating = 0;
        break;
      case 'sortBy':
        newFilters.sortBy = 'newest';
        break;
    }
    
    setCurrentFilters(newFilters);
    applyFilters(newFilters);
  }, [currentFilters, filterOptions, applyFilters]);

  const clearAllFilters = useCallback(() => {
    const defaultFilters = {
      priceRange: filterOptions?.priceRange ? 
        [filterOptions.priceRange.min, filterOptions.priceRange.max] : [0, 1000],
      brands: [],
      productType: 'all',
      availability: 'all',
      minRating: 0,
      sortBy: 'newest'
    };
    setCurrentFilters(defaultFilters);
    setFilteredProducts([]);
    // Reset to original data
    setPage(1);
    setHasMore(true);
    setLoadedCount(0);
  }, [filterOptions]);

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // Old filter function removed - now using comprehensive API-based filtering

  const handleFilterPress = () => {
    setShowFilters(true);
  };

  const renderItem = ({ item }) => <ProductCard item={item} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: 16 }]}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Icon name="arrow-back-outline" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{title || 'Products'}</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Filter & Count */}
      <View style={[styles.filterRow, { paddingHorizontal: 16 }]}>
        <Text style={styles.resultText}>Found {resultCount} Results</Text>
        <FilterButton 
          onPress={handleFilterPress}
          activeFiltersCount={Object.values(currentFilters).filter((v, i) => {
            if (i === 0) { // priceRange
              return v[0] !== (filterOptions?.priceRange?.min || 0) || v[1] !== (filterOptions?.priceRange?.max || 1000);
            }
            return v !== 'all' && v !== 0 && (!Array.isArray(v) || v.length > 0);
          }).length}
        />
      </View>

      {/* Filter Summary */}
      <View style={{ paddingHorizontal: 16 }}>
        <FilterSummary 
          filters={currentFilters}
          filterOptions={filterOptions}
          onRemoveFilter={removeFilter}
          onClearAll={clearAllFilters}
        />
      </View>

      {/* Product Grid */}
      {filterLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Applying filters...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {(() => {
              const hasActiveFilters = currentFilters.priceRange[0] !== (filterOptions?.priceRange?.min || 0) ||
                                      currentFilters.priceRange[1] !== (filterOptions?.priceRange?.max || 1000) ||
                                      currentFilters.brands.length > 0 ||
                                      currentFilters.productType !== 'all' ||
                                      currentFilters.availability !== 'all' ||
                                      currentFilters.minRating > 0 ||
                                      currentFilters.sortBy !== 'newest';
              
              if (hasActiveFilters) {
                return 'No products found with current filters. Try adjusting your criteria.';
              } else {
                return 'No products available in this category.';
              }
            })()}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          numColumns={2}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={() => (
            <View style={{ paddingHorizontal: 16 }}>
              {/* Header content moved here */}
            </View>
          )}
        />
      )}
      
      {/* Product Filters Modal */}
      <ProductFilters
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        filterOptions={filterOptions}
        currentFilters={currentFilters}
        loading={filterLoading}
      />
      
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
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
