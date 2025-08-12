import React, { useEffect, useRef, useState } from 'react';
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
import ViewCartFooter from '../components/ViewCartFooter';

const recentSearches = ['Sunglasses', 'Sweater', 'Hoodie'];
const rotatingTexts = [
  'Search fresh milk...',
  'Find snacks & chips...',
  'Try yogurt or curd...',
  'Explore chocolates...',
  'Search grocery items...',
];

const categorizedProducts = [
  {
    id: 'chips',
    title: 'Chips & Crisps',
    products: [
      {
        id: 'lays1',
        name: "Lay's India's Magic Masala Potato Chips",
        price: '₹30',
        weight: '67 g',
        rating: '4.5',
        reviews: '51,962',
        time: '8 MINS',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
      {
        id: 'lays2',
        name: "Lay's West Indies Hot n Sweet Chilli",
        price: '₹20',
        weight: '48 g',
        rating: '4.6',
        reviews: '1,31,284',
        time: '8 MINS',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
      {
        id: 'kurkure',
        name: 'Kurkure Masala Munch Crisps',
        price: '₹20',
        weight: '75 g',
        rating: '4.4',
        reviews: '1,78,346',
        time: '8 MINS',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
    ],
  },
  {
    id: 'curd',
    title: 'Curd & Yogurt',
    products: [
      {
        id: 'curd1',
        name: 'Amul Masti Pouch Curd',
        price: '₹20',
        weight: '200 g',
        rating: '4.4',
        reviews: '14,436',
        time: '8 MINS',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
      {
        id: 'curd2',
        name: 'Mother Dairy Classic Cup Curd',
        price: '₹50',
        weight: '400 g',
        rating: '4.6',
        reviews: '38,346',
        time: '8 MINS',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
      {
        id: 'doi',
        name: 'Mother Dairy Mishti Doi',
        price: '₹15',
        weight: '80 g',
        rating: '4.5',
        reviews: '39,182',
        time: '8 MINS',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
    ],
  },
];

const SearchScreen = () => {
  const navigation = useNavigation();

  const [index, setIndex] = useState(0);
  const [text, setText] = useState(rotatingTexts[0]);
  const slideAnim = useRef(new Animated.Value(20)).current; // slide from right
  const opacity = useRef(new Animated.Value(0)).current;

 useEffect(() => {
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
}, [index]);

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
            placeholder=""
            editable={false}
            style={styles.searchInput}
          />
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
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ProductList')}>
          <Icon name="options-outline" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Recent Searches */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Searches</Text>
          <TouchableOpacity>
            <Icon name="trash-outline" size={20} color="#888" />
          </TouchableOpacity>
        </View>
        <View style={styles.chipsWrapper}>
          {recentSearches.map((item, index) => (
            <View key={index} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
              <TouchableOpacity>
                <Icon name="close" size={14} color="#999" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      {/* Category-wise Products */}
      <View style={{ marginTop: 32 }}>
        {categorizedProducts.map((section) => (
          <View key={section.id} style={{ marginBottom: 32 }}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <FlatList
              data={section.products}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.groceryCard}>
                  <Image source={{ uri: item.image }} style={styles.groceryImage} />
                  <Text style={styles.groceryWeight}>{item.weight}</Text>
                  <Text style={styles.groceryName} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.ratingRow}>
                    <Icon name="star" size={14} color="#f9a825" />
                    <Text style={styles.ratingText}>
                      {item.rating} ({item.reviews})
                    </Text>
                  </View>
                  <Text style={styles.timeText}>{item.time}</Text>
                  <Text style={styles.priceText}>{item.price}</Text>
                  <TouchableOpacity style={styles.addButton}>
                    <Text style={styles.addButtonText}>ADD</Text>
                  </TouchableOpacity>
                </View>
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
