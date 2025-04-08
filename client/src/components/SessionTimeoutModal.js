// src/components/SessionTimeoutModal.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function SessionTimeoutModal({ isOpen, onClose, onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useApp();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(credentials.username, credentials.password);
      
      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }
      
      // Success is handled by the login function in AppContext
      // This prevents the modal from redirecting unnecessarily
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Make the overlay semi-transparent instead of fully opaque */}
      <div 
        className="modal-backdrop fade show" 
        style={{ 
          opacity: 0.5,  // Make it semi-transparent
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1040
        }} 
      />
      <div 
        className="modal show" 
        style={{ 
          display: 'block', 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1050,
          overflow: 'auto'
        }}
        tabIndex="-1"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            {/* Rest of modal content remains the same */}
          </div>
        </div>
      </div>
    </>
  );
}