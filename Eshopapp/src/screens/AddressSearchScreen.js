import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getCurrentLocation } from '../utils/locationUtils';

const AddressSearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const onSelectAddress = route?.params?.onSelect || null;
  const initialQuery = route?.params?.initialQuery || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    loadCurrentLocation();
    if (initialQuery.length >= 2) {
      performSearch(initialQuery);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const loadCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error loading current location:', error);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const performSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      console.log('🔍 Searching for:', query);
      
      const encodedQuery = encodeURIComponent(query);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=10&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EshopApp/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Search results count:', data?.length || 0);
        
        if (Array.isArray(data) && data.length > 0) {
          // Filter only India addresses
          const indiaResults = data.filter(result => {
            const country = result.address?.country || result.address?.country_code?.toUpperCase() || '';
            const displayName = (result.display_name || '').toLowerCase();
            return country === 'India' || country === 'IN' || displayName.includes('india');
          });
          
          console.log('✅ India results count:', indiaResults.length);
          setSearchResults(indiaResults);
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result) => {
    console.log('📍 Address selected in AddressSearchScreen:', result);
    const location = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };

    const addressData = {
      display_name: result.display_name,
      location: location,
      address: result.address || {},
    };

    console.log('📤 Calling onSelectAddress callback with:', addressData);
    if (onSelectAddress) {
      onSelectAddress(addressData);
    } else {
      console.warn('⚠️ onSelectAddress callback is not provided');
    }
    console.log('🔙 Navigating back...');
    navigation.goBack();
  };

  const getDistanceFromCurrent = (result) => {
    if (!currentLocation || !result.lat || !result.lon) return null;
    return calculateDistance(
      parseFloat(result.lat),
      parseFloat(result.lon),
      currentLocation.latitude,
      currentLocation.longitude
    );
  };

  const formatDistance = (distance) => {
    if (distance === null || distance === undefined) return '';
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    } else if (distance < 100) {
      return `${Math.round(distance)} km`;
    } else {
      return `${Math.round(distance)} km`;
    }
  };

  const renderResultItem = ({ item }) => {
    const distance = getDistanceFromCurrent(item);
    const distanceText = formatDistance(distance);

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleSelectResult(item)}
        activeOpacity={0.7}
      >
        <Icon name="location-outline" size={24} color="#666" style={styles.resultIcon} />
        <View style={styles.resultContent}>
          {distanceText ? (
            <Text style={styles.resultDistance}>{distanceText}</Text>
          ) : null}
          <Text style={styles.resultName} numberOfLines={2}>
            {item.display_name || 'Unknown location'}
          </Text>
          {item.address && (
            <Text style={styles.resultAddress} numberOfLines={1}>
              {[item.address.city, item.address.state, item.address.country].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Icon name="search-outline" size={20} color="#d32f2f" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for area, street name..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results */}
      {searching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#d32f2f" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!searching && searchQuery.length < 2 && (
        <View style={styles.emptyContainer}>
          <Icon name="search-outline" size={60} color="#ddd" />
          <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
        </View>
      )}

      {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
        <View style={styles.emptyContainer}>
          <Icon name="location-outline" size={60} color="#ddd" />
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      )}

      {!searching && searchResults.length > 0 && (
        <FlatList
          data={searchResults}
          renderItem={renderResultItem}
          keyExtractor={(item, index) => `result-${index}-${item.place_id || index}`}
          style={styles.resultsList}
          contentContainerStyle={styles.resultsListContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingBottom: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  resultIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  resultContent: {
    flex: 1,
  },
  resultDistance: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  resultAddress: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
});

export default AddressSearchScreen;


