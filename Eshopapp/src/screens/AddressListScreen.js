import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAddress } from '../contexts/AddressContext';
import { useLocation } from '../contexts/LocationContext';
import { getCurrentLocation } from '../utils/locationUtils';
import { reverseGeocode } from '../utils/locationUtils';

const AddressListScreen = ({ route }) => {
  const navigation = useNavigation();
  const { addresses, deleteAddress, setDefaultAddress, forceRefreshFromAPI } = useAddress();
  const { updateAddress: updateHeaderAddress, loadUserDefaultAddress, location: currentLocation } = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocationAddress, setCurrentLocationAddress] = useState(null);
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);
  
  const isSelecting = route.params?.isSelecting || false;
  const returnTo = route.params?.returnTo || null;

  useEffect(() => {
    loadCurrentLocationAddress();
  }, []);

  const loadCurrentLocationAddress = async () => {
    try {
      setLoadingCurrentLocation(true);
      const location = await getCurrentLocation();
      if (location) {
        const geoData = await reverseGeocode(location.latitude, location.longitude);
        if (geoData) {
          const address = typeof geoData === 'string' 
            ? geoData 
            : geoData.display || `${geoData.area || ''}, ${geoData.city || ''}`.trim();
          setCurrentLocationAddress({
            location,
            address,
            city: geoData.city || '',
            state: geoData.state || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading current location:', error);
    } finally {
      setLoadingCurrentLocation(false);
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
    return R * c; // Distance in kilometers
  };

  const getDistanceFromCurrent = (address) => {
    if (!currentLocationAddress || !address.location?.coordinates) return null;
    const addressLat = address.location.coordinates[1];
    const addressLon = address.location.coordinates[0];
    const currentLat = currentLocationAddress.location.latitude;
    const currentLon = currentLocationAddress.location.longitude;
    return calculateDistance(addressLat, addressLon, currentLat, currentLon);
  };

  const formatDistance = (distance) => {
    if (distance === null || distance === undefined) return '';
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    } else if (distance < 100) {
      return `${distance.toFixed(1)} km`;
    } else {
      return `${Math.round(distance)} km`;
    }
  };

  const handleAddAddress = () => {
    navigation.navigate('AddressMap', {
      onSave: (addressData) => {
        // Address will be saved by AddressMapScreen
      }
    });
  };

  const handleUseCurrentLocation = async () => {
    if (!currentLocationAddress) {
      await loadCurrentLocationAddress();
    }
    if (currentLocationAddress) {
      navigation.navigate('AddressMap', {
        initialLocation: currentLocationAddress.location,
        onSave: (addressData) => {
          // Address will be saved by AddressMapScreen
        }
      });
    }
  };

  const handleSelectAddress = async (address) => {
    try {
      // Ensure default address is set on click
      if (!address.isDefault) {
        if (!address._originalId) {
          try {
            const refreshed = await forceRefreshFromAPI();
            const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const sig = `${norm(address.address)}|${norm(address.city)}|${norm(address.state)}|${norm(address.zipCode || address.postalCode)}|${norm(address.phone)}`;
            const match = Array.isArray(refreshed) ? refreshed.find(a => `${norm(a.address)}|${norm(a.city)}|${norm(a.state)}|${norm(a.zipCode || a.postalCode)}|${norm(a.phone)}` === sig) : null;
            if (match) {
              await setDefaultAddress(match.id);
            }
          } catch (e) {
            console.log('Refresh failed while setting default:', e);
          }
        } else {
          await setDefaultAddress(address.id);
        }
      }

      // Update header immediately with full address details
      updateHeaderAddress({
        address: address.address || '',
        city: address.city || '',
        area: address.area || '',
        postalCode: address.zipCode || address.postalCode || '',
        location: address.location ? {
          latitude: address.location.coordinates?.[1] || address.location.latitude,
          longitude: address.location.coordinates?.[0] || address.location.longitude,
        } : null,
      });
      // Also reload from API to ensure consistency
      loadUserDefaultAddress();

      // Navigate based on intent
      if (returnTo) {
        navigation.goBack();
      } else if (isSelecting) {
        navigation.goBack();
      } else {
        navigation.navigate('Checkout', { selectedAddress: address });
      }
    } catch (error) {
      console.log('Error in handleSelectAddress:', error);
      Alert.alert('Error', error.message || 'Failed to set address as default. Please try again.');
    }
  };

  const handleDeleteAddress = (address) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete this address?\n\n${address.address}, ${address.city}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => deleteAddress(address.id)
        }
      ]
    );
  };

  const getLabelIcon = (label) => {
    switch (label?.toLowerCase()) {
      case 'home':
        return 'home-outline';
      case 'work':
        return 'briefcase-outline';
      default:
        return 'location-outline';
    }
  };

  const filteredAddresses = addresses.filter(addr => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (addr.address || '').toLowerCase().includes(query) ||
      (addr.city || '').toLowerCase().includes(query) ||
      (addr.label || '').toLowerCase().includes(query)
    );
  });

  const renderActionOption = ({ icon, title, subtitle, onPress, iconColor = '#f7ab18' }) => (
    <TouchableOpacity style={styles.actionOption} onPress={onPress}>
      <Icon name={icon} size={24} color={iconColor} style={styles.actionIcon} />
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        {subtitle && <Text style={styles.actionSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <Icon name="chevron-forward-outline" size={20} color="#999" />
    </TouchableOpacity>
  );

  const renderAddressItem = ({ item }) => {
    const distance = getDistanceFromCurrent(item);
    const distanceText = formatDistance(distance);

    return (
      <TouchableOpacity 
        style={styles.addressItem}
        onPress={() => handleSelectAddress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.addressIconContainer}>
          <Icon 
            name={getLabelIcon(item.label)} 
            size={24} 
            color="#666" 
          />
          {distanceText ? (
            <Text style={styles.distanceText}>{distanceText}</Text>
          ) : null}
        </View>
        
        <View style={styles.addressContent}>
          <Text style={styles.addressLabel}>{item.label || 'Address'}</Text>
          <Text style={styles.addressText}>
            {[item.address, item.city, item.state].filter(Boolean).join(', ')}
          </Text>
          <Text style={styles.phoneText}>Phone number: +91-{item.phone || 'N/A'}</Text>
        </View>

        <View style={styles.addressActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert(
                'Address Options',
                '',
                [
                  { text: 'Edit', onPress: () => handleEditAddress(item) },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDeleteAddress(item) },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
          >
            <Icon name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleSelectAddress(item);
            }}
          >
            <Icon name="arrow-forward-circle" size={24} color="#f7ab18" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const handleEditAddress = (address) => {
    navigation.navigate('AddressMap', {
      address: address,
      onSave: (addressData) => {
        // Address will be updated by AddressMapScreen
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select a location</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Icon name="ellipsis-vertical-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={20} color="#f7ab18" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for area, street name..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Action Options */}
      <View style={styles.actionOptionsContainer}>
        {renderActionOption({
          icon: 'locate-outline',
          title: 'Use current location',
          subtitle: currentLocationAddress?.address || 'Getting location...',
          onPress: handleUseCurrentLocation,
        })}
        
        {renderActionOption({
          icon: 'add-circle-outline',
          title: 'Add Address',
          subtitle: null,
          onPress: handleAddAddress,
        })}
      </View>

      {/* Saved Addresses Section */}
      {filteredAddresses.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SAVED ADDRESSES</Text>
          </View>
          <FlatList
            data={filteredAddresses.sort((a, b) => {
              if (a.isDefault && !b.isDefault) return -1;
              if (!a.isDefault && b.isDefault) return 1;
              return 0;
            })}
            renderItem={renderAddressItem}
            keyExtractor={(item) => item.id}
            style={styles.addressList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.addressListContent}
          />
        </>
      )}

      {filteredAddresses.length === 0 && searchQuery && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No addresses found</Text>
        </View>
      )}

      {filteredAddresses.length === 0 && !searchQuery && (
        <View style={styles.emptyContainer}>
          <Icon name="location-outline" size={80} color="#ddd" />
          <Text style={styles.emptyTitle}>No addresses yet</Text>
          <Text style={styles.emptySubtitle}>Add your first shipping address to get started</Text>
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  moreButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
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
  actionOptionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  actionIcon: {
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f7ab18',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
  },
  addressList: {
    flex: 1,
  },
  addressListContent: {
    paddingBottom: 16,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressIconContainer: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 50,
  },
  distanceText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  phoneText: {
    fontSize: 13,
    color: '#999',
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default AddressListScreen;
