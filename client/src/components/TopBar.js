// src/components/TopBar.js
import React, { useState, useEffect } from 'react';
import { Bell, User, ChevronDown, Settings, Info, LogOut, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { ListChecks } from 'lucide-react';

export default function TopBar() {
  const navigate = useNavigate();
  const { logout } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  
  useEffect(() => {
    loadUserData();
    const fetchQueueCount = async () => {
      try {
        const response = await fetch('/api/qa-process/queue-count', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setQueueCount(data.count);
        }
      } catch (error) {
        console.error('Error fetching queue count:', error);
      }
    };
    
    fetchQueueCount();
    const intervalId = setInterval(fetchQueueCount, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await api.getUserProfile();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const onLogoutClick = async () => {
    if (isLoggingOut) return; // Prevent double clicks
    
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="bg-white border-bottom">
      <div className="d-flex justify-content-between align-items-center px-4 py-2">
        <div className="d-flex align-items-center">
          <h5 className="mb-0 me-4">AIQA</h5>
        </div>

        <div className="d-flex align-items-center gap-3">
          {/* Notifications */}
          <div className="position-relative">
            <button 
              className="btn btn-light position-relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="position-absolute end-0 mt-2 bg-white border rounded shadow-sm" 
                   style={{ width: '300px', zIndex: 1000 }}>
                <div className="p-2 border-bottom">
                  <h6 className="mb-0">Notifications</h6>
                </div>
                <div className="py-2">
                  {notifications.length > 0 ? (
                    notifications.map(notification => (
                      <div key={notification.id} className="px-3 py-2 border-bottom">
                        <div className="small">{notification.message}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{notification.time}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-muted text-center">No notifications</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Queue Monitor */}
          <div className="position-relative">
            <button 
              className="btn btn-light position-relative"
              onClick={() => navigate('/queue-monitor')}
            >
              <ListChecks size={18} />
              {queueCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-primary">
                  {queueCount}
                </span>
              )}
            </button>
          </div>
          
          {/* User Profile Dropdown */}
          <div className="position-relative">
            <button 
              className="btn btn-light d-flex align-items-center gap-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <User size={18} />
              <span>{user?.username || 'Profile'}</span>
              <ChevronDown size={16} />
            </button>

            {showUserMenu && (
              <div className="position-absolute end-0 mt-2 bg-white border rounded shadow-sm" 
                   style={{ width: '220px', zIndex: 1000 }}>
                <div className="py-1">
                  <button 
                    onClick={() => navigate('/change-password')}
                    className="dropdown-item d-flex align-items-center gap-2"
                  >
                    <Key size={16} />
                    Change Password
                  </button>
                  
                  <button 
                    onClick={() => navigate('/settings')}
                    className="dropdown-item d-flex align-items-center gap-2"
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  
                  <div className="dropdown-divider"></div>
                  
                  <div className="px-3 py-1">
                    <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '0.875rem' }}>
                      <Info size={14} />
                      Version 1.0.0
                    </div>
                  </div>
                  
                  <div className="dropdown-divider"></div>
                  
                  <button 
                    onClick={onLogoutClick}
                    disabled={isLoggingOut}
                    className="dropdown-item d-flex align-items-center gap-2 text-danger"
                  >
                    <LogOut size={16} />
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}