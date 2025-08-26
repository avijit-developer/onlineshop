import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const FilterSummary = ({ filters, filterOptions, onRemoveFilter, onClearAll }) => {
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.priceRange[0] !== (filterOptions?.priceRange?.min || 0) || 
        filters.priceRange[1] !== (filterOptions?.priceRange?.max || 1000)) count++;
    if (filters.brands.length > 0) count++;
    if (filters.productType !== 'all') count++;
    if (filters.availability !== 'all') count++;
    if (filters.minRating > 0) count++;
    if (filters.sortBy !== 'newest') count++;
    return count;
  };

  const getFilterLabel = (key, value) => {
    switch (key) {
      case 'priceRange':
        return `₹${value[0]} - ₹${value[1]}`;
      case 'brands':
        if (value.length === 1) {
          const brand = filterOptions?.brands?.find(b => b.id === value[0]);
          return brand ? brand.name : 'Brand';
        }
        return `${value.length} Brands`;
      case 'productType':
        return value === 'simple' ? 'Simple Products' : 'Configurable Products';
      case 'availability':
        return value === 'in_stock' ? 'In Stock' : 'Out of Stock';
      case 'minRating':
        return `${value}+ Stars`;
      case 'sortBy':
        const sortLabels = {
          'newest': 'Newest First',
          'price_low': 'Price: Low to High',
          'price_high': 'Price: High to Low',
          'rating': 'Highest Rated',
          'name': 'Name: A to Z'
        };
        return sortLabels[value] || value;
      default:
        return String(value);
    }
  };

  const renderFilterChip = (key, value) => {
    if (!value || 
        (Array.isArray(value) && value.length === 0) ||
        (key === 'priceRange' && 
         value[0] === (filterOptions?.priceRange?.min || 0) && 
         value[1] === (filterOptions?.priceRange?.max || 1000)) ||
        (key === 'productType' && value === 'all') ||
        (key === 'availability' && value === 'all') ||
        (key === 'minRating' && value === 0) ||
        (key === 'sortBy' && value === 'newest')) {
      return null;
    }

    return (
      <View key={key} style={styles.filterChip}>
        <Text style={styles.filterChipText}>
          {getFilterLabel(key, value)}
        </Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemoveFilter(key)}
          activeOpacity={0.7}
        >
          <Icon name="close" size={16} color="#666" />
        </TouchableOpacity>
      </View>
    );
  };

  const activeFiltersCount = getActiveFiltersCount();
  
  if (activeFiltersCount === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Filters ({activeFiltersCount})</Text>
        <TouchableOpacity onPress={onClearAll} style={styles.clearAllButton}>
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {Object.entries(filters).map(([key, value]) => renderFilterChip(key, value))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  clearAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearAllText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  chipsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  removeButton: {
    padding: 2,
  },
});

export default FilterSummary;