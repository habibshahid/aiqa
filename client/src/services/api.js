// src/services/api.js - Fixed to prevent infinite getUserProfile loops
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

// Flag to prevent getUserProfile recursion
let isGettingUserProfile = false;

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
  
  // Fixed getUserProfile to prevent recursion
  getUserProfile: async () => {
    // Return cached user data if available to prevent repeated calls
    const cachedUserData = localStorage.getItem('cachedUserProfile');
    if (cachedUserData) {
      try {
        const userData = JSON.parse(cachedUserData);
        
        // If we have complete user data cached, return it
        if (userData && userData.id && (userData.isAgent !== undefined || userData.isAdmin !== undefined)) {
          return userData;
        }
      } catch (e) {
        console.error('Error parsing cached user profile', e);
        // Continue to fetch fresh data if cache parsing fails
      }
    }
    
    // Use a flag to prevent recursive calls during the same execution cycle
    if (isGettingUserProfile) {
      // If already fetching, return a promise that resolves with empty user data
      return { id: null, isAgent: false, isAdmin: false };
    }
    
    try {
      isGettingUserProfile = true;
      const userData = await request('/user/profile');
      
      // Store user role information in localStorage for easy access
      const userRoles = {
        isAgent: userData.isAgent === true,
        isAdmin: userData.isAdmin === true,
        agentId: userData.agentId || userData.id
      };
      
      // Update user roles in localStorage
      localStorage.setItem('userRoles', JSON.stringify(userRoles));
      
      // Cache the complete user profile to reduce API calls
      const completeUserData = {
        ...userData,
        ...userRoles
      };
      localStorage.setItem('cachedUserProfile', JSON.stringify(completeUserData));
      
      return completeUserData;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    } finally {
      isGettingUserProfile = false;
    }
  },

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
  getPermissions: async () => {
    try {
      console.log('Fetching permissions from API...');
      const response = await request('/user/permissions');
      
      // Validate that we got an object with expected structure
      if (response && typeof response === 'object') {
        console.log('Successfully fetched permissions:', response);
        
        // Cache valid permissions
        localStorage.setItem('cachedPermissions', JSON.stringify(response));
        return response;
      } else {
        throw new Error('Invalid permissions data format');
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      
      // Try to use cached permissions first
      const cachedPermissions = localStorage.getItem('cachedPermissions');
      if (cachedPermissions) {
        try {
          const parsedPermissions = JSON.parse(cachedPermissions);
          console.log('Using cached permissions:', parsedPermissions);
          return parsedPermissions;
        } catch (e) {
          console.error('Error parsing cached permissions:', e);
        }
      }
      
      // Get user roles from localStorage as a fallback
      const userRolesStr = localStorage.getItem('userRoles');
      let userRoles = null;
      
      if (userRolesStr) {
        try {
          userRoles = JSON.parse(userRolesStr);
        } catch (e) {
          console.error('Error parsing user roles:', e);
        }
      }
      
      // Create sensible default permissions based on roles
      const defaultPermissions = {
        'dashboard': { 'read': true },
        'evaluations': { 'read': true }
      };
      
      // If user is an agent, give them the specific agent permissions
      if (userRoles && userRoles.isAgent) {
        // Add appropriate evaluations permissions
        defaultPermissions['evaluations'] = { 'read': true, 'write': true };
        
        // Add agent-specific permissions from the example you provided
        defaultPermissions['exports'] = { 'read': true };
        defaultPermissions['trend-analysis'] = { 'read': true };
        defaultPermissions['agent-comparison'] = { 'read': true };
      }
      
      // If user is admin, give them more permissions
      if (userRoles && userRoles.isAdmin) {
        defaultPermissions['qa-forms'] = { 'read': true, 'write': true };
        defaultPermissions['criteria'] = { 'read': true, 'write': true };
        defaultPermissions['groups'] = { 'read': true, 'write': true };
        defaultPermissions['settings'] = { 'read': true, 'write': true };
      }
      
      console.log('Using fallback default permissions:', defaultPermissions);
      return defaultPermissions;
    }
  },

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
    request('/dashboard/filters'),

  getSchedulerSettings: (profileId) =>
    request(`/scheduler/profile/${profileId}`),

  // Update scheduler settings for a criteria profile
  updateSchedulerSettings: (profileId, schedulerConfig) =>
    request(`/scheduler/profile/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(schedulerConfig)
    }),

  // Run a scheduled evaluation manually
  runScheduledEvaluation: (profileId, maxEvaluations) =>
    request(`/scheduler/run/${profileId}`, {
      method: 'POST',
      body: JSON.stringify({ maxEvaluations })
    }),

  // Get scheduler history for a profile
  getSchedulerHistory: (profileId, limit = 10) =>
    request(`/scheduler/history/${profileId}?limit=${limit}`),

  // Get all active scheduled profiles
  getActiveSchedules: () =>
    request('/scheduler/active')
};
  
export default api;