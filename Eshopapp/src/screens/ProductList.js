import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import ProductFilters from '../components/ProductFilters';
import ViewCartFooter from '../components/ViewCartFooter';
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
  const reqSeqRef = useRef(0);

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
        if (hasActiveFilters) return;
        
        if (!hasMore && page !== 1) return;
        setLoadingMore(true);
        const mySeq = ++reqSeqRef.current;
        const fetcher = sectionName
          ? () => api.getHomePageSectionProducts(sectionName, { page, limit: 20 })
          : () => api.getProductsPublic({ category: categoryId, page, limit: 20, includeDescendants: true });
        const toNumber = (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? 0 : n; }
          return 0;
        };
        const pickVal = (obj, paths, fallback = 0) => {
          for (const path of paths) {
            let cur = obj; let ok = true;
            for (const k of path) { if (cur && Object.prototype.hasOwnProperty.call(cur, k)) cur = cur[k]; else { ok = false; break; } }
            if (ok && cur != null) return cur;
          }
          return fallback;
        };
        // Log only query and result
        const queryLog = sectionName
          ? { sectionName, page, limit: 20 }
          : { category: categoryId, page, limit: 20 };
        console.log('[ProductList] query', queryLog);
        let res;
        try {
          res = await fetcher();
          console.log('[ProductList] result', { count: Array.isArray(res?.data) ? res.data.length : 0, meta: res?.meta });
        } catch (err) {
          console.log('[ProductList] result', { error: err?.message || 'request failed' });
          throw err;
        }
        const baseItems = (res?.data || []).map(p => {
          const ratingRaw = pickVal(p, [
            ['rating'], ['avgRating'], ['averageRating'], ['ratingsAverage'], ['ratingValue'],
            ['reviews','average'], ['reviews','avg']
          ], 0);
          const reviewsCountRaw = pickVal(p, [
            ['reviewsCount'], ['reviewCount'], ['numReviews'], ['ratingsCount'], ['reviews','count']
          ], 0);
          return ({
            id: p._id || p.id,
            name: p.name,
            price: '₹' + (p.specialPrice ?? p.regularPrice ?? 0),
            oldPrice: p.specialPrice != null ? ('₹' + (p.regularPrice ?? '')) : null,
            regularPrice: p.regularPrice ?? null,
            specialPrice: p.specialPrice ?? null,
            tags: Array.isArray(p.tags)
              ? p.tags.map(v => (typeof v === 'string' ? v : (v && (v.name || v.label || v.title)))).filter(Boolean)
              : (typeof p.tags === 'string' ? p.tags.split(',').map(s => s.trim()).filter(Boolean) : []),
            rating: toNumber(ratingRaw),
            reviewsCount: toNumber(reviewsCountRaw),
            image: (Array.isArray(p.images) && p.images[0]) || placeholder,
            liked: false,
          });
        });
        if (mySeq !== reqSeqRef.current) return; // stale
        setFilteredProducts(prev => page === 1 ? baseItems : [...prev, ...baseItems]);
        // Enrich ratings if missing
        try {
          const itemsNeeding = baseItems.filter(p => !p.rating && (p.id));
          if (itemsNeeding.length) {
            const enrichedList = await Promise.all(baseItems.map(async (it) => {
              if (it.rating > 0 || !it.id) return it;
              try {
                const pr = await api.getProductPublic(it.id);
                const rd = pr?.data || pr;
                const prod = rd?.product || rd?.data?.product || rd;
                if (prod) {
                  const rRaw = pickVal(prod, [
                    ['rating'], ['avgRating'], ['averageRating'], ['ratingsAverage'], ['ratingValue'],
                    ['reviewsSummary','average'], ['reviews','average'], ['reviews','avg']
                  ], 0);
                  let cRaw = pickVal(prod, [
                    ['reviewsCount'], ['reviewCount'], ['numReviews'], ['ratingsCount'], ['reviewsSummary','count'], ['reviews','count']
                  ], 0);
                  // If still zero but reviews array exists
                  if ((!rRaw || toNumber(rRaw) === 0) && Array.isArray(prod.reviews) && prod.reviews.length > 0) {
                    const sum = prod.reviews.reduce((s, r) => s + toNumber(r.rating), 0);
                    it.rating = sum / prod.reviews.length;
                    it.reviewsCount = prod.reviews.length;
                    return it;
                  }
                  it.rating = toNumber(rRaw);
                  it.reviewsCount = toNumber(cRaw);
                }
              } catch (_) {}
              return it;
            }));
            if (mySeq !== reqSeqRef.current) return; // stale
            setFilteredProducts(prev => {
              // Replace the last page segment with enriched values
              const start = page === 1 ? 0 : (prev.length - baseItems.length);
              const next = prev.slice();
              for (let i = 0; i < enrichedList.length; i++) {
                next[start + i] = enrichedList[i];
              }
              return next;
            });
          }
        } catch (_) {}
        const total = res?.meta?.total ?? 0;
        if (mySeq !== reqSeqRef.current) return; // stale
        setTotalAvailable(total);
        const newLoaded = page === 1 ? baseItems.length : (loadedCount + baseItems.length);
        setLoadedCount(newLoaded);
        setResultCount(total > 0 ? total : newLoaded);
        setHasMore(newLoaded < total && baseItems.length > 0);
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
      const mySeq = ++reqSeqRef.current;
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
      // no console (only query/result elsewhere)
    } finally {
      setFilterLoading(false);
    }
  }, [categoryId]);

  const applyFilters = useCallback(async (filters) => {
    try {
      setFilterLoading(true);
      setCurrentFilters(filters);
      setPage(1);
      setHasMore(true);
      setLoadedCount(0);
      
      // Build API parameters - ALWAYS include category if available
      const params = {
        page: 1,
        limit: 20,
        ...filters,
        brands: filters.brands.length > 0 ? filters.brands.join(',') : undefined,
        minPrice: filters.priceRange[0],
        maxPrice: filters.priceRange[1]
      };
      
      // Ensure category: prefer selected child category, else lock to parent category if available
      if (filters.category) {
        params.category = filters.category;
        params.includeDescendants = true;
      } else if (categoryId) {
        params.category = categoryId;
        params.includeDescendants = true;
      } else if (sectionName) {
        params.sectionName = sectionName;
      }
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Log only query and result
      console.log('[ProductList] query', params);
      let res;
      try {
        res = await api.getProductsPublic(params);
        console.log('[ProductList] result', { count: Array.isArray(res?.data) ? res.data.length : 0, meta: res?.meta });
      } catch (err) {
        console.log('[ProductList] result', { error: err?.message || 'request failed' });
        throw err;
      }
      
      if (res?.success && res?.data) {
        const toNumber = (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? 0 : n; }
          return 0;
        };
        const pickVal = (obj, paths, fallback = 0) => {
          for (const path of paths) {
            let cur = obj; let ok = true;
            for (const k of path) { if (cur && Object.prototype.hasOwnProperty.call(cur, k)) cur = cur[k]; else { ok = false; break; } }
            if (ok && cur != null) return cur;
          }
          return fallback;
        };
        const items = res.data.map(p => {
          const ratingRaw = pickVal(p, [
            ['rating'], ['avgRating'], ['averageRating'], ['ratingsAverage'], ['ratingValue'],
            ['reviews','average'], ['reviews','avg']
          ], 0);
          const reviewsCountRaw = pickVal(p, [
            ['reviewsCount'], ['reviewCount'], ['numReviews'], ['ratingsCount'], ['reviews','count']
          ], 0);
          return ({
            id: p._id || p.id,
            name: p.name,
            price: '₹' + (p.specialPrice ?? p.regularPrice ?? 0),
            oldPrice: p.specialPrice != null ? ('₹' + (p.regularPrice ?? '')) : null,
            regularPrice: p.regularPrice ?? null,
            specialPrice: p.specialPrice ?? null,
            tags: Array.isArray(p.tags)
              ? p.tags.map(v => (typeof v === 'string' ? v : (v && (v.name || v.label || v.title)))).filter(Boolean)
              : (typeof p.tags === 'string' ? p.tags.split(',').map(s => s.trim()).filter(Boolean) : []),
            rating: toNumber(ratingRaw),
            reviewsCount: toNumber(reviewsCountRaw),
            image: (Array.isArray(p.images) && p.images[0]) || placeholder,
            liked: false,
          });
        });
        if (mySeq !== reqSeqRef.current) return; // stale
        const total = res?.meta?.total ?? 0;
        setTotalAvailable(total);
        setFilteredProducts(items);
        // Enrich ratings for zero values
        try {
          const need = items.filter(p => !p.rating && p.id);
          if (need.length) {
            const enriched = await Promise.all(items.map(async (it) => {
              if (it.rating > 0 || !it.id) return it;
              try {
                const pr = await api.getProductPublic(it.id);
                const rd = pr?.data || pr;
                const prod = rd?.product || rd?.data?.product || rd;
                if (prod) {
                  const rRaw = pickVal(prod, [
                    ['rating'], ['avgRating'], ['averageRating'], ['ratingsAverage'], ['ratingValue'],
                    ['reviewsSummary','average'], ['reviews','average'], ['reviews','avg']
                  ], 0);
                  let cRaw = pickVal(prod, [
                    ['reviewsCount'], ['reviewCount'], ['numReviews'], ['ratingsCount'], ['reviewsSummary','count'], ['reviews','count']
                  ], 0);
                  if ((!rRaw || toNumber(rRaw) === 0) && Array.isArray(prod.reviews) && prod.reviews.length > 0) {
                    const sum = prod.reviews.reduce((s, r) => s + toNumber(r.rating), 0);
                    it.rating = sum / prod.reviews.length;
                    it.reviewsCount = prod.reviews.length;
                    return it;
                  }
                  it.rating = toNumber(rRaw);
                  it.reviewsCount = toNumber(cRaw);
                }
              } catch (_) {}
              return it;
            }));
            if (mySeq !== reqSeqRef.current) return; // stale
            setFilteredProducts(enriched);
          }
        } catch (_) {}
        setLoadedCount(items.length);
        setResultCount(total > 0 ? total : items.length);
        setHasMore(items.length > 0 && items.length < total);
        
        // no additional console
      }
    } catch (error) {
      // logged above as result error
    } finally {
      setFilterLoading(false);
    }
  }, [categoryId, sectionName]);

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
    // Reset to original data but maintain category scope
    setPage(1);
    setHasMore(true);
    setLoadedCount(0);
    
    // Reload products for current category only
    // Trigger reload for current category/section via the effect
  }, [filterOptions, categoryId, sectionName]);

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
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  column: {
    justifyContent: 'space-between',
    marginBottom: 16,
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
