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
    const qs = parts.length ? '?' + parts.join('&') : '';
    return this.request(`/api/v1/products/public${qs}`);
  },

  async getRelatedProductsPublic(productId) {
    return this.request(`/api/v1/products/${productId}/related/public`);
  },

  async getProductPublic(productId) {
    return this.request(`/api/v1/products/${productId}/public`);
  },
};

export default api;