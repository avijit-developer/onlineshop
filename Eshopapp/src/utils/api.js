import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { EXPO_PUBLIC_API_URL, API_URL } from '@env';

// Prefer env from @env (react-native-dotenv), fallback to process.env
// Dev (debug) ALWAYS uses http://localhost:5000 across simulator/emulator/physical device.
// For Android physical/emulator, use: adb reverse tcp:5000 tcp:5000
const PROD_BASE_FROM_ENV = (EXPO_PUBLIC_API_URL || API_URL || process.env?.EXPO_PUBLIC_API_URL || process.env?.API_URL || 'https://trahimart.com');
export const API_BASE = __DEV__ ? 'http://localhost:5000' : PROD_BASE_FROM_ENV;
if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[API] BASE (dev):', API_BASE);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const api = {
  async request(endpoint, options = {}) {
    const initialBase = API_BASE;
    let url = `${initialBase}${endpoint}`;
    
    // Ensure headers are merged correctly and not overwritten by spreading options
    const { headers: optionHeaders, ...restOptions } = options || {};
    const config = {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(optionHeaders || {}),
      },
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(errorData.message || `HTTP error! status: ${response.status}`, response.status);
      }
      const json = await response.json();
      return json;
    } catch (error) {
      // If pure network error, try one fallback using Metro host-derived base
      const isNetwork = !(error instanceof ApiError);
      if (isNetwork) {
        const altBase = resolveDevBase();
        const usedDefaultEmuBase = initialBase.includes('localhost') || initialBase.includes('10.0.2.2');
        const shouldRetry = altBase && altBase !== initialBase && usedDefaultEmuBase;
        if (shouldRetry) {
          try {
            const altUrl = `${altBase}${endpoint}`;
            const response = await fetch(altUrl, config);
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new ApiError(errorData.message || `HTTP error! status: ${response.status}`, response.status);
            }
            const json = await response.json();
            return json;
          } catch (_) {
            // fall-through to final error
          }
        }
      }
      if (error instanceof ApiError) throw error;
      console.warn('[API] Network error. Base:', initialBase, 'Endpoint:', endpoint);
      throw new ApiError('Network error. Please check your connection.', 0);
    }
  },

  // Authentication endpoints
  async login(email, password) {
    return this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(userData) {
    return this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Customer self addresses
  async addMyAddress(token, address) {
    return this.request('/api/v1/users/me/addresses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(address),
    });
  },

  async getMyAddresses(token) {
    return this.request('/api/v1/users/me/addresses', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  async updateMyAddress(token, addressId, address) {
    return this.request(`/api/v1/users/me/addresses/${addressId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(address),
    });
  },

  async deleteMyAddress(token, addressId) {
    return this.request(`/api/v1/users/me/addresses/${addressId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  async setDefaultAddress(token, addressId) {
    return this.request(`/api/v1/users/me/addresses/${addressId}/default`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Homepage sections
  async getHomePageSections() {
    return this.request('/api/v1/homepage/sections/public');
  },

  async getShippingSettings() {
    return this.request('/api/v1/settings/shipping/public');
  },

  async getHomePageSection(sectionName) {
    return this.request(`/api/v1/homepage/sections/${sectionName}`);
  },

  async getHomePageSectionProducts(sectionName, params = {}) {
    const parts = [];
    if (params.page != null) parts.push('page=' + encodeURIComponent(String(params.page)));
    if (params.limit != null) parts.push('limit=' + encodeURIComponent(String(params.limit)));
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/homepage/sections/${encodeURIComponent(String(sectionName))}/products/public${qs}`);
  },

  async forgotPassword(email) {
    return this.request('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token, password) {
    return this.request('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async getProfile(token) {
    return this.request('/api/v1/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Customer profile update
  async updateUserProfile(token, userData) {
    return this.request('/api/v1/users/me/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });
  },

  // Customer profile picture upload
  async uploadProfilePicture(token, imageFile) {
    const formData = new FormData();
    formData.append('avatar', {
      uri: imageFile.uri,
      type: imageFile.type || 'image/jpeg',
      name: imageFile.name || 'profile.jpg'
    });

    return this.request('/api/v1/users/me/avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });
  },

  // Customer profile picture delete
  async deleteProfilePicture(token) {
    return this.request('/api/v1/users/me/avatar', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Wishlist management functions (auto-token)
  async getWishlist() {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/users/me/wishlist', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  async addToWishlist(productId) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request(`/api/v1/users/me/wishlist/${productId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  async removeFromWishlist(productId) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request(`/api/v1/users/me/wishlist/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  async checkWishlistStatus(productId) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request(`/api/v1/users/me/wishlist/check/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Categories (public)
  async getCategoriesPublic(params = {}) {
    const parts = [];
    if (params.parent) parts.push('parent=' + encodeURIComponent(String(params.parent)));
    if (params.q) parts.push('q=' + encodeURIComponent(String(params.q)));
    if (params.page != null) parts.push('page=' + encodeURIComponent(String(params.page)));
    if (params.limit != null) parts.push('limit=' + encodeURIComponent(String(params.limit)));
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/categories/public${qs}`);
  },

  // Products (public)
  async getProductsPublic(params = {}) {
    const parts = [];
    if (params.q) parts.push('q=' + encodeURIComponent(String(params.q)));
    if (params.category) parts.push('category=' + encodeURIComponent(String(params.category)));
    if (params.page != null) parts.push('page=' + encodeURIComponent(String(params.page)));
    if (params.limit != null) parts.push('limit=' + encodeURIComponent(String(params.limit)));
    if (params.brands) parts.push('brands=' + encodeURIComponent(String(params.brands)));
    if (params.minPrice != null) parts.push('minPrice=' + encodeURIComponent(String(params.minPrice)));
    if (params.maxPrice != null) parts.push('maxPrice=' + encodeURIComponent(String(params.maxPrice)));
    if (params.productType) parts.push('productType=' + encodeURIComponent(String(params.productType)));
    if (params.availability) parts.push('availability=' + encodeURIComponent(String(params.availability)));
    if (params.minRating != null) parts.push('minRating=' + encodeURIComponent(String(params.minRating)));
    if (params.sortBy) parts.push('sortBy=' + encodeURIComponent(String(params.sortBy)));
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/products/public${qs}`);
  },

  // Get filter options for products
  async getProductFilters(params = {}) {
    const parts = [];
    if (params.category) parts.push('category=' + encodeURIComponent(String(params.category)));
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/products/public/filters${qs}`);
  },

  async getRelatedProductsPublic(productId) {
    return this.request(`/api/v1/products/${productId}/related/public`);
  },

  async getProductPublic(productId) {
    return this.request(`/api/v1/products/${productId}/public`);
  },

  // Product search with filters
  async searchProductsPublic(params = {}) {
    const parts = [];
    if (params.q) parts.push('q=' + encodeURIComponent(String(params.q)));
    if (params.category) parts.push('category=' + encodeURIComponent(String(params.category)));
    if (params.brand) parts.push('brand=' + encodeURIComponent(String(params.brand)));
    if (params.minPrice != null) parts.push('minPrice=' + encodeURIComponent(String(params.minPrice)));
    if (params.maxPrice != null) parts.push('maxPrice=' + encodeURIComponent(String(params.maxPrice)));
    if (params.inStock !== undefined) parts.push('inStock=' + encodeURIComponent(String(params.inStock)));
    if (params.productType) parts.push('productType=' + encodeURIComponent(String(params.productType)));
    if (params.page != null) parts.push('page=' + encodeURIComponent(String(params.page)));
    if (params.limit != null) parts.push('limit=' + encodeURIComponent(String(params.limit)));
    if (params.sort) parts.push('sort=' + encodeURIComponent(String(params.sort)));
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/products/search/public${qs}`);
  },

  // Get product variants for configurable products
  async getProductVariantsPublic(productId) {
    return this.request(`/api/v1/products/${productId}/variants/public`);
  },

  // Get product reviews (if implemented)
  async getProductReviewsPublic(productId, params = {}) {
    const parts = [];
    if (params.page != null) parts.push('page=' + encodeURIComponent(String(params.page)));
    if (params.limit != null) parts.push('limit=' + encodeURIComponent(String(params.limit)));
    if (params.rating) parts.push('rating=' + encodeURIComponent(String(params.rating)));
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/products/${productId}/reviews/public${qs}`);
  },

  async submitProductReview(productId, { rating, title, comment, images = [] }) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/reviews', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ product: productId, rating, title, comment, images })
    });
  },

  // Address management functions (auto-token)
  async getUserAddresses() {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.getMyAddresses(token);
  },

  async addUserAddress(address) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.addMyAddress(token, address);
  },

  async updateUserAddress(addressId, address) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.updateMyAddress(token, addressId, address);
  },

  async deleteUserAddress(addressId) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.deleteMyAddress(token, addressId);
  },

  async setDefaultUserAddress(addressId) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.setDefaultAddress(token, addressId);
  },

  // Cart management functions (auto-token)
  async getUserCart() {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/cart/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
  async applyCouponToCart(couponCode, paymentMethod) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/cart/me/coupon', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ couponCode, paymentMethod }),
    });
  },
  async removeCouponFromCart() {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/cart/me/coupon', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  },

  async addToUserCart(product, quantity, selectedAttributes) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/cart/me/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ product, quantity, selectedAttributes }),
    });
  },

  async updateUserCartItem(cartId, quantity) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request(`/api/v1/cart/me/items/${cartId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ quantity }),
    });
  },

  async removeFromUserCart(cartId) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request(`/api/v1/cart/me/items/${cartId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  async clearUserCart() {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/cart/me', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  async getUserCartSummary() {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/cart/me/summary', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  // Orders (customer)
  async createOrder(orderData) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/orders/me', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(orderData),
    });
  },

  async validateCoupon(couponCode, items, paymentMethod) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/coupons/validate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ couponCode, items, paymentMethod }),
    });
  },

  async getMyOrders() {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request('/api/v1/orders/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
  },

  async getMyOrderById(orderId) {
    const token = await this.getStoredToken();
    if (!token) throw new Error('No authentication token');
    return this.request(`/api/v1/orders/me/${orderId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
  },

  // Helper function to get stored token
  async getStoredToken() {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.log('Error getting stored token:', error);
      return null;
    }
  },
};

export default api;