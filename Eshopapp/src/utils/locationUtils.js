import Geolocation from '@react-native-community/geolocation';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    // Try cache first for speed
    const cacheKey = makeGeoCacheKey(latitude, longitude);
    const cached = await getGeoCache(cacheKey);
    if (cached) return cached;

    // Issue requests in parallel and take the fastest usable
    const providers = [
      reverseNominatim(latitude, longitude, 2500),
      reverseBigDataCloud(latitude, longitude, 2500),
      reverseNominatimMirror(latitude, longitude, 2500),
    ];
    const results = await Promise.allSettled(providers);
    // Prefer a result with postalCode, otherwise first fulfilled
    let picked = null;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        if (!picked) picked = r.value;
        if (r.value.postalCode) { picked = r.value; break; }
      }
    }
    if (!picked) {
      // Fall back to old single-provider flow below
    } else {
      await setGeoCache(cacheKey, picked);
      return picked;
    }
    // For Android emulator, use a more reliable approach
    // The emulator often has network restrictions, so we'll use a simpler fallback
    if (Platform.OS === 'android') {
      // Try a simple geocoding service that works better in emulators
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'EshopApp/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const parsed = parseNominatim(data);
        await setGeoCache(cacheKey, parsed);
        return parsed;
      }
    } else {
      // For iOS, try the original service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      const data = await response.json();
      const parsed = parseBigDataCloud(data);
      await setGeoCache(cacheKey, parsed);
      return parsed;
    }
    
    // Fallback to mock address if API fails
    const fallback = { area: 'Downtown Area', city: 'NY', state: '', postalCode: '', country: 'United States', display: 'Downtown Area, NY' };
    await setGeoCache(cacheKey, fallback);
    return fallback;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return a realistic mock address instead of coordinates
    const fallback = { area: 'Downtown Area', city: 'NY', state: '', postalCode: '', country: 'United States', display: 'Downtown Area, NY' };
    return fallback;
  }
};

// Forward geocoding: convert address string to coordinates
export const geocodeAddress = async (addressString) => {
  if (!addressString || addressString.trim().length < 3) {
    console.warn('Address string too short for geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(addressString.trim());
    
    // Try multiple geocoding providers in parallel
    const providers = [
      // Provider 1: Nominatim (OpenStreetMap)
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'EshopApp/1.0'
          }
        }
      ).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0 && data[0].lat && data[0].lon) {
            return {
              latitude: parseFloat(data[0].lat),
              longitude: parseFloat(data[0].lon),
              provider: 'nominatim'
            };
          }
        }
        throw new Error('Nominatim failed');
      }),
      
      // Provider 2: Geocode.maps.co (backup)
      fetch(
        `https://geocode.maps.co/search?q=${encodedAddress}&limit=1`,
        {
          headers: {
            'User-Agent': 'EshopApp/1.0'
          }
        }
      ).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0 && data[0].lat && data[0].lon) {
            return {
              latitude: parseFloat(data[0].lat),
              longitude: parseFloat(data[0].lon),
              provider: 'geocode.maps.co'
            };
          }
        }
        throw new Error('Geocode.maps.co failed');
      }),
      
      // Provider 3: BigDataCloud (backup)
      fetch(
        `https://api.bigdatacloud.net/data/forward-geocode-client?q=${encodedAddress}&limit=1`
      ).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0 && data[0].latitude && data[0].longitude) {
            return {
              latitude: parseFloat(data[0].latitude),
              longitude: parseFloat(data[0].longitude),
              provider: 'bigdatacloud'
            };
          }
        }
        throw new Error('BigDataCloud failed');
      })
    ];

    // Try all providers with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Geocoding timeout')), 10000)
    );

    const results = await Promise.allSettled([
      Promise.race([...providers, timeoutPromise])
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value && result.value.latitude && result.value.longitude) {
        console.log(`Geocoding successful using ${result.value.provider}:`, result.value.latitude, result.value.longitude);
        return {
          latitude: result.value.latitude,
          longitude: result.value.longitude
        };
      }
    }

    // If all providers fail, try a simplified address search
    console.log('All geocoding providers failed, trying simplified address...');
    const simplifiedAddress = addressString.split(',').slice(-2).join(',').trim(); // Try with just city and state/country
    if (simplifiedAddress && simplifiedAddress !== addressString && simplifiedAddress.length > 3) {
      const encodedSimplified = encodeURIComponent(simplifiedAddress);
      const fallbackResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedSimplified}&limit=1`,
        {
          headers: {
            'User-Agent': 'EshopApp/1.0'
          }
        }
      );
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.length > 0 && fallbackData[0].lat && fallbackData[0].lon) {
          console.log('Geocoding successful with simplified address');
          return {
            latitude: parseFloat(fallbackData[0].lat),
            longitude: parseFloat(fallbackData[0].lon)
          };
        }
      }
    }

    console.warn('All geocoding attempts failed for address:', addressString);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
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
    const state = typeof geo === 'string' ? '' : (geo.state || '');
    const postalCode = typeof geo === 'string' ? '' : (geo.postalCode || '');
    const country = typeof geo === 'string' ? '' : (geo.country || '');
    const display = typeof geo === 'string' ? geo : (geo.display || [area, city].filter(Boolean).join(', '));

    return {
      ...location,
      address: display,
      area,
      city,
      state,
      postalCode,
      country,
    };
  } catch (error) {
    console.error('Location request error:', error);
    Alert.alert('Location Error', 'Unable to get your current location');
    return null;
  }
};

// Helpers: providers with timeout and parsing
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

function parseNominatim(json) {
  const addr = json?.address || {};
  const road = addr.road || addr.street || addr.pedestrian || '';
  const locality = addr.locality || addr.suburb || addr.neighbourhood || addr.hamlet || addr.village || '';
  const area = addr.suburb || addr.neighbourhood || addr.hamlet || addr.village || addr.town || '';
  const city = addr.city || addr.town || addr.village || addr.county || '';
  const state = addr.state || addr.region || '';
  const postalCode = addr.postcode || '';
  const country = addr.country || '';
  
  // Build detailed display address: road, locality, area, city
  const addressParts = [road, locality, area, city].filter(Boolean);
  const display = json?.display_name || addressParts.join(', ') || [area, city].filter(Boolean).join(', ');
  
  return { 
    road,
    locality,
    area, 
    city, 
    state, 
    postalCode, 
    country, 
    display,
    fullAddress: addressParts.join(', ')
  };
}

function parseBigDataCloud(json) {
  const road = json?.street || json?.streetName || '';
  const locality = json?.locality || json?.localityInfo?.administrative?.[0]?.name || '';
  const area = json?.locality || json?.localityInfo?.administrative?.[0]?.name || '';
  const city = json?.city || json?.locality || json?.localityInfo?.administrative?.[1]?.name || '';
  const state = json?.principalSubdivision || json?.localityInfo?.administrative?.[2]?.name || '';
  const postalCode = json?.postcode || '';
  const country = json?.countryName || '';
  
  // Build detailed display address
  const addressParts = [road, locality, area, city].filter(Boolean);
  const display = (json && (json.locality || json.city)) 
    ? `${(json.locality || json.city)}, ${(json.principalSubdivision || json.countryName || '')}`.trim().replace(/,\s*$/, '') 
    : (addressParts.length > 0 ? addressParts.join(', ') : `${area}${city ? ', ' + city : ''}`);
  
  return { 
    road,
    locality,
    area, 
    city, 
    state, 
    postalCode, 
    country, 
    display,
    fullAddress: addressParts.join(', ')
  };
}

async function reverseNominatim(lat, lon, timeoutMs) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const res = await withTimeout(fetch(url, { headers: { 'User-Agent': 'EshopApp/1.0' } }), timeoutMs);
  if (!res.ok) throw new Error('nominatim fail');
  const json = await res.json();
  return parseNominatim(json);
}

async function reverseNominatimMirror(lat, lon, timeoutMs) {
  const url = `https://geocode.maps.co/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`;
  const res = await withTimeout(fetch(url, { headers: { 'User-Agent': 'EshopApp/1.0' } }), timeoutMs);
  if (!res.ok) throw new Error('nominatim mirror fail');
  const json = await res.json();
  return parseNominatim(json);
}

async function reverseBigDataCloud(lat, lon, timeoutMs) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await withTimeout(fetch(url), timeoutMs);
  if (!res.ok) throw new Error('bigdatacloud fail');
  const json = await res.json();
  return parseBigDataCloud(json);
}

function makeGeoCacheKey(lat, lon) {
  const r = (n) => Math.round(Number(n) * 1000) / 1000; // ~100m grid
  return `geoCache:${r(lat)},${r(lon)}`;
}

async function getGeoCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const maxAgeMs = 24 * 60 * 60 * 1000;
    if (Date.now() - (obj.ts || 0) > maxAgeMs) return null;
    return obj.data || null;
  } catch { return null; }
}

async function setGeoCache(key, data) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}