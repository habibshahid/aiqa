// src/components/Menu.js
import React, { useState, useEffect } from 'react';
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

  // Move getMenuConfig inside the component so it has access to userRoles
  const getMenuConfig = () => {
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

    // Now userRoles is in scope
    if (userRoles && userRoles.isAgent && !userRoles.isAdmin) {
      return baseMenu.filter(item => item.visibleToAgent);
    }
    
    return baseMenu;
  };

  const hasPermission = (permissions, requiredPermission) => {
    if (!requiredPermission) return true;
    const [resource, action] = requiredPermission.split('.');
    return permissions?.[resource]?.[action] === true;
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        // Fetch permissions from API
        const perms = await api.getPermissions();
        setPermissions(perms);
        
        // Only fetch user profile if we don't have it yet or if explicitly needed
        if (!userRoles) {
          // Get user role information from localStorage first if available
          const savedRoles = localStorage.getItem('userRoles');
          if (savedRoles) {
            setUserRoles(JSON.parse(savedRoles));
          } else {
            // Only call API if necessary
            const userInfo = await api.getUserProfile();
            const roles = {
              isAgent: userInfo.isAgent === true,
              isAdmin: userInfo.isAdmin === true,
              agentId: userInfo.agentId || userInfo.id
            };
            setUserRoles(roles);
          }
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchPermissions();
  }, []);

  if (loading) {
    return (
      <div className="bg-light border-end h-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const menuConfig = getMenuConfig();
  
  return (
    <div className="bg-light border-end h-100">
      <ul className="nav nav-pills flex-column mb-auto text-center p-0">
        {menuConfig.map((item) => {
          // Check if user has permission to see this menu item
          if (!hasPermission(permissions, item.permission)) {
            return null;
          }

          return (
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
          );
        })}
      </ul>
    </div>
  );
}