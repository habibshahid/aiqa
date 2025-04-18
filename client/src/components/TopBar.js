// src/components/TopBar.js - Fixed to prevent getUserProfile loop
import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, User, ChevronDown, Settings, Info, LogOut, Key,
  Home, ClipboardCheck, PlusCircle, ClipboardList, Filter,
  UserCheck, TrendingUp, FileDown, AlarmClock, FileText, Pencil,
  HelpCircle, UsersRound 
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { ListChecks } from 'lucide-react';
import { useTour } from './tour/TourProvider';
import TourButton from './tour/TourButton';

// Map of routes to page titles and icons
const pageTitles = {
  '/dashboard': { title: 'Dashboard', icon: Home },
  '/evaluations': { title: 'QA Evaluations', icon: ClipboardCheck },
  '/new-evaluations': { title: 'New Evaluations', icon: PlusCircle },
  '/qa-forms': { title: 'QA Forms', icon: ClipboardList },
  '/criteria': { title: 'QA Criteria', icon: Filter },
  '/scheduler': { title: 'Scheduler Dashboard', icon: AlarmClock },
  '/agent-comparison': { title: 'Agent Comparison', icon: UserCheck },
  '/trend-analysis': { title: 'Trend Analysis', icon: TrendingUp },
  '/exports': { title: 'Export Reports', icon: FileDown },
  '/agent-coaching': { title: 'Agent Coaching', icon: UserCheck },
  '/queue-monitor': { title: 'Queue Monitor', icon: ListChecks },
  '/change-password': { title: 'Change Password', icon: Key },
  '/groups': { title: 'Groups Management', icon: UsersRound },
  '/documentation': { title: 'Documentation', icon: FileText },
};

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useApp();
  const { resetTour, startMainTour } = useTour();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications] = useState([]);
  const [user, setUser] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [pageTitle, setPageTitle] = useState({ title: 'AIQA', icon: Home });
  const isLoadingUserData = useRef(false);
  
  useEffect(() => {
    loadUserData();

    // Try to get user roles from localStorage
    const savedRoles = localStorage.getItem('userRoles');
    if (savedRoles) {
      try {
        setUserRoles(JSON.parse(savedRoles));
      } catch (e) {
        console.error('Error parsing user roles', e);
      }
    }
    
    const fetchQueueCount = async () => {
      if (!userRoles || userRoles.isAdmin) {
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
      }
    };
    
    fetchQueueCount();
    const intervalId = setInterval(fetchQueueCount, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [userRoles]);

  // Update page title based on current route
  useEffect(() => {
    // For exact route matches
    if (pageTitles[location.pathname]) {
      setPageTitle(pageTitles[location.pathname]);
      document.title = `${pageTitles[location.pathname].title} | AIQA`;
      return;
    }

    // For dynamic routes that start with a specific path
    const dynamicRoutes = [
      { prefix: '/evaluation/', title: 'Evaluation Details', icon: FileText },
      { prefix: '/agent-coaching/', title: 'Agent Coaching', icon: UserCheck },
      { prefix: '/qa-forms/edit/', title: 'Edit QA Form', icon: ClipboardList },
      { prefix: '/qa-forms/new', title: 'New QA Form', icon: ClipboardList },
      { prefix: '/criteria/edit/', title: 'Edit Criteria Profile', icon: Filter },
      { prefix: '/criteria/new', title: 'New Criteria Profile', icon: Filter },
    ];

    for (const route of dynamicRoutes) {
      if (location.pathname.startsWith(route.prefix)) {
        setPageTitle(route);
        document.title = `${route.title} | AIQA`;
        return;
      }
    }

    // Default fallback
    setPageTitle({ title: 'AIQA', icon: Home });
    document.title = 'AIQA';
  }, [location.pathname]);

  const loadUserData = async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingUserData.current) {
      return;
    }
    
    try {
      isLoadingUserData.current = true;
      
      // Try to get user data from localStorage first
      const userString = localStorage.getItem('user');
      if (userString) {
        try {
          const cachedUser = JSON.parse(userString);
          setUser(cachedUser);
        } catch (e) {
          console.error('Error parsing cached user data', e);
        }
      }
      
      // Only make API call if we don't have user data yet
      if (!user) {
        const userData = await api.getUserProfile();
        setUser(userData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      isLoadingUserData.current = false;
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
      localStorage.removeItem('userRoles');
      localStorage.removeItem('cachedUserProfile');
      localStorage.removeItem('cachedPermissions');
      navigate('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Get the current page icon component
  const PageIcon = pageTitle.icon;

  return (
    <div className="bg-white border-bottom">
      <div className="d-flex justify-content-between align-items-center px-4 py-2">
        <div className="d-flex align-items-center">
          <h5 className="mb-0 d-flex align-items-center">
            {PageIcon && <PageIcon size={18} className="me-2" />}
            {pageTitle.title}
          </h5>
        </div>

        <div className="d-flex align-items-center gap-3">
          {/* Tour Button */}
          <TourButton />

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
          {(!userRoles || userRoles.isAdmin) && (
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
          )}
          
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
                  
                  <button 
                    onClick={() => navigate('/documentation')}
                    className="dropdown-item d-flex align-items-center gap-2"
                  >
                    <FileText size={16} />
                    Documentation
                  </button>
                  
                  <button 
                    onClick={() => {
                      resetTour();
                      startMainTour();
                      setShowUserMenu(false);
                    }}
                    className="dropdown-item d-flex align-items-center gap-2"
                  >
                    <HelpCircle size={16} />
                    Restart Tour
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