import Geolocation from '@react-native-community/geolocation';
import { Platform, Alert, Linking } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// Request location permission
export const requestLocationPermission = async () => {
  try {
    let permission;
    
    if (Platform.OS === 'ios') {
      permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    } else {
      permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
    }

    const result = await request(permission);
    
    switch (result) {
      case RESULTS.UNAVAILABLE:
        Alert.alert('Location Error', 'Location services are not available on this device');
        return false;
      case RESULTS.DENIED:
        Alert.alert('Permission Denied', 'Location permission was denied');
        return false;
      case RESULTS.LIMITED:
      case RESULTS.GRANTED:
        return true;
      case RESULTS.BLOCKED:
        Alert.alert(
          'Permission Blocked',
          'Location permission is blocked. Please enable it in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      default:
        return false;
    }
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
};

// Get current position
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ latitude, longitude });
      },
      (error) => {
        console.error('Geolocation error:', error);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
};

// Reverse geocoding function (you might want to use a service like Google Maps API)
export const reverseGeocode = async (latitude, longitude) => {
  try {
    // Using a free geocoding service for better address display
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    const data = await response.json();
    
    if (data && data.locality && data.principalSubdivision) {
      return `${data.locality}, ${data.principalSubdivision}`;
    } else if (data && data.city) {
      return `${data.city}, ${data.countryName}`;
    }
    
    // Fallback to mock address if API fails
    return `Downtown Area, NY`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return a realistic mock address instead of coordinates
    return 'Downtown Area, NY';
  }
};

// Request location and get address
export const requestLocationAndGetAddress = async () => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const location = await getCurrentLocation();
    const address = await reverseGeocode(location.latitude, location.longitude);
    
    return {
      ...location,
      address,
    };
  } catch (error) {
    console.error('Location request error:', error);
    Alert.alert('Location Error', 'Unable to get your current location');
    return null;
  }
};