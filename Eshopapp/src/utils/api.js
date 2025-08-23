import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || 'http://10.0.2.2:5000';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const api = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // Ensure headers are merged correctly and not overwritten by spreading options
    const { headers: optionHeaders, ...restOptions } = options || {};
    const config = {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(optionHeaders || {}),
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP error! status: ${response.status}`,
          response.status
        );
      }
      
      const json = await response.json();
      return json;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
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

  async getHomePageSection(sectionName) {
    return this.request(`/api/v1/homepage/sections/${sectionName}`);
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

  // Note: update profile endpoint is not implemented for customers in backend

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
    if (params.brand) parts.push('brand=' + encodeURIComponent(String(params.brand)));
    if (params.minPrice != null) parts.push('minPrice=' + encodeURIComponent(String(params.minPrice)));
    if (params.maxPrice != null) parts.push('maxPrice=' + encodeURIComponent(String(params.maxPrice)));
    if (params.sort) parts.push('sort=' + encodeURIComponent(String(params.sort)));
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/products/public${qs}`);
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