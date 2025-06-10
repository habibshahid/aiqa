// src/context/AppContext.js - Fixed to prevent session modal from showing when logged out
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SessionTimeoutModal from '../components/SessionTimeoutModal';
import { api } from '../services/api';
import config from '../config';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failedRequest, setFailedRequest] = useState(null);
  const isCheckingAuth = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Event handler for session timeout from API service
  useEffect(() => {
    const handleSessionTimeout = (event) => {
      // Only show the session modal if we're not already on the login page
      if (location.pathname !== '/') {
        setShowSessionModal(true);
      }
    };
    
    window.addEventListener('sessionTimeout', handleSessionTimeout);
    return () => {
      window.removeEventListener('sessionTimeout', handleSessionTimeout);
    };
  }, [location.pathname]);
  
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
      setUser(null);
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
      if (error.message === 'Session expired' && location.pathname !== '/') {
        // Only show session modal if not on login page
        setShowSessionModal(true);
      } else {
        // Clear token and user data on auth failure
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userRoles');
        localStorage.removeItem('cachedUserProfile');
        localStorage.removeItem('cachedPermissions');
        setUser(null);
        
        // Only navigate to login if not already there
        if (location.pathname !== '/') {
          navigate('/');
        }
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
      localStorage.removeItem('cachedPermissions');
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
      {showSessionModal && (
        <SessionTimeoutModal
          isOpen={showSessionModal}
          onClose={() => {
            setShowSessionModal(false);
            navigate('/');
          }}
          onLogin={login}
        />
      )}
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