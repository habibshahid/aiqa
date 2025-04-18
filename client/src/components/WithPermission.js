// src/components/WithPermission.js - Fixed version
import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api';

/**
 * Checks if user has the required permission
 * @param {Object} permissions - User permissions object
 * @param {String} requiredPermission - Required permission in format "resource.action"
 * @returns {Boolean} Whether user has permission
 */
const hasPermission = (permissions, requiredPermission) => {
  if (!requiredPermission) return true;
  if (!permissions) return false;
  
  const [resource, action] = requiredPermission.split('.');
  const result = permissions?.[resource]?.[action] === true;
  
  // For debugging
  console.log(`Permission check: ${requiredPermission} = ${result ? 'GRANTED' : 'DENIED'}`);
  
  return result;
};

export const WithPermission = ({ permission, children }) => {
  const [permissions, setPermissions] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use callback to prevent excessive re-renders
  const fetchPermissions = useCallback(async () => {
    try {
      // Try to get cached permissions first for faster loading
      const cachedPermissions = localStorage.getItem('cachedPermissions');
      let parsedPermissions = null;
      
      if (cachedPermissions) {
        try {
          parsedPermissions = JSON.parse(cachedPermissions);
          setPermissions(parsedPermissions);
        } catch (e) {
          console.error('Error parsing cached permissions:', e);
        }
      }

      // Regardless of cache, fetch fresh permissions from API
      const perms = await api.getPermissions();
      
      // Only update if different from cached to avoid unnecessary re-renders
      if (JSON.stringify(perms) !== JSON.stringify(parsedPermissions)) {
        setPermissions(perms);
        localStorage.setItem('cachedPermissions', JSON.stringify(perms));
      }
      
      // Get user role information
      const savedRoles = localStorage.getItem('userRoles');
      if (savedRoles) {
        try {
          setUserRoles(JSON.parse(savedRoles));
        } catch (e) {
          console.error('Error parsing user roles:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // Keep using cached permissions if API fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Handling for specific permission types
  useEffect(() => {
    if (permissions && permission) {
      // Special handling for agent-specific routes
      if (permission === 'agent-comparison.read' || 
          permission === 'trend-analysis.read' || 
          permission === 'exports.read') {
        
        // Log these specific permission checks for debugging
        console.log(`Agent route permission check: ${permission} = ${hasPermission(permissions, permission)}`);
      }
    }
  }, [permissions, permission]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!hasPermission(permissions, permission)) {
    console.warn(`Access denied - missing permission: ${permission}`);
    return <Navigate to="/dashboard" replace />;
  }

  // If user is agent, add agent props to children
  if (userRoles && userRoles.isAgent && !userRoles.isAdmin) {
    // Clone children and add agent props
    return React.cloneElement(children, {
      agentRestricted: true,
      agentId: userRoles.agentId
    });
  }

  return children;
};

export default WithPermission;