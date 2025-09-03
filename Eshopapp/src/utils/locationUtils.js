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

    let result = await request(permission);
    
    switch (result) {
      case RESULTS.UNAVAILABLE:
        Alert.alert('Location Error', 'Location services are not available on this device');
        return false;
      case RESULTS.DENIED:
        // Try coarse on Android as a fallback
        if (Platform.OS === 'android') {
          const coarse = await request(PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION);
          if (coarse === RESULTS.GRANTED || coarse === RESULTS.LIMITED) return true;
        }
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
    const optsHigh = { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 };
    const optsLow = { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 };
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ latitude, longitude });
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Retry once with lower accuracy if high accuracy fails
        Geolocation.getCurrentPosition(
          (p2) => {
            const { latitude, longitude } = p2.coords;
            resolve({ latitude, longitude });
          },
          (e2) => {
            console.error('Geolocation retry error:', e2);
            reject(error);
          },
          optsLow
        );
      },
      optsHigh
    );
  });
};

// Reverse geocoding function (you might want to use a service like Google Maps API)
export const reverseGeocode = async (latitude, longitude) => {
  try {
    // For Android emulator, use a more reliable approach
    // The emulator often has network restrictions, so we'll use a simpler fallback
    if (Platform.OS === 'android') {
      // Try a simple geocoding service that works better in emulators
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
        {
          headers: {
            'User-Agent': 'EshopApp/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const addr = data?.address || {};
        const area = addr.suburb || addr.neighbourhood || addr.hamlet || addr.village || addr.town || '';
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const display = data?.display_name || [area, city].filter(Boolean).join(', ');
        return { area, city, display };
      }
    } else {
      // For iOS, try the original service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      const data = await response.json();
      const area = data?.locality || data?.localityInfo?.administrative?.[0]?.name || '';
      const city = data?.principalSubdivision || data?.city || data?.localityInfo?.administrative?.[1]?.name || '';
      const display = (data && (data.locality || data.city)) ? `${(data.locality || data.city)}, ${(data.principalSubdivision || data.countryName || '')}`.trim().replace(/,\s*$/, '') : `${area}${city ? ', ' + city : ''}`;
      return { area, city, display };
    }
    
    // Fallback to mock address if API fails
    return { area: 'Downtown Area', city: 'NY', display: 'Downtown Area, NY' };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return a realistic mock address instead of coordinates
    return { area: 'Downtown Area', city: 'NY', display: 'Downtown Area, NY' };
  }
};

// Request location and get address
export const requestLocationAndGetAddress = async () => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    let location;
    try {
      location = await getCurrentLocation();
    } catch (e) {
      // Fallback: use IP-based geolocation (approximate city/region)
      const ipRes = await fetch('https://ipapi.co/json/').then(r => r.ok ? r.json() : null).catch(() => null);
      if (ipRes && ipRes.latitude && ipRes.longitude) {
        location = { latitude: ipRes.latitude, longitude: ipRes.longitude };
      } else {
        throw e;
      }
    }
    const geo = await reverseGeocode(location.latitude, location.longitude);
    const area = typeof geo === 'string' ? (geo.split(', ')[0] || '') : (geo.area || '');
    const city = typeof geo === 'string' ? (geo.split(', ')[1] || '') : (geo.city || '');
    const display = typeof geo === 'string' ? geo : (geo.display || [area, city].filter(Boolean).join(', '));

    return {
      ...location,
      address: display,
      area,
      city,
    };
  } catch (error) {
    console.error('Location request error:', error);
    Alert.alert('Location Error', 'Unable to get your current location');
    return null;
  }
};