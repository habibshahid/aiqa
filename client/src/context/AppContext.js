// src/context/AppContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
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
  
  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await api.getUserProfile();
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
    }
  };

  const login = async (username, password) => {
    try {
      const data = await api.login({ username, password });
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user)); // Store user info
      setUser(data.user);
  
      // Resume any pending API requests after successful login
      api.resumeRequest();
      
      // If this was a re-login from session timeout
      if (showSessionModal) {
        setShowSessionModal(false);
      } else {
        // Normal login flow
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