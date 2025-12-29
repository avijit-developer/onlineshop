import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCurrentLocation, reverseGeocode } from '../utils/locationUtils';
import { useAddress } from '../contexts/AddressContext';

const AddressMapScreen = ({ navigation, route }) => {
  const existingAddress = route?.params?.address || null;
  const onSaveAddress = route?.params?.onSave || null;
  const { addAddress, updateAddress } = useAddress();

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [addressDetails, setAddressDetails] = useState({
    address: existingAddress?.address || '',
    road: existingAddress?.road || '',
    locality: existingAddress?.locality || '',
    area: existingAddress?.area || '',
    city: existingAddress?.city || '',
    state: existingAddress?.state || '',
    zipCode: existingAddress?.zipCode || '',
    country: existingAddress?.country || 'India',
    fullAddress: existingAddress?.fullAddress || 
      (existingAddress ? [existingAddress.road, existingAddress.locality, existingAddress.area, existingAddress.city].filter(Boolean).join(', ') : '') || '',
  });
  const [receiverName, setReceiverName] = useState(existingAddress?.name || existingAddress?.firstName || '');
  const [receiverPhone, setReceiverPhone] = useState(existingAddress?.phone || '');
  const [addressLabel, setAddressLabel] = useState(existingAddress?.label || 'Home');
  const [distanceFromCurrent, setDistanceFromCurrent] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const scrollViewRef = useRef(null);
  const webViewRef = useRef(null);

  useEffect(() => {
    initializeLocation();
  }, []);

  // Real-time search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // Don't search for very short queries
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search - wait 500ms after user stops typing
    const searchTimeout = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  // Real-time search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // Don't search for very short queries
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search - wait 500ms after user stops typing
    const searchTimeout = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  // Debug: Log when address changes
  useEffect(() => {
    console.log('Address details updated:', addressDetails);
  }, [addressDetails]);

  const initializeLocation = async () => {
    try {
      setLoading(true);
      let location = null;

      // Try to get current location
      try {
        location = await getCurrentLocation();
        setCurrentLocation(location);
      } catch (error) {
        console.error('Error getting current location:', error);
        // Use default location (Bishnupur)
        location = { latitude: 23.0732, longitude: 87.3199 };
        setCurrentLocation(location);
      }

      // If editing existing address, use its location
      if (existingAddress?.location?.coordinates) {
        location = {
          latitude: existingAddress.location.coordinates[1],
          longitude: existingAddress.location.coordinates[0],
        };
        setAddressDetails({
          address: existingAddress.address || '', // Load existing address (floor/house number)
          road: existingAddress.road || '',
          locality: existingAddress.locality || '',
          area: existingAddress.area || '',
          city: existingAddress.city || '',
          state: existingAddress.state || '',
          zipCode: existingAddress.zipCode || '',
          country: existingAddress.country || 'India',
          fullAddress: existingAddress.fullAddress || 
            [existingAddress.road, existingAddress.locality, existingAddress.area, existingAddress.city].filter(Boolean).join(', ') || '',
        });
      }

      setSelectedLocation(location);
      // When editing existing address, preserve the address field (floor/house number)
      await loadAddressFromLocation(location, true);
    } catch (error) {
      console.error('Error initializing location:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAddressFromLocation = async (location, preserveAddress = false) => {
    if (!location) return;
    
    try {
      setLoadingAddress(true);
      const geoData = await reverseGeocode(location.latitude, location.longitude);
      
      if (geoData) {
        setAddressDetails(prev => {
          // Always preserve user's entered address (floor/house no) if it exists
          // If user hasn't entered anything, keep it empty
          // Update all address components from reverse geocoding for detailed display
          // Never auto-fill the address field - user must enter floor/house number manually
          // Preserve address field if preserveAddress is true or if editing existing address
          const shouldPreserveAddress = preserveAddress || existingAddress;
          const currentAddress = shouldPreserveAddress ? (prev.address || existingAddress?.address || '') : (prev.address || '');
          
          // Build full address for display
          const parts = [];
          if (geoData.road) parts.push(geoData.road);
          if (geoData.locality) parts.push(geoData.locality);
          if (geoData.area) parts.push(geoData.area);
          if (geoData.city) parts.push(geoData.city);
          if (geoData.state) parts.push(geoData.state);
          if (geoData.postalCode) parts.push(geoData.postalCode);
          const fullAddress = geoData.fullAddress || geoData.display || parts.join(', ') || '';
          
          // Update map popup with address
          if (webViewRef.current) {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'updateAddress',
              address: fullAddress || 'Address not available'
            }));
          }
          
          return {
            address: currentAddress, // Preserve existing address when editing
            road: geoData.road || prev.road || '',
            locality: geoData.locality || prev.locality || '',
            area: geoData.area || prev.area || '',
            city: geoData.city || prev.city || '',
            state: geoData.state || prev.state || '',
            zipCode: geoData.postalCode || prev.zipCode || '',
            country: geoData.country || prev.country || 'India',
            fullAddress: fullAddress || prev.fullAddress || '',
          };
        });
      }

      // Calculate distance from current location
      if (currentLocation) {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          currentLocation.latitude,
          currentLocation.longitude
        );
        setDistanceFromCurrent(distance);
      }
    } catch (error) {
      console.error('Error loading address:', error);
    } finally {
      setLoadingAddress(false);
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

  const performSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      console.log('🔍 Searching for:', query);
      
      const encodedQuery = encodeURIComponent(query);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=10&addressdetails=1&countrycodes=in`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EshopApp/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
          // Filter only India addresses
          const indiaResults = data.filter(result => {
            const country = result.address?.country || result.address?.country_code?.toUpperCase() || '';
            const displayName = (result.display_name || '').toLowerCase();
            return country === 'India' || country === 'IN' || displayName.includes('india');
          });
          
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

  const handleSearch = () => {
    performSearch(searchQuery.trim());
  };

  const handleSearchResultSelect = async (result) => {
    const location = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
    setSelectedLocation(location);
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setShowSearchPopup(false);
    
    // Update map - move marker to selected location
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'setLocation',
        latitude: location.latitude,
        longitude: location.longitude,
      }));
    }
    
    // Don't auto-populate address field - user will enter floor/house number manually
    // When selecting from suggestion, always clear address field (house/flat number)
    // Only update city, state, zipCode, country from reverse geocoding
    try {
      const geoData = await reverseGeocode(location.latitude, location.longitude);
      if (geoData) {
        setAddressDetails(prev => ({
          address: '', // Always clear address field when selecting from suggestion - user must enter house/flat number
          road: geoData.road || prev.road || '',
          locality: geoData.locality || prev.locality || '',
          area: geoData.area || prev.area || '',
          city: geoData.city || prev.city || '',
          state: geoData.state || prev.state || '',
          zipCode: geoData.postalCode || prev.zipCode || '',
          country: geoData.country || prev.country || 'India',
          fullAddress: geoData.fullAddress || geoData.display || prev.fullAddress || '',
        }));
      }
    } catch (error) {
      console.error('Error loading address details:', error);
    }
    
    // Calculate distance from current location
    if (currentLocation) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        currentLocation.latitude,
        currentLocation.longitude
      );
      setDistanceFromCurrent(distance);
    }
  };

  const handleMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected') {
        const location = {
          latitude: data.latitude,
          longitude: data.longitude,
        };
        setSelectedLocation(location);
        // When pin is moved on map, update city/state/zipCode but preserve user's entered address
        // User will enter floor/house number manually - don't auto-fill address field
        loadAddressFromLocation(location, true);
      } else if (data.type === 'mapReady') {
        setLoading(false);
        // Only set initial location on first mapReady, not after user interactions
        // Use a ref to track if we've already set the initial location
        if (selectedLocation && webViewRef.current && !webViewRef.current._initialLocationSet) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'setLocation',
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
          }));
          webViewRef.current._initialLocationSet = true;
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };


  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setSelectedLocation(location);
        
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'setLocation',
            latitude: location.latitude,
            longitude: location.longitude,
          }));
        }
        
        await loadAddressFromLocation(location);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your current location');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!addressDetails.address.trim()) {
      Alert.alert('Error', 'Please enter address details');
      return;
    }
    if (!receiverName.trim()) {
      Alert.alert('Error', 'Please enter receiver name');
      return;
    }
    if (!receiverPhone.trim()) {
      Alert.alert('Error', 'Please enter receiver phone');
      return;
    }

    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location on the map');
      return;
    }

    try {
      const addressData = {
        label: addressLabel,
        firstName: receiverName.split(' ')[0] || receiverName,
        lastName: receiverName.split(' ').slice(1).join(' ') || '',
        name: receiverName,
        phone: receiverPhone,
        address: addressDetails.address,
        road: addressDetails.road,
        locality: addressDetails.locality,
        area: addressDetails.area,
        city: addressDetails.city,
        state: addressDetails.state,
        zipCode: addressDetails.zipCode,
        country: addressDetails.country,
        fullAddress: addressDetails.fullAddress,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        location: {
          type: 'Point',
          coordinates: [selectedLocation.longitude, selectedLocation.latitude]
        },
      };

      if (existingAddress) {
        await updateAddress(existingAddress.id, addressData);
        Alert.alert('Success', 'Address updated successfully!');
      } else {
        await addAddress(addressData);
        Alert.alert('Success', 'Address added successfully!');
      }

      if (onSaveAddress) {
        onSaveAddress(addressData);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save address. Please try again.');
    }
  };

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body, html { width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100%; touch-action: pan-x pan-y pinch-zoom; }
        .custom-marker {
          background-color: #d32f2f;
          width: 40px;
          height: 40px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 4px solid #fff;
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          position: relative;
          transition: transform 0.2s ease;
          touch-action: none !important;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          cursor: move;
        }
        .leaflet-marker-icon {
          touch-action: none !important;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
        .custom-marker::after {
          content: '';
          width: 14px;
          height: 14px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          padding: 8px;
        }
        .leaflet-popup-content {
          margin: 8px 12px;
          font-size: 14px;
          line-height: 1.4;
        }
        .custom-tooltip {
          background-color: rgba(0, 0, 0, 0.85) !important;
          color: white !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
          font-size: 12px !important;
          white-space: nowrap !important;
          max-width: 200px !important;
          pointer-events: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }
        .leaflet-tooltip-top.custom-tooltip::before {
          border-top-color: rgba(0, 0, 0, 0.85) !important;
        }
        .leaflet-tooltip-bottom.custom-tooltip::before {
          border-bottom-color: rgba(0, 0, 0, 0.85) !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        let map, marker;
        let currentLat = ${selectedLocation?.latitude || currentLocation?.latitude || 23.0732};
        let currentLon = ${selectedLocation?.longitude || currentLocation?.longitude || 87.3199};
        let currentAddress = '${(addressDetails.fullAddress || searchQuery || [addressDetails.road, addressDetails.locality, addressDetails.area, addressDetails.city].filter(Boolean).join(', ') || 'Loading address...').replace(/'/g, "\\'")}';
        
        // Initialize map with zoom controls enabled
        map = L.map('map', {
          center: [currentLat, currentLon],
          zoom: 16,
          zoomControl: true,        // Show zoom controls
          touchZoom: true,          // Enable pinch-to-zoom on touch devices
          doubleClickZoom: true,   // Enable double-click to zoom
          scrollWheelZoom: true,    // Enable scroll wheel zoom
          dragging: true,           // Enable map dragging
          boxZoom: true,            // Enable box zoom
          keyboard: true,           // Enable keyboard navigation
          tap: true,                // Enable tap events
          tapTolerance: 15,         // Tap tolerance in pixels
          inertia: true,            // Enable smooth panning with inertia
          inertiaDeceleration: 3000, // Inertia deceleration
          inertiaMaxSpeed: 1500     // Max speed for inertia
        });
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 3
        }).addTo(map);
        
        // Create custom red pin icon
        const customIcon = L.divIcon({
          className: 'custom-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        });
        
        // Add marker with smooth movement
        marker = L.marker([currentLat, currentLon], { 
          icon: customIcon,
          draggable: true,
          autoPan: false,           // Disable auto pan to prevent jumping
          riseOnHover: true,        // Lift marker on hover for better UX
          zIndexOffset: 1000        // Ensure marker is on top
        }).addTo(map);
        
        // Ensure marker can be dragged in all directions
        marker.dragging.enable();
        
        // Force enable dragging after marker is added
        map.whenReady(function() {
          // Ensure marker element has proper touch handling
          const markerElement = marker.getElement();
          if (markerElement) {
            markerElement.style.touchAction = 'none';
            markerElement.style.webkitTouchCallout = 'none';
            markerElement.style.webkitUserSelect = 'none';
            markerElement.style.cursor = 'move';
          }
          
          // Ensure map container allows all touch actions
          const mapContainer = map.getContainer();
          mapContainer.style.touchAction = 'pan-x pan-y pinch-zoom';
        });
        
        // Bind popup to marker to show address
        // Use tooltip instead of popup to avoid blocking marker drag
        marker.bindTooltip(currentAddress || 'Loading address...', {
          permanent: true,
          direction: 'top',
          offset: [0, -45],
          className: 'custom-tooltip',
          opacity: 0.9
        }).openTooltip();
        
        // Track if user is dragging to prevent reset
        let isUserDragging = false;
        
        // Update location when marker is dragged
        marker.on('dragstart', function() {
          isUserDragging = true;
        });
        
        marker.on('drag', function(e) {
          // Update tooltip during drag
          const pos = marker.getLatLng();
          marker.setTooltipContent('Moving...');
        });
        
        marker.on('dragend', function(e) {
          isUserDragging = false;
          const pos = marker.getLatLng();
          currentLat = pos.lat;
          currentLon = pos.lng;
          // Update tooltip to show loading
          marker.setTooltipContent('Loading address...');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'locationSelected',
            latitude: pos.lat,
            longitude: pos.lng
          }));
        });
        
        // Update location when map is clicked
        map.on('click', function(e) {
          const pos = e.latlng;
          currentLat = pos.lat;
          currentLon = pos.lng;
          // Smooth marker movement
          marker.setLatLng([pos.lat, pos.lng], { animate: true, duration: 0.3 });
          marker.setTooltipContent('Loading address...');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'locationSelected',
            latitude: pos.lat,
            longitude: pos.lng
          }));
        });
        
        // Listen for messages from React Native
        window.addEventListener('message', function(event) {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'setLocation') {
              // Don't reset location if user is currently dragging the marker
              if (isUserDragging) {
                return;
              }
              // Only update if location is significantly different (avoid reset on drag)
              const latDiff = Math.abs(currentLat - data.latitude);
              const lonDiff = Math.abs(currentLon - data.longitude);
              // Only update if difference is more than 0.0001 degrees (~11 meters)
              if (latDiff > 0.0001 || lonDiff > 0.0001) {
                currentLat = data.latitude;
                currentLon = data.longitude;
                const currentZoom = map.getZoom();
                map.setView([currentLat, currentLon], currentZoom, { animate: true, duration: 0.3 }); // Smooth animation
                marker.setLatLng([currentLat, currentLon], { animate: true, duration: 0.3 }); // Smooth marker movement
              }
            } else if (data.type === 'updateAddress') {
              // Update tooltip with new address
              currentAddress = data.address || 'Loading address...';
              marker.setTooltipContent(currentAddress);
            }
          } catch (e) {
            console.error('Error handling message:', e);
          }
        });
        
        // Notify React Native that map is ready
        setTimeout(() => {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapReady'
          }));
        }, 500);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Icon name="search-outline" size={20} color="#d32f2f" style={styles.searchIcon} />
          <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <TouchableOpacity
              style={{ flex: 1, minWidth: 0 }}
              activeOpacity={1}
              onPress={() => {
                console.log('📍 Header search clicked, navigating to AddressSearch...');
                try {
                  navigation.navigate('AddressSearch', {
                    initialQuery: searchQuery || '',
                    onSelect: (addressData) => {
                      console.log('✅ Address selected from AddressSearch:', addressData);
                      setSearchQuery(addressData.display_name || '');
                      // Clear address field when selecting from AddressSearch - user must enter house/flat number manually
                      setAddressDetails(prev => ({
                        ...prev,
                        address: '', // Always clear address field - user will enter house/flat number
                      }));
                      if (addressData.location) {
                        setSelectedLocation(addressData.location);
                        // Don't preserve address when loading from search - user must enter it manually
                        loadAddressFromLocation(addressData.location, false);
                        if (webViewRef.current) {
                          webViewRef.current.postMessage(JSON.stringify({
                            type: 'setLocation',
                            latitude: addressData.location.latitude,
                            longitude: addressData.location.longitude,
                          }));
                        }
                      }
                    }
                  });
                } catch (error) {
                  console.error('❌ Navigation error:', error);
                  Alert.alert('Error', 'Could not open search screen. Please try again.');
                }
              }}
            >
              <TextInput
                style={styles.searchInput}
                placeholder="Search for area, street name..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setShowSearchPopup(true);
                }}
                onFocus={() => {
                  setShowSearchPopup(true);
                }}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                editable={false}
                multiline={false} 
                pointerEvents="none"
                numberOfLines={1}
                ellipsizeMode="tail"
              />
            </TouchableOpacity>
          </View>
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => { 
                setSearchQuery(''); 
                setSearchResults([]); 
                setShowSearchPopup(false);
              }}
              style={{ marginLeft: 8, flexShrink: 0 }}
            >
              <Icon name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results Popup */}
      <Modal
        visible={showSearchPopup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSearchPopup(false);
        }}
        statusBarTranslucent={true}
      >
        <View style={styles.searchPopupOverlay}>
          <TouchableOpacity 
            style={styles.searchPopupBackdrop}
            activeOpacity={1}
            onPress={() => setShowSearchPopup(false)}
          />
          <View style={styles.searchPopupContainer}>
            {searching && (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="small" color="#d32f2f" />
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            )}
            {!searching && searchResults.length > 0 && (
              <ScrollView 
                style={styles.searchResultsList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {searchResults.map((result, index) => {
                  const distance = currentLocation && result.lat && result.lon 
                    ? calculateDistance(
                        parseFloat(result.lat),
                        parseFloat(result.lon),
                        currentLocation.latitude,
                        currentLocation.longitude
                      )
                    : null;
                  const distanceText = distance 
                    ? distance < 1 
                      ? `${Math.round(distance * 1000)} m`
                      : `${Math.round(distance)} km`
                    : '';

                  return (
                    <TouchableOpacity
                      key={`result-${index}-${result.place_id || index}`}
                      style={styles.searchResultItem}
                      onPress={() => {
                        handleSearchResultSelect(result);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icon name="location-outline" size={20} color="#666" />
                      <View style={styles.searchResultContent}>
                        {distanceText ? (
                          <Text style={styles.searchResultDistance}>{distanceText}</Text>
                        ) : null}
                        <Text style={styles.searchResultText} numberOfLines={2}>
                          {result.display_name || 'Unknown location'}
                        </Text>
                        {result.address && (
                          <Text style={styles.searchResultSubtext} numberOfLines={1}>
                            {[result.address.city, result.address.state, result.address.country].filter(Boolean).join(', ')}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <View style={styles.searchLoadingContainer}>
                <Text style={styles.searchLoadingText}>No results found</Text>
              </View>
            )}
            {!searching && searchQuery.length < 2 && (
              <View style={styles.searchLoadingContainer}>
                <Text style={styles.searchLoadingText}>Type at least 2 characters to search</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Scrollable Content with Map */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        scrollEnabled={!isMapInteracting}
      >
        {/* Map */}
        <View 
          style={styles.mapContainer}
          onTouchStart={() => {
            setIsMapInteracting(true);
          }}
          onTouchEnd={() => {
            setTimeout(() => setIsMapInteracting(false), 300);
          }}
          onTouchCancel={() => {
            setTimeout(() => setIsMapInteracting(false), 100);
          }}
        >
          {loading && (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color="#f7ab18" />
            </View>
          )}
          <WebView
            ref={webViewRef}
            style={styles.map}
            source={{ html: mapHTML }}
            onMessage={handleMapMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onLoadEnd={() => setLoading(false)}
            scrollEnabled={false}
            nestedScrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            androidLayerType="hardware"
            androidHardwareAccelerationDisabled={false}
          />
          <TouchableOpacity 
            style={styles.currentLocationButton}
            onPress={async () => {
              try {
                const location = await getCurrentLocation();
                setCurrentLocation(location);
                setSelectedLocation(location);
                
                // Update map - move marker to current location
                if (webViewRef.current) {
                  webViewRef.current.postMessage(JSON.stringify({
                    type: 'setLocation',
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }));
                }
                
                // Load address from current location
                await loadAddressFromLocation(location, true);
              } catch (error) {
                console.error('Error getting current location:', error);
                Alert.alert('Error', 'Could not get your current location. Please try again.');
              }
            }}
          >
            <Icon name="locate" size={18} color="#f7ab18" />
            <Text style={styles.currentLocationText}>Use current location</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {/* Delivery Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery details</Text>
          <TouchableOpacity style={styles.addressCard}>
            <Icon name="location" size={20} color="#f7ab18" />
            <Text style={styles.addressText} numberOfLines={3}>
              {(() => {
                // Build full address from addressDetails
                const parts = [];
                if (addressDetails.road) parts.push(addressDetails.road);
                if (addressDetails.locality) parts.push(addressDetails.locality);
                if (addressDetails.area) parts.push(addressDetails.area);
                if (addressDetails.city) parts.push(addressDetails.city);
                if (addressDetails.state) parts.push(addressDetails.state);
                if (addressDetails.zipCode) parts.push(addressDetails.zipCode);
                
                // If we have fullAddress, use it, otherwise build from parts
                const fullAddress = addressDetails.fullAddress || 
                  (parts.length > 0 ? parts.join(', ') : null) ||
                  searchQuery ||
                  'Select location on map';
                
                return fullAddress;
              })()}
            </Text>
            <Icon name="chevron-forward-outline" size={20} color="#999" />
          </TouchableOpacity>
          
        </View>

        {/* Address Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address details*</Text>
          <TextInput
            style={styles.addressInput}
            placeholder="E.g. Floor, House no."
            placeholderTextColor="#999"
            value={addressDetails.address}
            onChangeText={(text) => {
              setAddressDetails(prev => ({
                ...prev,
                address: text,
              }));
            }}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
          <Text style={styles.hintText}>Please enter floor and house number</Text>
        </View>

        {/* Receiver Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receiver details for this address</Text>
          <TouchableOpacity style={styles.receiverCard}>
            <Icon name="call-outline" size={20} color="#666" />
            <View style={styles.receiverInfo}>
              <Text style={styles.receiverName}>{receiverName || 'Enter name'}</Text>
              <Text style={styles.receiverPhone}>{receiverPhone || 'Enter phone'}</Text>
            </View>
            <Icon name="chevron-forward-outline" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Receiver Name and Phone Inputs */}
        <View style={styles.section}>
          <TextInput
            style={styles.input}
            placeholder="Receiver Name"
            placeholderTextColor="#999"
            value={receiverName}
            onChangeText={setReceiverName}
            editable={true}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#999"
            value={receiverPhone}
            onChangeText={(text) => {
              // Only allow numbers
              const numericText = text.replace(/[^0-9]/g, '');
              setReceiverPhone(numericText);
            }}
            keyboardType="phone-pad"
            maxLength={10}
            editable={true}
          />
        </View>

        {/* Save Address As */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Save address as</Text>
          <View style={styles.labelButtons}>
            {['Home', 'Work', 'Other'].map((label) => (
              <TouchableOpacity
                key={label}
                style={[styles.labelButton, addressLabel === label && styles.labelButtonActive]}
                onPress={() => setAddressLabel(label)}
              >
                <Icon
                  name={label === 'Home' ? 'home-outline' : label === 'Work' ? 'briefcase-outline' : 'location-outline'}
                  size={18}
                  color={addressLabel === label ? '#fff' : '#666'}
                />
                <Text style={[styles.labelButtonText, addressLabel === label && styles.labelButtonTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveAddress}>
            <Icon name="checkmark-circle-outline" size={20} color="#fff" style={styles.saveButtonIcon} />
            <Text style={styles.saveButtonText}>Save address</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    minWidth: 0, // Allow shrinking
  },
  searchIcon: {
    marginRight: 8,
    flexShrink: 0, // Prevent icon from shrinking
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingHorizontal: 0,
    paddingVertical: 0,
    minWidth: 0,        // ✅ flex shrink allow
    width: '100%',      // Take full width of parent
  },
  searchPopupOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 70,
  },
  searchPopupBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchPopupContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    maxHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 1000,
  },
  searchResultsList: {
    flex: 1,
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultContent: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultDistance: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  searchResultText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 2,
  },
  searchResultSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  searchLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  mapContainer: {
    height: 250,
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    zIndex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  currentLocationText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#f7ab18',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  addressText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    lineHeight: 22, // Better line spacing for multiline
  },
  distanceBanner: {
    backgroundColor: '#fff9c4',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  distanceText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  useCurrentLink: {
    fontSize: 13,
    color: '#d32f2f',
    fontWeight: '600',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#f7ab18',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  receiverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  receiverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  receiverName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  receiverPhone: {
    fontSize: 13,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  labelButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  labelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  labelButtonActive: {
    backgroundColor: '#d32f2f',
    borderColor: '#d32f2f',
  },
  labelButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  labelButtonTextActive: {
    color: '#fff',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#f7ab18',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddressMapScreen;

