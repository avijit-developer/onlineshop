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

const RECENT_KEY = 'recentSearchesV1';
const rotatingTexts = [
  'Search fresh milk...',
  'Find snacks & chips...',
  'Try yogurt or curd...',
  'Explore chocolates...',
  'Search grocery items...',
];

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
      const nextIndex = (index + 1) % rotatingTexts.length;
      setText(rotatingTexts[nextIndex]);
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
}, [index, isFocused, query]);

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
        // Fetch 5 products for each parent
        const fetched = await Promise.all(built.map(sec => api.getProductsPublic({ category: sec.parentId, page: 1, limit: 5 })));
        const withProducts = built.map((sec, idx) => {
          const items = (fetched[idx]?.data || []).map(p => ({
            id: p._id || p.id,
            name: p.name,
            price: '₹' + (p.specialPrice ?? p.regularPrice ?? 0),
            image: (Array.isArray(p.images) && p.images[0]) || placeholder,
          }));
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconWrapper}>
          <Icon name="arrow-back-outline" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Search Box with Animated Placeholder */}
      <View style={styles.searchBoxWrapper}>
        <Icon name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <View style={{ flex: 1 }}>
          <TextInput
            placeholder="Search products"
            value={query}
            onChangeText={handleChangeQuery}
            style={styles.searchInput}
            autoFocus={false}
            returnKeyType="search"
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
          {(!isFocused && query.length === 0) && (
          <Animated.Text
  style={[
    styles.animatedPlaceholder,
    {
      transform: [{ translateY: slideAnim }],
      opacity,
    },
  ]}
>
  {text}
</Animated.Text>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ProductList')}>
          <Icon name="options-outline" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Autocomplete Suggestions */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {suggestLoading ? (
            <Text style={{ padding: 12, color: '#666' }}>Searching...</Text>
          ) : suggestions.length === 0 ? (
            <Text style={{ padding: 12, color: '#666' }}>No matches</Text>
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(it) => String(it.id)}
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
      <View style={{ marginTop: 32 }}>
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
                <TouchableOpacity style={styles.groceryCard} onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}>
                  <Image source={{ uri: item.image }} style={styles.groceryImage} />
                  <Text style={styles.groceryName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.priceText}>{item.price}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ))}
      </View>
    </ScrollView>
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
    paddingVertical: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    fontSize: 16,
    color: '#333',
    height: 24,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: 8,
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
  animatedPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: 16,
    color: '#aaa',
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
