// src/components/Menu.js - Updated to align with App.js permission mappings
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileCheck, 
  ClipboardCheck, 
  ClipboardList, 
  Users, 
  Settings, 
  Filter, 
  PlusCircle, 
  UserCheck, 
  TrendingUp, 
  FileDown,
  UsersRound,
  AlarmClock,
  FileText
} from 'lucide-react';
import { api } from '../services/api';

export default function Menu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [permissions, setPermissions] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFetchingPermissions = useRef(false);
  const [menuConfig, setMenuConfig] = useState([]);

  const getMenuConfig = (permissions) => {
    // Define all possible menu items with their required permissions
    // These match exactly with the permissions used in App.js
    const allMenuItems = [
      { 
        icon: Home, 
        path: '/dashboard', 
        label: 'Dashboard',
        permission: 'dashboard.read'
      },
      { 
        icon: ClipboardCheck, 
        path: '/evaluations', 
        label: 'QA Evaluations',
        permission: 'evaluations.read'
      },
      { 
        icon: PlusCircle, 
        path: '/new-evaluations', 
        label: 'New Evaluations',
        permission: 'evaluations.write'
      },
      { 
        icon: ClipboardList, 
        path: '/qa-forms', 
        label: 'QA Forms',
        permission: 'qa-forms.read'
      },
      { 
        icon: Filter, 
        path: '/criteria', 
        label: 'QA Criteria',
        permission: 'criteria.read'
      },
      {
        icon: AlarmClock,
        path: '/scheduler',
        label: 'Scheduler',
        permission: 'qa-forms.write'
      },
      { 
        icon: UserCheck,
        path: '/agent-comparison', 
        label: 'Agent Comparison',
        permission: 'agent-comparison.read'
      },
      { 
        icon: TrendingUp,
        path: '/trend-analysis', 
        label: 'Trend Analysis',
        permission: 'trend-analysis.read'
      },
      { 
        icon: FileDown,
        path: '/exports', 
        label: 'Export Reports',
        permission: 'exports.read'
      },
      { 
        icon: UsersRound, 
        path: '/groups', 
        label: 'Group Management',
        permission: 'groups.read'
      }
    ];

    // Filter menu items based on permissions
    if (!permissions) {
      console.log('No permissions data available for menu filtering');
      return [];
    }
    
    console.log('Filtering menu with permissions:', permissions);
    
    const filteredItems = allMenuItems.filter(item => {
      const [resource, action] = item.permission.split('.');
      const hasPermission = permissions[resource]?.[action] === true;
      
      console.log(`Menu item "${item.label}" (${item.permission}): ${hasPermission ? 'GRANTED' : 'DENIED'}`);
      
      return hasPermission;
    });
    
    console.log(`Menu will display ${filteredItems.length} items based on permissions`);
    return filteredItems;
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      // Prevent duplicate fetches
      if (isFetchingPermissions.current) {
        return;
      }
      
      try {
        isFetchingPermissions.current = true;
        setLoading(true);
        
        console.log('Fetching permissions for menu...');
        
        // Try to get cached permissions first for faster loading
        const cachedPermissions = localStorage.getItem('cachedPermissions');
        if (cachedPermissions) {
          try {
            const parsedPermissions = JSON.parse(cachedPermissions);
            console.log('Using cached permissions first:', parsedPermissions);
            setPermissions(parsedPermissions);
            setMenuConfig(getMenuConfig(parsedPermissions));
          } catch (e) {
            console.error('Error parsing cached permissions', e);
          }
        }
        
        // Get fresh permissions from API
        const perms = await api.getPermissions();
        console.log('Received fresh permissions from API:', perms);
        
        // Update permissions and menu config
        setPermissions(perms);
        setMenuConfig(getMenuConfig(perms));
        
        // Cache permissions for faster loading next time
        localStorage.setItem('cachedPermissions', JSON.stringify(perms));
        
        // Try to get user roles from localStorage
        const savedRoles = localStorage.getItem('userRoles');
        if (savedRoles) {
          try {
            setUserRoles(JSON.parse(savedRoles));
          } catch (e) {
            console.error('Error parsing saved roles', e);
          }
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        
        // Try to use cached permissions if API call fails
        const cachedPermissions = localStorage.getItem('cachedPermissions');
        if (cachedPermissions) {
          try {
            const parsedPermissions = JSON.parse(cachedPermissions);
            setPermissions(parsedPermissions);
            setMenuConfig(getMenuConfig(parsedPermissions));
          } catch (e) {
            console.error('Error parsing cached permissions', e);
          }
        }
      } finally {
        isFetchingPermissions.current = false;
        setLoading(false);
      }
    };
  
    fetchPermissions();
  }, []);

  if (loading && menuConfig.length === 0) {
    return (
      <div className="bg-light border-end h-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Add debug information for empty menu
  if (menuConfig.length === 0) {
    console.warn('Menu has no items. This may indicate a permissions issue.');
  }
  
  return (
    <div className="bg-light border-end h-100">
      <ul className="nav nav-pills flex-column mb-auto text-center p-0">
        {menuConfig.map((item) => (
          <li key={item.path} className="nav-item">
            <button 
              onClick={() => navigate(item.path)}
              className={`nav-link border-0 rounded-0 py-3 d-flex align-items-center justify-content-center ${
                location.pathname === item.path ? 'active' : ''
              }`}
              title={item.label}
            >
              <item.icon size={20} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}