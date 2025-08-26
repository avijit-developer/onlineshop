import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import ViewCartFooter from '../components/ViewCartFooter';
import { useCart } from '../contexts/CartContext';

const RECENT_KEY = 'recentSearchesV1';
const rotatingTexts = [];

const placeholder = 'https://via.placeholder.com/300x300.png?text=Product';

const SearchScreen = () => {
  const navigation = useNavigation();

  const [index, setIndex] = useState(0);
  const [text, setText] = useState(rotatingTexts[0]);
  const slideAnim = useRef(new Animated.Value(20)).current; // slide from right
  const opacity = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef(null);
  const [recent, setRecent] = useState([]);
  const [categorySections, setCategorySections] = useState([]); // [{title, parentId, products: []}]
  const [isFocused, setIsFocused] = useState(false);
  const [searchBoxHeight, setSearchBoxHeight] = useState(0);
  const [animatedChoices, setAnimatedChoices] = useState(rotatingTexts);
  const { addToCart } = useCart();

 useEffect(() => {
  if (isFocused || query.length > 0) return;
  const animateText = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const pool = animatedChoices && animatedChoices.length ? animatedChoices : ['Search products'];
      const nextIndex = (index + 1) % pool.length;
      setText(pool[nextIndex]);
      setIndex(nextIndex);
      slideAnim.setValue(20); // reset from bottom
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const interval = setInterval(animateText, 3000);
  return () => clearInterval(interval);
}, [index, isFocused, query, animatedChoices]);

  // Load recent searches
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENT_KEY);
        if (stored) {
          setRecent(JSON.parse(stored));
        }
      } catch (_) {}
    })();
  }, []);

  const saveRecent = useCallback(async (term) => {
    try {
      const trimmed = String(term || '').trim();
      if (!trimmed) return;
      const next = [trimmed, ...recent.filter(r => r !== trimmed)].slice(0, 10);
      setRecent(next);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (_) {}
  }, [recent]);

  const removeRecent = useCallback(async (term) => {
    try {
      const next = recent.filter(r => r !== term);
      setRecent(next);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (_) {}
  }, [recent]);

  const clearRecent = useCallback(async () => {
    try {
      setRecent([]);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([]));
    } catch (_) {}
  }, []);

  // Fetch categories and build sections (2nd-level category name, products from main category limited to 5)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getCategoriesPublic({ parent: 'all', limit: 1000 });
        const all = res?.data || [];
        const parents = all.filter(c => !c.parent);
        const childrenByParent = new Map();
        all.forEach(c => {
          const pid = c.parent;
          if (!pid) return;
          const key = (typeof pid === 'object' && pid !== null) ? (pid._id || String(pid)) : String(pid);
          if (!childrenByParent.has(key)) childrenByParent.set(key, []);
          childrenByParent.get(key).push(c);
        });
        const built = [];
        for (const p of parents.slice(0, 4)) {
          const pid = String(p._id);
          const children = childrenByParent.get(pid) || [];
          if (children.length === 0) continue;
          // Pick the first child as the 2nd-level name to show
          const child = children[0];
          built.push({
            title: child.name,
            parentId: pid,
            parentTitle: p.name,
            products: [],
          });
        }
        if (!mounted) return;
        setCategorySections(built);
        // Build rotating placeholder list from 2nd-level category names (fallback to top-level)
        const childNames = [];
        parents.forEach(p => {
          const pid = String(p._id);
          const children = childrenByParent.get(pid) || [];
          children.forEach(ch => childNames.push(ch.name));
        });
        const names = childNames.length ? childNames : parents.map(p => p.name);
        if (names.length && mounted) {
          setAnimatedChoices(names);
          setText(names[0]);
        }
        // Fetch 5 products for each parent
        const fetched = await Promise.all(built.map(sec => api.getProductsPublic({ category: sec.parentId, page: 1, limit: 5 })));
        
        const withProducts = built.map((sec, idx) => {
          const items = (fetched[idx]?.data || []).map(p => {
            const mappedItem = {
              id: p._id || p.id,
              name: p.name,
              regularPrice: p.regularPrice ?? 0,
              specialPrice: p.specialPrice ?? null,
              image: (Array.isArray(p.images) && p.images[0]) || placeholder,
              // Use the actual fields from the API
              productType: p.productType || 'simple',
              variants: p.variants || [],
            };
            
            return mappedItem;
          });
          return { ...sec, products: items };
        });
        if (!mounted) return;
        setCategorySections(withProducts);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  const fetchSuggestions = useCallback(async (term) => {
    try {
      if (term.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
      setSuggestLoading(true);
      // Use public products endpoint with q filter
      const res = await api.getProductsPublic({ q: term, limit: 10 });
      const items = (res?.data || []).map(p => ({
        id: p._id || p.id,
        name: p.name,
        image: (Array.isArray(p.images) && p.images[0]) || placeholder,
      }));
      setSuggestions(items);
      setShowSuggestions(true);
    } catch (_) {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSuggestLoading(false);
    }
  }, []);

  const handleChangeQuery = (val) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val.trim()), 300);
  };

  const handleSelectSuggestion = async (item) => {
    await saveRecent(item.name);
    setShowSuggestions(false);
    navigation.navigate('ProductDetails', { productId: item.id });
  };

  // Helper function to get the correct price for cart
  const getCartPrice = (item) => {
    // Check if specialPrice exists and is not undefined/null (0 is a valid price)
    const price = (item.specialPrice !== null && item.specialPrice !== undefined) ? item.specialPrice : item.regularPrice;
    return price;
  };

  // Helper function to check if product is configurable
  const isConfigurableProduct = (item) => {
    // Dynamic detection based on actual product data
    // 1. Check if productType is explicitly set to 'configurable'
    if (item.productType === 'configurable') {
      return true;
    }
    
    // 2. Check if product has variants (which makes it configurable)
    if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
      return true;
    }
    
    // 3. Default to simple product
    return false;
  };

  // Helper function to handle product action (add to cart or navigate to details)
  const handleProductAction = (item) => {
    if (isConfigurableProduct(item)) {
      // Navigate to product details for configurable products
      navigation.navigate('ProductDetails', { productId: item.id || item._id });
    } else {
      // Add to cart directly for simple products
      const cartItem = { 
        _id: item.id || item._id, 
        id: item.id || item._id, 
        name: item.name,
        regularPrice: item.regularPrice, 
        specialPrice: item.specialPrice,
        price: getCartPrice(item),
        images: [item.image] 
      };
      addToCart(cartItem, 1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconWrapper}>
            <Icon name="arrow-back-outline" size={22} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Search Box with Animated Placeholder */}
        <View
          style={[styles.searchBoxWrapper, { position: 'relative' }]}
          onLayout={(e) => setSearchBoxHeight(e.nativeEvent.layout.height)}
        >
          <Icon name="search-outline" size={20} color="#999" style={styles.searchIcon} />
          <View style={styles.inputContainer}>
            <TextInput
              placeholder=""
              value={query}
              onChangeText={handleChangeQuery}
              style={styles.searchInput}
              autoFocus={false}
              returnKeyType="search"
              cursorColor="#333"
              selectionColor="#FFA726"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={() => {
                if (query.trim().length >= 2) {
                  saveRecent(query.trim());
                  navigation.navigate('ProductList', { title: `Results for \"${query.trim()}\"`, sectionName: undefined, categoryId: undefined });
                  setShowSuggestions(false);
                }
              }}
            />
            {(!isFocused && query.length === 0 && text) && (
              <Animated.Text
                style={[
                  styles.animatedPlaceholder,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity,
                  },
                ]}
                pointerEvents="none"
              >
                {text}
              </Animated.Text>
            )}
          </View>
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); }}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
            >
              <Icon name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('ProductList')}>
            <Icon name="options-outline" size={20} color="#555" />
          </TouchableOpacity>

          {/* Autocomplete Suggestions (overlay) */}
          {showSuggestions && (
            <View style={[styles.suggestionsContainer, { top: searchBoxHeight + 8 }] }>
              {suggestLoading ? (
                <Text style={{ padding: 12, color: '#666' }}>Searching...</Text>
              ) : suggestions.length === 0 ? (
                <Text style={{ padding: 12, color: '#666' }}>No matches</Text>
              ) : (
                <FlatList
                  data={suggestions}
                  keyExtractor={(it) => String(it.id)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.suggestionRow} onPress={() => handleSelectSuggestion(item)}>
                      <Image source={{ uri: item.image }} style={styles.suggestionImage} />
                      <Text style={styles.suggestionText} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" nestedScrollEnabled>

      {/* Recent Searches */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Searches</Text>
          <TouchableOpacity onPress={clearRecent}>
            <Icon name="trash-outline" size={20} color="#888" />
          </TouchableOpacity>
        </View>
        <View style={styles.chipsWrapper}>
          {recent.map((item, index) => (
            <View key={index} style={styles.chip}>
              <TouchableOpacity onPress={() => handleChangeQuery(item)}>
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeRecent(item)}>
                <Icon name="close" size={14} color="#999" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      {/* Category-wise Products (2nd level title, products from main category, 5 items, with See All) */}
      <View style={{ marginTop: 32, paddingBottom: 100 }}>
        {categorySections.map((section) => (
          <View key={section.parentId} style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ProductList', { title: section.parentTitle, categoryId: section.parentId })}>
                <Text style={{ color: '#FFA726', fontWeight: '500' }}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={section.products}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={styles.groceryCard}>
                  <TouchableOpacity onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}>
                    <Image source={{ uri: item.image }} style={styles.groceryImage} />
                    <Text style={styles.groceryName} numberOfLines={2}>{item.name}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    {item.specialPrice != null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#e53935' }}>₹{item.specialPrice}</Text>
                        <Text style={{ fontSize: 12, color: '#888', textDecorationLine: 'line-through' }}>₹{item.regularPrice}</Text>
                      </View>
                    ) : (
                      <Text style={styles.priceText}>₹{item.regularPrice}</Text>
                    )}
                    <TouchableOpacity
                      style={{ 
                        borderWidth: 1, 
                        borderColor: isConfigurableProduct(item) ? '#4CAF50' : '#FFA726', 
                        paddingVertical: 4, 
                        paddingHorizontal: 10, 
                        borderRadius: 6,
                        backgroundColor: isConfigurableProduct(item) ? '#4CAF50' : 'transparent'
                      }}
                      onPress={() => handleProductAction(item)}
                    >
                      <Text style={{ 
                        color: isConfigurableProduct(item) ? '#fff' : '#FFA726', 
                        fontWeight: '700', 
                        fontSize: 12 
                      }}>
                        {isConfigurableProduct(item) ? 'VIEW' : 'ADD'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        ))}
      </View>
      </ScrollView>
      
      {/* View Cart Footer */}
      <ViewCartFooter />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  header: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  iconWrapper: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 12,
    elevation: 2,
  },

  searchBoxWrapper: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  searchIcon: { 
    marginRight: 12,
    alignSelf: 'center',
  },
  searchInput: {
    fontSize: 18,
    color: '#111',
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  inputContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  suggestionsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    maxHeight: 280,
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  suggestionImage: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#eee'
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  animatedPlaceholder: {
    position: 'absolute',
    top: 10,
    left: 0,
    fontSize: 18,
    color: '#aaa',
    pointerEvents: 'none',
  },

  recentSection: { marginTop: 24 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTitle: { fontSize: 16, color: '#555', fontWeight: '600' },
  chipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 10,
  },
  chipText: { fontSize: 14, marginRight: 6, color: '#333' },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  groceryCard: {
    width: 140,
    marginRight: 16,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    padding: 8,
  },
  groceryImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  groceryWeight: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  groceryName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#444',
    marginLeft: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#4caf50',
    marginTop: 2,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 2,
  },
  addButton: {
    marginTop: 6,
    borderColor: '#4caf50',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 13,
    color: '#4caf50',
    fontWeight: '600',
  },
});

export default SearchScreen;
