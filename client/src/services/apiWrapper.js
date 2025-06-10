// src/services/apiWrapper.js
import { triggerSessionTimeout } from '../context/AppContext';

export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  // If no token exists, don't attempt authenticated requests
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  const requestOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await fetch(url, requestOptions);
    
    if (response.status === 401) {
      // Check if we're already on the login page to avoid showing session timeout
      const isLoginPage = window.location.pathname === '/';
      
      // Create a retry function
      const retryRequest = {
        retry: async () => {
          const newToken = localStorage.getItem('token');
          if (!newToken) {
            throw new Error('Still no authentication token available after re-login');
          }
          
          const retriedResponse = await fetch(url, {
            ...requestOptions,
            headers: {
              ...requestOptions.headers,
              'Authorization': `Bearer ${newToken}`
            }
          });
          
          if (!retriedResponse.ok) {
            throw new Error('Request failed after re-authentication');
          }
          
          return retriedResponse.json();
        }
      };

      // Only trigger session timeout if not already on login page
      if (!isLoginPage) {
        triggerSessionTimeout(retryRequest);
      }
      
      // Return a promise that will be resolved after re-authentication
      return new Promise((resolve, reject) => {
        retryRequest.resolve = resolve;
        retryRequest.reject = reject;
      });
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};