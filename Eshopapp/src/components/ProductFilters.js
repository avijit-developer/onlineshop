import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');

const ProductFilters = ({ 
  visible, 
  onClose, 
  onApply, 
  filterOptions, 
  currentFilters = {},
  loading = false 
}) => {
  const [filters, setFilters] = useState({
    priceRange: [0, 1000],
    brands: [],
    productType: 'all',
    availability: 'all',
    minRating: 0,
    sortBy: 'newest'
  });
  
  const [expandedSections, setExpandedSections] = useState({
    price: true,
    brands: true,
    productType: true,
    availability: true,
    rating: true,
    sort: true
  });

  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    if (visible) {
      setFilters(currentFilters);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (filterOptions?.priceRange) {
      setFilters(prev => ({
        ...prev,
        priceRange: [filterOptions.priceRange.min, filterOptions.priceRange.max]
      }));
    }
  }, [filterOptions]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleBrand = (brandId) => {
    setFilters(prev => ({
      ...prev,
      brands: prev.brands.includes(brandId)
        ? prev.brands.filter(id => id !== brandId)
        : [...prev.brands, brandId]
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      priceRange: filterOptions?.priceRange ? [filterOptions.priceRange.min, filterOptions.priceRange.max] : [0, 1000],
      brands: [],
      productType: 'all',
      availability: 'all',
      minRating: 0,
      sortBy: 'newest'
    });
  };

  const applyFilters = () => {
    onApply(filters);
    onClose();
  };

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

  const renderSection = (title, section, children) => (
    <View style={styles.section}>
      <TouchableOpacity 
        style={styles.sectionHeader} 
        onPress={() => toggleSection(section)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Icon 
          name={expandedSections[section] ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#666" 
        />
      </TouchableOpacity>
      
      {expandedSections[section] && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );

  const renderPriceFilter = () => (
    <View style={styles.priceContainer}>
      <View style={styles.priceLabels}>
        <Text style={styles.priceLabel}>₹{Math.round(filters.priceRange[0])}</Text>
        <Text style={styles.priceLabel}>₹{Math.round(filters.priceRange[1])}</Text>
      </View>
      
      <View style={styles.sliderContainer}>
        {/* Background slider for visual track */}
        <Slider
          style={styles.backgroundSlider}
          minimumValue={filterOptions?.priceRange?.min || 0}
          maximumValue={filterOptions?.priceRange?.max || 1000}
          value={filterOptions?.priceRange?.max || 1000}
          enabled={false}
          minimumTrackTintColor="#E0E0E0"
          maximumTrackTintColor="#E0E0E0"
          trackStyle={styles.sliderTrack}
        />
        
        {/* Min value slider (left thumb) */}
        <Slider
          style={styles.minSlider}
          minimumValue={filterOptions?.priceRange?.min || 0}
          maximumValue={filters.priceRange[1]}
          value={filters.priceRange[0]}
          onValueChange={(value) => {
            const newMin = Math.round(value);
            updateFilter('priceRange', [newMin, filters.priceRange[1]]);
          }}
          minimumTrackTintColor="#007AFF"
          maximumTrackTintColor="transparent"
          thumbStyle={styles.sliderThumb}
          trackStyle={styles.sliderTrack}
        />
        
        {/* Max value slider (right thumb) */}
        <Slider
          style={styles.maxSlider}
          minimumValue={filters.priceRange[0]}
          maximumValue={filterOptions?.priceRange?.max || 1000}
          value={filters.priceRange[1]}
          onValueChange={(value) => {
            const newMax = Math.round(value);
            updateFilter('priceRange', [filters.priceRange[0], newMax]);
          }}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="#007AFF"
          thumbStyle={styles.sliderThumb}
          trackStyle={styles.sliderTrack}
        />
      </View>
      
      <View style={styles.priceRangeInfo}>
        <Text style={styles.priceRangeText}>
          Price range: ₹{Math.round(filterOptions?.priceRange?.min || 0)} - ₹{Math.round(filterOptions?.priceRange?.max || 1000)}
        </Text>
      </View>
    </View>
  );

  const renderBrandsFilter = () => (
    <View style={styles.brandsContainer}>
      {filterOptions?.brands?.length > 0 ? (
        filterOptions.brands.map((brand) => (
          <TouchableOpacity
            key={brand.id}
            style={[
              styles.brandChip,
              filters.brands.includes(brand.id) && styles.brandChipSelected
            ]}
            onPress={() => toggleBrand(brand.id)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.brandChipText,
              filters.brands.includes(brand.id) && styles.brandChipTextSelected
            ]}>
              {brand.name} ({brand.count})
            </Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.noOptionsText}>No brands available</Text>
      )}
    </View>
  );

  const renderProductTypeFilter = () => (
    <View style={styles.optionsContainer}>
      {filterOptions?.productTypes?.length > 0 ? (
        filterOptions.productTypes.map((type) => (
          <TouchableOpacity
            key={type.type}
            style={[
              styles.optionChip,
              filters.productType === type.type && styles.optionChipSelected
            ]}
            onPress={() => updateFilter('productType', type.type)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.optionChipText,
              filters.productType === type.type && styles.optionChipTextSelected
            ]}>
              {type.type === 'simple' ? 'Simple Products' : 'Configurable Products'} ({type.count})
            </Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.noOptionsText}>No product types available</Text>
      )}
    </View>
  );

  const renderAvailabilityFilter = () => (
    <View style={styles.optionsContainer}>
      {filterOptions?.availability?.map((status) => (
        <TouchableOpacity
          key={status.status}
          style={[
            styles.optionChip,
            filters.availability === status.status && styles.optionChipSelected
          ]}
          onPress={() => updateFilter('availability', status.status)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.optionChipText,
            filters.availability === status.status && styles.optionChipTextSelected
          ]}>
            {status.status === 'in_stock' ? 'In Stock' : 'Out of Stock'} ({status.count})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRatingFilter = () => (
    <View style={styles.optionsContainer}>
      {filterOptions?.ratings?.map((rating) => (
        <TouchableOpacity
          key={rating.range}
          style={[
            styles.optionChip,
            filters.minRating === parseFloat(rating.range.split('+')[0]) && styles.optionChipSelected
          ]}
          onPress={() => updateFilter('minRating', parseFloat(rating.range.split('+')[0]))}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.optionChipText,
            filters.minRating === parseFloat(rating.range.split('+')[0]) && styles.optionChipTextSelected
          ]}>
            {rating.range} ({rating.count})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSortOptions = () => (
    <View style={styles.optionsContainer}>
      {[
        { key: 'newest', label: 'Newest First' },
        { key: 'price_low', label: 'Price: Low to High' },
        { key: 'price_high', label: 'Price: High to Low' },
        { key: 'rating', label: 'Highest Rated' },
        { key: 'name', label: 'Name: A to Z' }
      ].map((option) => (
        <TouchableOpacity
          key={option.key}
          style={[
            styles.optionChip,
            filters.sortBy === option.key && styles.optionChipSelected
          ]}
          onPress={() => updateFilter('sortBy', option.key)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.optionChipText,
            filters.sortBy === option.key && styles.optionChipTextSelected
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ translateX: slideAnim }] }
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={clearAllFilters} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {renderSection('Price Range', 'price', renderPriceFilter())}
            {renderSection('Brands', 'brands', renderBrandsFilter())}
            {renderSection('Product Type', 'productType', renderProductTypeFilter())}
            {renderSection('Availability', 'availability', renderAvailabilityFilter())}
            {renderSection('Rating', 'rating', renderRatingFilter())}
            {renderSection('Sort By', 'sort', renderSortOptions())}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.applyButton} 
              onPress={applyFilters}
              disabled={loading}
            >
              <Text style={styles.applyButtonText}>
                Apply Filters {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: width * 0.85,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginRight: 15,
  },
  clearButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionContent: {
    marginTop: 10,
  },
  priceContainer: {
    marginTop: 10,
  },
  priceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sliderContainer: {
    position: 'relative',
    width: '100%',
    height: 40,
    marginBottom: 10,
  },
  backgroundSlider: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  minSlider: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  maxSlider: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  sliderThumb: {
    backgroundColor: '#007AFF',
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  priceRangeInfo: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  priceRangeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  brandsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  brandChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  brandChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  brandChipText: {
    fontSize: 14,
    color: '#666',
  },
  brandChipTextSelected: {
    color: 'white',
  },
  optionsContainer: {
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  optionChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionChipText: {
    fontSize: 14,
    color: '#666',
  },
  optionChipTextSelected: {
    color: 'white',
  },
  noOptionsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProductFilters;