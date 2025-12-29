import React, { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '../utils/locationUtils';
import './MapPicker.css';

const MapPicker = ({ onSelectLocation, initialLocation, onClose, initialAddress }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [addressDetails, setAddressDetails] = useState(initialAddress || {});
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Wait for Leaflet to be available with retry
    const initMap = () => {
      if (!window.L) {
        // Retry after a short delay if Leaflet isn't loaded yet
        setTimeout(initMap, 100);
        return;
      }

      // Leaflet is available, proceed with map initialization
      const defaultLat = initialLocation?.latitude || 22.5726; // Kolkata default
      const defaultLon = initialLocation?.longitude || 88.3639;

      const map = window.L.map(mapRef.current).setView([defaultLat, defaultLon], 15);
      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 3
      }).addTo(map);

      // Create custom marker icon
      const customIcon = window.L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin"></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
      });

      // Add marker
      const marker = window.L.marker([defaultLat, defaultLon], {
        icon: customIcon,
        draggable: true
      }).addTo(map);
      markerRef.current = marker;

      // Bind popup/tooltip
      if (initialAddress?.fullAddress || initialAddress?.display) {
        marker.bindTooltip(initialAddress.fullAddress || initialAddress.display || 'Location', {
          permanent: true,
          direction: 'top',
          offset: [0, -45],
          className: 'custom-tooltip'
        }).openTooltip();
      }

      // Handle marker drag
      marker.on('dragend', async (e) => {
        const pos = marker.getLatLng();
        const location = { latitude: pos.lat, longitude: pos.lng };
        setSelectedLocation(location);
        
        // Update tooltip to show loading
        marker.setTooltipContent('Loading address...');
        
        // Reverse geocode
        try {
          const address = await reverseGeocode(pos.lat, pos.lng);
          setAddressDetails(address);
          marker.setTooltipContent(address.fullAddress || address.display || 'Location');
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          marker.setTooltipContent('Location selected');
        }
      });

      // Handle map click
      map.on('click', async (e) => {
        const pos = e.latlng;
        const location = { latitude: pos.lat, longitude: pos.lng };
        setSelectedLocation(location);
        
        // Move marker
        marker.setLatLng([pos.lat, pos.lng]);
        marker.setTooltipContent('Loading address...');
        
        // Reverse geocode
        try {
          const address = await reverseGeocode(pos.lat, pos.lng);
          setAddressDetails(address);
          marker.setTooltipContent(address.fullAddress || address.display || 'Location');
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          marker.setTooltipContent('Location selected');
        }
      });

      setMapReady(true);
      setLoading(false);

      // Load initial address if location is provided
      if (initialLocation) {
        reverseGeocode(initialLocation.latitude, initialLocation.longitude)
          .then(address => {
            setAddressDetails(address);
            if (markerRef.current) {
              markerRef.current.setTooltipContent(address.fullAddress || address.display || 'Location');
            }
          })
          .catch(console.error);
      }
    };

    initMap();

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update addressDetails when initialAddress changes
  useEffect(() => {
    if (initialAddress && Object.keys(initialAddress).length > 0) {
      setAddressDetails(initialAddress);
    }
  }, [initialAddress]);

  const handleConfirm = () => {
    if (selectedLocation) {
      // Always pass the latest addressDetails, even if location is same
      onSelectLocation({
        ...selectedLocation,
        addressDetails: addressDetails || {}
      });
    }
  };

  return (
    <div className="map-picker-modal">
      <div className="map-picker-overlay" onClick={onClose}></div>
      <div className="map-picker-container">
        <div className="map-picker-header">
          <h3>Select Location on Map</h3>
          <button className="map-picker-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="map-picker-body">
          <div className="map-picker-controls">
            {selectedLocation && (
              <div className="map-coordinates">
                Lat: {selectedLocation.latitude.toFixed(6)}, 
                Lng: {selectedLocation.longitude.toFixed(6)}
              </div>
            )}
          </div>
          
          <div className="map-picker-instructions">
            <p>Click on the map or drag the marker to select your location</p>
          </div>
          
          <div className="map-container" ref={mapRef}>
            {loading && (
              <div className="map-loading">
                <div className="spinner"></div>
                <p>Loading map...</p>
              </div>
            )}
          </div>
          
          {addressDetails.fullAddress && (
            <div className="map-address-preview">
              <strong>Address:</strong> {addressDetails.fullAddress}
            </div>
          )}
        </div>
        
        <div className="map-picker-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleConfirm}
            disabled={!selectedLocation}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;

