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
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
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
      
      return await response.json();
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
};

export default api;