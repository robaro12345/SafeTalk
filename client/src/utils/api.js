import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
  withCredentials: true, // Include cookies for refresh tokens
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // List of endpoints that don't require authentication
    const publicEndpoints = [
      '/auth/register',
      '/auth/login',
      '/auth/verify-2fa',
      '/auth/resend-otp',
      '/auth/regenerate-totp'
    ];

    // Check if the current request is to a public endpoint
    const isPublicEndpoint = publicEndpoints.some(endpoint => {
      const url = config.url || '';
      return url.endsWith(endpoint) || url.includes(endpoint);
    });

    // Only add auth token for non-public endpoints
    if (!isPublicEndpoint) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshResponse = await axios.post(
          `${api.defaults.baseURL.replace('/api', '')}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = refreshResponse.data.accessToken;
        localStorage.setItem('accessToken', newToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    const errorMessage = error.response?.data?.message || 'An error occurred';

    // Respect per-request silent flag to avoid duplicate toasts from callers
    // Callers can pass { silent: true } in the axios config or set originalRequest.silent
    const isSilentRequest = originalRequest?.silent === true || originalRequest?.headers?.['x-skip-toast'] === '1';

    // Don't show toast for certain error types or when the request asked to be silent
    const silentErrors = ['Network Error', 'timeout'];
    if (!isSilentRequest && !silentErrors.some(silent => errorMessage.includes(silent))) {
      toast.error(errorMessage);
    }

    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData, { 
    withCredentials: false, // Don't send cookies for register
    headers: { Authorization: undefined } // Explicitly remove auth header
  }),
  login: (credentials) => api.post('/auth/login', credentials, { 
    withCredentials: false, // Don't send cookies for login
    headers: { Authorization: undefined } // Explicitly remove auth header
  }),
  verify2FA: (data) => api.post('/auth/verify-2fa', data),
  resendOTP: (data) => api.post('/auth/resend-otp', data, { 
    withCredentials: false, // Don't send cookies for resend OTP
    headers: { Authorization: undefined } // Explicitly remove auth header
  }),
  regenerateTOTP: (data) => api.post('/auth/regenerate-totp', data, { 
    withCredentials: false, // Don't send cookies for regenerate TOTP
    headers: { Authorization: undefined } // Explicitly remove auth header
  }),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
};

// User API calls
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  searchUsers: (query) => api.get(`/users/search?query=${encodeURIComponent(query)}`),
  getUserById: (userId, config = {}) => api.get(`/users/${userId}`, config),
  changePassword: (data) => api.put('/users/change-password', data),
  update2FA: (data) => api.put('/users/update-2fa', data),
  // Admin routes
  getAllUsers: (params) => api.get('/users/admin/all', { params }),
  updateUserStatus: (userId, data) => api.put(`/users/admin/${userId}/status`, data),
  // No private key endpoints (encryption removed)
};

// Message API calls
export const messageAPI = {
  send: (messageData) => api.post('/messages/send', messageData),
  getConversation: (userId, params) => api.get(`/messages/conversation/${userId}`, { params }),
  getConversations: () => api.get('/messages/conversations'),
  updateMessageStatus: (messageId, data) => api.put(`/messages/${messageId}/status`, data),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}`),
};

// Generic API utilities
export const apiUtils = {
  // Handle API errors consistently
  handleError: (error, defaultMessage = 'An error occurred') => {
    console.error('API Error:', error);
    const message = error.response?.data?.message || defaultMessage;
    toast.error(message);
    return message;
  },

  // Format API response data
  formatResponse: (response) => {
    return {
      success: response.data?.success || true,
      data: response.data?.data || response.data,
      message: response.data?.message,
    };
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('accessToken');
  },

  // Get stored user data
  getUser: () => {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  },

  // Store user data
  setUser: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
  },

  // Clear auth data
  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    // encryption keys removed
  },

  // Encryption removed; no key helpers
  getEncryptionKeys: () => ({ encryptedPrivateKey: null, keySalt: null, privateKey: null }),
};

export default api;