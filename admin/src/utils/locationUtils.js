// Reverse geocoding function using OpenStreetMap Nominatim
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TrahiMart-Admin/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }
    
    const data = await response.json();
    return parseNominatim(data);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return fallback data
    return {
      road: '',
      locality: '',
      area: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      display: 'Location selected',
      fullAddress: ''
    };
  }
};

// Forward geocoding: convert address string to coordinates
export const geocodeAddress = async (addressString) => {
  if (!addressString || addressString.trim().length < 3) {
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(addressString.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1&countrycodes=in`,
      {
        headers: {
          'User-Agent': 'TrahiMart-Admin/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding failed');
    }
    
    const data = await response.json();
    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Search address suggestions (autocomplete)
export const searchAddressSuggestions = async (query) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=10&addressdetails=1&countrycodes=in`,
      {
        headers: {
          'User-Agent': 'TrahiMart-Admin/1.0'
        }
      }
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      // Filter only India addresses and format results
      return data
        .filter(result => {
          const country = result.address?.country || result.address?.country_code?.toUpperCase() || '';
          const displayName = (result.display_name || '').toLowerCase();
          return country === 'India' || country === 'IN' || displayName.includes('india');
        })
        .map(result => ({
          display_name: result.display_name,
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          address: result.address || {}
        }));
    }
    
    return [];
  } catch (error) {
    console.error('Address search error:', error);
    return [];
  }
};

// Get current location using browser geolocation API
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Default to Kolkata if geolocation fails
        resolve({
          latitude: 22.5726,
          longitude: 88.3639
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
};

// Parse Nominatim response
function parseNominatim(json) {
  const addr = json?.address || {};
  const road = addr.road || addr.street || addr.pedestrian || '';
  const locality = addr.locality || addr.suburb || addr.neighbourhood || addr.hamlet || addr.village || '';
  const area = addr.suburb || addr.neighbourhood || addr.hamlet || addr.village || addr.town || '';
  const city = addr.city || addr.town || addr.village || addr.county || '';
  const state = addr.state || addr.region || '';
  const postalCode = addr.postcode || '';
  const country = addr.country || 'India';
  
  // Build detailed display address
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

