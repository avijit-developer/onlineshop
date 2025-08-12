import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const FilterScreen = ({ navigation, route }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 200]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [onSale, setOnSale] = useState(false);
  const [freeShipping, setFreeShipping] = useState(false);

  const categories = ['Dresses', 'Tops', 'Bottoms', 'Shoes', 'Accessories', 'Bags'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const colors = [
    { name: 'Black', color: '#000000' },
    { name: 'White', color: '#FFFFFF' },
    { name: 'Red', color: '#FF0000' },
    { name: 'Blue', color: '#0000FF' },
    { name: 'Green', color: '#008000' },
    { name: 'Pink', color: '#FFC0CB' },
    { name: 'Yellow', color: '#FFFF00' },
    { name: 'Purple', color: '#800080' },
  ];

  const priceRanges = [
    { label: 'Under $25', min: 0, max: 25 },
    { label: '$25 - $50', min: 25, max: 50 },
    { label: '$50 - $100', min: 50, max: 100 },
    { label: '$100 - $200', min: 100, max: 200 },
    { label: 'Over $200', min: 200, max: 1000 },
  ];

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleSize = (size) => {
    setSelectedSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const toggleColor = (color) => {
    setSelectedColors(prev =>
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const selectPriceRange = (range) => {
    setPriceRange([range.min, range.max]);
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, 200]);
    setSelectedRating(0);
    setSelectedSizes([]);
    setSelectedColors([]);
    setOnSale(false);
    setFreeShipping(false);
  };

  const applyFilters = () => {
    const filters = {
      categories: selectedCategories,
      priceRange,
      rating: selectedRating,
      sizes: selectedSizes,
      colors: selectedColors,
      onSale,
      freeShipping,
    };
    
    // Pass filters back to ProductList screen
    if (route.params?.onApplyFilters) {
      route.params.onApplyFilters(filters);
    }
    
    navigation.goBack();
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <TouchableOpacity
        key={index}
        onPress={() => setSelectedRating(index + 1)}
      >
        <Icon
          name={index < rating ? 'star' : 'star-outline'}
          size={20}
          color={index < rating ? '#f7ab18' : '#ddd'}
          style={{ marginRight: 4 }}
        />
      </TouchableOpacity>
    ));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Filters</Text>
        <TouchableOpacity onPress={clearAllFilters}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.optionsGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategories.includes(category) && styles.selectedChip
                ]}
                onPress={() => toggleCategory(category)}
              >
                <Text style={[
                  styles.chipText,
                  selectedCategories.includes(category) && styles.selectedChipText
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Price Range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Range</Text>
          <View style={styles.priceGrid}>
            {priceRanges.map((range, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.priceChip,
                  priceRange[0] === range.min && priceRange[1] === range.max && styles.selectedChip
                ]}
                onPress={() => selectPriceRange(range)}
              >
                <Text style={[
                  styles.chipText,
                  priceRange[0] === range.min && priceRange[1] === range.max && styles.selectedChipText
                ]}>
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minimum Rating</Text>
          <View style={styles.ratingContainer}>
            {renderStars(selectedRating)}
            <Text style={styles.ratingText}>
              {selectedRating > 0 ? `${selectedRating} stars & up` : 'Any rating'}
            </Text>
          </View>
        </View>

        {/* Sizes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sizes</Text>
          <View style={styles.optionsGrid}>
            {sizes.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeChip,
                  selectedSizes.includes(size) && styles.selectedChip
                ]}
                onPress={() => toggleSize(size)}
              >
                <Text style={[
                  styles.chipText,
                  selectedSizes.includes(size) && styles.selectedChipText
                ]}>
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Colors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colors</Text>
          <View style={styles.colorGrid}>
            {colors.map((colorItem) => (
              <TouchableOpacity
                key={colorItem.name}
                style={[
                  styles.colorChip,
                  { backgroundColor: colorItem.color },
                  selectedColors.includes(colorItem.name) && styles.selectedColorChip
                ]}
                onPress={() => toggleColor(colorItem.name)}
              >
                {selectedColors.includes(colorItem.name) && (
                  <Icon name="checkmark" size={16} color={colorItem.color === '#FFFFFF' ? '#333' : '#fff'} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Special Offers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Offers</Text>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>On Sale</Text>
            <Switch
              value={onSale}
              onValueChange={setOnSale}
              trackColor={{ false: '#ddd', true: '#f7ab18' }}
              thumbColor={onSale ? '#fff' : '#f4f3f4'}
            />
          </View>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Free Shipping</Text>
            <Switch
              value={freeShipping}
              onValueChange={setFreeShipping}
              trackColor={{ false: '#ddd', true: '#f7ab18' }}
              thumbColor={freeShipping ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
      </ScrollView>

      {/* Apply Button */}
      <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
        <Text style={styles.applyButtonText}>Apply Filters</Text>
      </TouchableOpacity>
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
  clearText: {
    fontSize: 16,
    color: '#f7ab18',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  priceGrid: {
    gap: 8,
  },
  priceChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  sizeChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 50,
    alignItems: 'center',
  },
  selectedChip: {
    backgroundColor: '#f7ab18',
    borderColor: '#f7ab18',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedChipText: {
    color: '#fff',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorChip: {
    borderColor: '#f7ab18',
    borderWidth: 3,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#f7ab18',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default FilterScreen;