const API_BASE = window.location.origin + '/api';

const api = {
  getToken() {
    return localStorage.getItem('token');
  },
  
  setToken(token) {
    localStorage.setItem('token', token);
  },
  
  removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getUser() {
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = options.headers || {};
    
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      
      if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        this.removeToken();
        window.location.href = '/login';
        return null;
      }

      const data = await response.json();
      // Safely parse JSON to prevent "Unexpected end of JSON input" crashes
      const text = await response.text();
      let data = {};
      
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.warn('API returned non-JSON response. This usually indicates a server crash or 502 Bad Gateway.');
        }
      }

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
        throw new Error(data.message || `Server Error (${response.status})`);
      }
      return data;
    } catch (error) {
      console.error(`API Fail [${endpoint}]:`, error.message);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
};
