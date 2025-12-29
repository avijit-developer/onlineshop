import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCurrentLocation } from '../utils/locationUtils';

const MapPicker = ({ onSelectLocation, initialLocation, onClose }) => {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const webViewRef = useRef(null);

  useEffect(() => {
    // Try to get current location on mount
    if (!initialLocation) {
      loadCurrentLocation();
    } else {
      setSelectedLocation(initialLocation);
      setCurrentLocation(initialLocation);
    }
  }, []);

  const loadCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setSelectedLocation(location);
        // Send location to WebView
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'setLocation',
            latitude: location.latitude,
            longitude: location.longitude,
          }));
        }
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      // Use default location (Kolkata)
      const defaultLoc = { latitude: 22.5726, longitude: 88.3639 };
      setCurrentLocation(defaultLoc);
      setSelectedLocation(defaultLoc);
    }
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected') {
        const location = {
          latitude: data.latitude,
          longitude: data.longitude,
        };
        setSelectedLocation(location);
      } else if (data.type === 'mapReady') {
        setLoading(false);
        // Send initial location to map
        if (currentLocation || initialLocation) {
          const loc = currentLocation || initialLocation;
          webViewRef.current.postMessage(JSON.stringify({
            type: 'setLocation',
            latitude: loc.latitude,
            longitude: loc.longitude,
          }));
        }
      }
    } catch (error) {
      console.error('Error parsing message from WebView:', error);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelectLocation(selectedLocation);
      onClose();
    } else {
      Alert.alert('Error', 'Please select a location on the map');
    }
  };

  const handleMyLocation = () => {
    loadCurrentLocation();
  };

  // HTML with Leaflet map (OpenStreetMap)
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body, html { width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100%; }
        .custom-marker {
          background-color: #f7ab18;
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .custom-marker::after {
          content: '';
          width: 10px;
          height: 10px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        let map, marker;
        let currentLat = ${currentLocation?.latitude || initialLocation?.latitude || 22.5726};
        let currentLon = ${currentLocation?.longitude || initialLocation?.longitude || 88.3639};
        
        // Initialize map
        map = L.map('map').setView([currentLat, currentLon], 15);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        
        // Create custom icon
        const customIcon = L.divIcon({
          className: 'custom-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30]
        });
        
        // Add initial marker
        marker = L.marker([currentLat, currentLon], { 
          icon: customIcon,
          draggable: true 
        }).addTo(map);
        
        // Update location when marker is dragged
        marker.on('dragend', function(e) {
          const pos = marker.getLatLng();
          currentLat = pos.lat;
          currentLon = pos.lng;
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
          marker.setLatLng([pos.lat, pos.lng]);
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
              currentLat = data.latitude;
              currentLon = data.longitude;
              map.setView([currentLat, currentLon], 15);
              marker.setLatLng([currentLat, currentLon]);
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
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="close-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Location</Text>
        <TouchableOpacity onPress={handleMyLocation} style={styles.myLocationButton}>
          <Icon name="locate-outline" size={24} color="#f7ab18" />
        </TouchableOpacity>
      </View>

      {/* Map WebView */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f7ab18" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: mapHTML }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadEnd={() => setLoading(false)}
      />

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Icon name="information-circle-outline" size={20} color="#666" />
        <Text style={styles.instructionsText}>
          Tap on the map or drag the pin to select your exact location
        </Text>
      </View>

      {/* Confirm Button */}
      <View style={styles.footer}>
        {selectedLocation && (
          <Text style={styles.coordinatesText}>
            📍 {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </Text>
        )}
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Icon name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
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
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  myLocationButton: {
    padding: 8,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  instructionsText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7ab18',
    padding: 16,
    borderRadius: 12,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default MapPicker;
