// src/context/AppContext.js - Fixed to prevent getUserProfile loop
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SessionTimeoutModal from '../components/SessionTimeoutModal';
import { api } from '../services/api';
import config from '../config';

console.log('Config in AppContext:', config);

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failedRequest, setFailedRequest] = useState(null);
  const isCheckingAuth = useRef(false);
  const navigate = useNavigate();
  
  // Event handler for session timeout from API service
  useEffect(() => {
    const handleSessionTimeout = (event) => {
      setShowSessionModal(true);
    };
    
    window.addEventListener('sessionTimeout', handleSessionTimeout);
    return () => {
      window.removeEventListener('sessionTimeout', handleSessionTimeout);
    };
  }, []);
  
  // Check auth status on mount - with protection against multiple calls
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Prevent multiple simultaneous auth checks
    if (isCheckingAuth.current) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Set flag to true to prevent duplicate calls
      isCheckingAuth.current = true;
      
      // Try to get user profile from localStorage first
      const cachedUser = localStorage.getItem('user');
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        setUser(userData);
      }
      
      // Only call API if needed
      const userData = await api.getUserProfile();
      
      // Update localStorage with fresh data
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Auth check error:', error);
      if (error.message === 'Session expired') {
        setShowSessionModal(true);
      } else {
        localStorage.removeItem('token');
        navigate('/');
      }
    } finally {
      setLoading(false);
      isCheckingAuth.current = false;
    }
  };

  const login = async (username, password) => {
    try {
      const data = await api.login({ username, password });
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Use a more efficient way to store user roles
      // WITHOUT immediately calling getUserProfile() which can cause loops

      console.log('###############################')
      console.log(data)
      console.log('###############################')

      const userRoles = {
        isAgent: data.user.is_agent === 1,
        isAdmin: data.user.is_agent === 0,
        agentId: data.user.is_agent === 1 ? data.user.id : null
      };
      
      localStorage.setItem('userRoles', JSON.stringify(userRoles));
      localStorage.setItem('cachedUserProfile', JSON.stringify({
        ...data.user,
        ...userRoles
      }));
      
      setUser(data.user);
  
      // Resume any pending API requests after successful login
      api.resumeRequest();
      
      // If this was a re-login from session timeout
      if (showSessionModal) {
        setShowSessionModal(false);
        // Don't navigate away - the user should stay on the current page
        // Remove the navigate('/dashboard') line to stay where they are
      } else {
        // Normal login flow - only navigate to dashboard if this is a fresh login
        navigate('/dashboard');
      }
  
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userRoles');
      localStorage.removeItem('cachedUserProfile');
      setUser(null);
      setShowSessionModal(false);
      navigate('/');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AppContext.Provider value={{ user, login, logout }}>
      {children}
      <SessionTimeoutModal
        isOpen={showSessionModal}
        onClose={() => {
          setShowSessionModal(false);
          navigate('/');
        }}
        onLogin={login}
      />
    </AppContext.Provider>
  );
};

export const triggerSessionTimeout = (retryRequest) => {
  const event = new CustomEvent('sessionTimeout', { detail: retryRequest });
  window.dispatchEvent(event);
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export default AppContext;