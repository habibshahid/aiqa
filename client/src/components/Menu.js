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
  UsersRound
} from 'lucide-react';
import { api } from '../services/api';

const menuConfig = [
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
    permission: 'qa-forms.read'
  },
  { 
    icon: PlusCircle, 
    path: '/new-evaluations', 
    label: 'New Evaluations',
    permission: 'qa-forms.write'
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
    permission: 'qa-forms.read'
  },
  { 
    icon: UserCheck, // Import this from lucide-react
    path: '/agent-comparison', 
    label: 'Agent Comparison',
    permission: 'qa-forms.read'
  },
  { 
    icon: TrendingUp, // Import this from lucide-react
    path: '/trend-analysis', 
    label: 'Trend Analysis',
    permission: 'qa-forms.read'
  },
  { 
    icon: FileDown, // Import this from lucide-react
    path: '/exports', 
    label: 'Export Reports',
    permission: 'qa-forms.read'
  },
  { 
    icon: UsersRound, 
    path: '/groups', 
    label: 'Group Management',
    permission: 'groups.read'
  },
];

const hasPermission = (permissions, requiredPermission) => {
  if (!requiredPermission) return true;
  const [resource, action] = requiredPermission.split('.');
  return permissions?.[resource]?.[action] === true;
};

export default function Menu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const perms = await api.getPermissions();
        setPermissions(perms);
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