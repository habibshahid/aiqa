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
      // Use the login function from context instead of directly calling fetch
      const result = await login(credentials.username, credentials.password);
      
      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }
      
      // If we get here, login was successful
      // Don't navigate away or close the modal - the AppContext will handle it
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Use a non-destructive overlay that doesn't remove content */}
      <div 
        className="modal-backdrop show" 
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
        className="modal" 
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
            <div className="modal-header">
              <h5 className="modal-title">Session Expired</h5>
            </div>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger">{error}</div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
                    Go to Login Page
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}