// src/components/Menu.js - Fixed to display correct items for agents
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

// Move the function inside the component so it has access to the state
export default function Menu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [permissions, setPermissions] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFetchingPermissions = useRef(false);
  const [menuConfig, setMenuConfig] = useState([]);

  const getMenuConfig = (userRoles, permissions) => {
    const baseMenu = [
      { 
        icon: Home, 
        path: '/dashboard', 
        label: 'Dashboard',
        permission: 'dashboard.read',
        visibleToAgent: true
      },
      { 
        icon: ClipboardCheck, 
        path: '/evaluations', 
        label: 'QA Evaluations',
        permission: 'qa-forms.read',
        visibleToAgent: true
      },
      { 
        icon: PlusCircle, 
        path: '/new-evaluations', 
        label: 'New Evaluations',
        permission: 'qa-forms.write',
        visibleToAgent: false
      },
      { 
        icon: ClipboardList, 
        path: '/qa-forms', 
        label: 'QA Forms',
        permission: 'qa-forms.read',
        visibleToAgent: false
      },
      { 
        icon: Filter, 
        path: '/criteria', 
        label: 'QA Criteria',
        permission: 'qa-forms.read',
        visibleToAgent: false
      },
      {
        icon: AlarmClock,
        path: '/scheduler',
        label: 'Scheduler',
        permission: 'qa-forms.write',
        visibleToAgent: false
      },
      { 
        icon: UserCheck,
        path: '/agent-comparison', 
        label: 'Agent Comparison',
        permission: 'qa-forms.read',
        visibleToAgent: false
      },
      { 
        icon: TrendingUp,
        path: '/trend-analysis', 
        label: 'Trend Analysis',
        permission: 'qa-forms.read',
        visibleToAgent: false
      },
      { 
        icon: FileDown,
        path: '/exports', 
        label: 'Export Reports',
        permission: 'qa-forms.read',
        visibleToAgent: false
      },
      { 
        icon: UsersRound, 
        path: '/groups', 
        label: 'Group Management',
        permission: 'groups.read',
        visibleToAgent: false
      }
    ];

    // Determine which menu items to show
    let filteredMenu = [...baseMenu];

    if (userRoles && userRoles.isAgent && !userRoles.isAdmin) {
      console.log('User is an agent, filtering menu items');
      filteredMenu = baseMenu.filter(item => item.visibleToAgent);
    }
    
    // Apply permissions filtering if permissions are available
    if (permissions) {
      console.log('Applying permissions filter to menu');
      filteredMenu = filteredMenu.filter(item => hasPermission(permissions, item.permission));
    }
    
    return filteredMenu;
  };

  const hasPermission = (permissions, requiredPermission) => {
    if (!requiredPermission) return true;
    if (!permissions) return true; // Show all items if permissions not loaded yet
    
    const [resource, action] = requiredPermission.split('.');
    return permissions?.[resource]?.[action] === true;
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      // Prevent duplicate fetches
      if (isFetchingPermissions.current) {
        return;
      }
      
      try {
        isFetchingPermissions.current = true;
        
        console.log('Fetching permissions and roles for menu...');
        
        // First, try to get cached permissions
        const cachedPermissions = localStorage.getItem('cachedPermissions');
        let parsedPermissions = null;
        
        if (cachedPermissions) {
          try {
            parsedPermissions = JSON.parse(cachedPermissions);
            setPermissions(parsedPermissions);
            console.log('Using cached permissions');
          } catch (e) {
            console.error('Error parsing cached permissions', e);
          }
        }
        
        // Try to get user roles from localStorage first
        const savedRoles = localStorage.getItem('userRoles');
        let parsedRoles = null;
        
        if (savedRoles) {
          try {
            parsedRoles = JSON.parse(savedRoles);
            setUserRoles(parsedRoles);
            console.log('Using saved roles:', parsedRoles);
          } catch (e) {
            console.error('Error parsing saved roles', e);
          }
        }
        
        // Set initial menu config with whatever data we have
        setMenuConfig(getMenuConfig(parsedRoles, parsedPermissions));
        
        // If we don't have permissions, fetch them
        if (!parsedPermissions) {
          console.log('Fetching permissions from API');
          const perms = await api.getPermissions();
          setPermissions(perms);
          localStorage.setItem('cachedPermissions', JSON.stringify(perms));
          
          // Update menu config with new permissions
          setMenuConfig(getMenuConfig(parsedRoles, perms));
        }
        
        // If we don't have roles, fetch user profile
        if (!parsedRoles) {
          console.log('Fetching user profile for roles');
          const userInfo = await api.getUserProfile();
          
          if (userInfo) {
            const roles = {
              isAgent: userInfo.isAgent === true,
              isAdmin: userInfo.isAdmin === true,
              agentId: userInfo.agentId || userInfo.id
            };
            
            setUserRoles(roles);
            console.log('Setting roles from API:', roles);
            
            // Update menu config with new roles
            setMenuConfig(getMenuConfig(roles, parsedPermissions || permissions));
          }
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        isFetchingPermissions.current = false;
        setLoading(false);
      }
    };
  
    fetchPermissions();
  }, []);

  // Update menu config when roles or permissions change
  useEffect(() => {
    if (userRoles || permissions) {
      console.log('Updating menu config due to role/permission change');
      setMenuConfig(getMenuConfig(userRoles, permissions));
    }
  }, [userRoles, permissions]);

  if (loading) {
    return (
      <div className="bg-light border-end h-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  console.log('Rendering menu with', menuConfig.length, 'items');
  
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