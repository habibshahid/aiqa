// src/services/apiWrapper.js
import { triggerSessionTimeout } from '../context/AppContext';

export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const requestOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await fetch(url, requestOptions);
    
    if (response.status === 401) {
      // Create a retry function
      const retryRequest = {
        retry: async () => {
          const newToken = localStorage.getItem('token');
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

      // Trigger session timeout with retry function
      triggerSessionTimeout(retryRequest);
      
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