// src/services/api.js
import config from '../config';
const API_URL = config.apiUrl;
let sessionTimeoutHandler = null;

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const handleResponse = async (response) => {
  // Important: Don't parse the response body yet
  if (response.status === 401) {
    // Emit session timeout event before parsing the body
    console.log('Session timeout detected in API');
    const event = new CustomEvent('sessionTimeout');
    window.dispatchEvent(event);
    
    // Parse the error response
    const errorData = await response.json();
    throw new Error('Session expired');
  }

  // For non-401 responses, parse and handle normally
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
};

const request = async (url, options = {}) => {
  const config = {
    url: `${API_URL}${url}`,
    options: {
      ...options,
      headers: {
        ...options.headers,
        ...getHeaders()
      }
    }
  };

  try {
    const response = await fetch(config.url, config.options);
    return handleResponse(response);
  } catch (error) {
    if (error.message === 'Session expired') {
      // Return a promise that will be resolved after re-authentication
      return new Promise((resolve, reject) => {
        sessionTimeoutHandler = { resolve, reject, config };
      });
    }
    console.error('API request error:', error);
    throw error;
  }
};

export const api = {
  // Method to resume pending requests after re-authentication
  resumeRequest: async () => {
    if (sessionTimeoutHandler) {
      const { resolve, reject, config } = sessionTimeoutHandler;
      try {
        // Retry the original request with new token
        const response = await fetch(config.url, {
          ...config.options,
          headers: {
            ...config.options.headers,
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const result = await response.json();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        sessionTimeoutHandler = null;
      }
    }
  },

  // Group Management
  getGroups: () =>
    request('/groups'),

  getGroup: (id) =>
    request(`/groups/${id}`),

  createGroup: (groupData) =>
    request('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData)
    }),

  updateGroup: (id, groupData) =>
    request(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(groupData)
    }),

  deleteGroup: (id) =>
    request(`/groups/${id}`, {
      method: 'DELETE'
    }),

  reassignAndDeleteGroup: (id, newGroupId) =>
    request(`/groups/${id}/reassign-and-delete`, {
      method: 'POST',
      body: JSON.stringify({ newGroupId })
    }),

  getGroupUsers: (id) =>
    request(`/groups/${id}/users`),

  getAvailableUsers: (id) =>
    request(`/groups/${id}/available-users`),

  addUserToGroup: (groupId, userId) =>
    request(`/groups/${groupId}/users`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    }),

  removeUserFromGroup: (groupId, userId) =>
    request(`/groups/${groupId}/users/${userId}`, {
      method: 'DELETE'
    }), 
  // Auth related methods
  login: (credentials) => 
    request('auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
    
  logout: () => 
    request('auth/logout', {  // Remove the leading slash
      method: 'POST'
    }),
  // User related methods
  getUserProfile: () => 
    request('/user/profile'),

  updateProfile: (profileData) =>
    request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    }),

  changePassword: (passwords) =>
    request('/user/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords)
    }),

  // Permissions related methods
  getPermissions: () =>
    request('/user/permissions'),

  // Notifications related methods
  getNotifications: () =>
    request('/notifications'),

  markNotificationRead: (notificationId) =>
    request(`/notifications/${notificationId}/read`, {
      method: 'POST'
    }),

  // Settings related methods
  getUserSettings: () =>
    request('/user/settings'),

  updateUserSettings: (settings) =>
    request('/user/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // Dashboard related methods
  getDashboardStats: () =>
    request('/dashboard/stats'),

  // QA Form related methods
  getQAForms: () =>
    request('/qa-forms'),

  getQAForm: (id) =>
    request(`/qa-forms/${id}`),

  createQAForm: (formData) =>
    request('/qa-forms', {
      method: 'POST',
      body: JSON.stringify(formData)
    }),

  updateQAForm: (id, formData) =>
    request(`/qa-forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    }),

  deleteQAForm: (id) =>
    request(`/qa-forms/${id}`, {
      method: 'DELETE'
    }),

  // Criteria Profile endpoints
  getCriteriaProfiles: () =>
    request('/criteria-profiles'),

  getCriteriaProfile: (id) =>
    request(`/criteria-profiles/${id}`),

  createCriteriaProfile: (formData) =>
    request('/criteria-profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'  // Make sure this is set
      },
      body: JSON.stringify(formData)
    }),

  updateCriteriaProfile: (id, formData) =>
    request(`/criteria-profiles/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'  // Make sure this is set
      },
      body: JSON.stringify(formData)
    }),

  deleteCriteriaProfile: (id) =>
    request(`/criteria-profiles/${id}`, {
      method: 'DELETE'
    }),

  // Helper endpoints for form dropdowns
  getAgents: () =>
    request('/agents'),

  getWorkCodeCategories: () =>
    request('/work-codes/categories'),
  
  getWorkCodes: (categoryId = null) =>
    request(categoryId ? `/work-codes/codes/${categoryId}` : '/work-codes/codes'),

  getQueues: () =>
    request('/queues'),

  // Evaluation related methods
  getEvaluation: (id) =>
    request(`/qa/evaluation/${id}`),

  getDashboardMetrics: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/dashboard/metrics${queryString ? `?${queryString}` : ''}`);
  },

  getDashboardFilters: () =>
    request('/dashboard/filters')
};

export default api;