// src/components/WithPermission.js
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api';

const hasPermission = (permissions, requiredPermission) => {
  if (!requiredPermission) return true;
  const [resource, action] = requiredPermission.split('.');
  return permissions?.[resource]?.[action] === true;
};

export const WithPermission = ({ permission, children }) => {
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
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!hasPermission(permissions, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};