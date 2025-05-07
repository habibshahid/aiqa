// src/services/api.js - Fixed to include evaluation detail access for agents
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

  // Evaluation related methods - MODIFIED to better handle agent access
  getEvaluation: async (id) => {
    try {
      console.log(`Fetching evaluation ${id}`);
      
      // First check if user is an agent from localStorage
      const userRolesStr = localStorage.getItem('userRoles');
      let userRoles = null;
      
      if (userRolesStr) {
        try {
          userRoles = JSON.parse(userRolesStr);
        } catch (e) {
          console.error('Error parsing user roles:', e);
        }
      }
      
      // Make the request
      const result = await request(`/qa/evaluation/${id}`);
      
      // If user is an agent, check if this evaluation belongs to them
      if (userRoles && userRoles.isAgent && !userRoles.isAdmin) {
        console.log(`Agent ${userRoles.agentId} checking access to evaluation for agent ${result.agent?.id}`);
        
        if (result.agent?.id != userRoles.agentId) {
          console.error('Access denied: This evaluation belongs to another agent');
          throw new Error('You do not have permission to view this evaluation');
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching evaluation:', error);
      throw error;
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
    request('auth/logout', {  
      method: 'POST'
    }),
  
  // Fixed getUserProfile to prevent recursion
  getUserProfile: async () => {
    try {
      const userData = await request('user/profile');
      
      // Get correct role information from userRoles in localStorage
      const userRolesStr = localStorage.getItem('userRoles');
      
      console.log('User profile fetched:', userData);
      // Update userRoles in localStorage
      localStorage.setItem('userRoles', JSON.stringify({
        isAgent: (userData.isAgent === 1) ? true : false,
        isAdmin: (userData.isAdmin === 1) ? true : false,
        agentId: (userData.agentId) ? userData.agentId : null
      }));
      
      // Update cachedUserProfile
      localStorage.setItem('cachedUserProfile', JSON.stringify({
        ...userData,
        isAgent: userData.isAgent,
        isAdmin: userData.isAdmin,
        agentId: userData.agentId
      }));
      
      return userData;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },

  updateProfile: (profileData) =>
    request('user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    }),

  changePassword: (passwords) =>
    request('user/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords)
    }),

  // Permissions related methods
  getPermissions: async () => {
    try {
      console.log('Fetching permissions from API...');
      const response = await request('user/permissions');
      
      // Validate that we got an object with expected structure
      if (response && typeof response === 'object') {
        console.log('Successfully fetched permissions:', response);
        
        // Cache valid permissions
        localStorage.setItem('cachedPermissions', JSON.stringify(response));
        
        // Ensure evaluations.read permission exists for agents
        // This is critical for agent access to their evaluations
        const userRolesStr = localStorage.getItem('userRoles');
        if (userRolesStr) {
          try {
            const userRoles = JSON.parse(userRolesStr);
            if (userRoles.isAgent && !userRoles.isAdmin) {
              // Ensure agent has evaluation read permission
              if (!response.evaluations) {
                response.evaluations = {};
              }
              response.evaluations.read = true;
              
              // Update cache with this critical permission
              localStorage.setItem('cachedPermissions', JSON.stringify(response));
            }
          } catch (e) {
            console.error('Error checking user roles for permission adjustment:', e);
          }
        }
        
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
    request('/scheduler/active'),

  disputeEvaluation: (id, comments) =>
    request(`/qa/evaluation/${id}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ 
        agentComments: comments
      })
    }),
};
  
export default api;