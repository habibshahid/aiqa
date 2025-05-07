// src/pages/GlassmorphismLogin.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Lock, User, AlertCircle, ArrowRight, Shield, CheckCircle } from 'lucide-react';

import '../styles/glassmorphism-login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();
  const [featuresVisible, setFeaturesVisible] = useState(false);

  useEffect(() => {
    // Clear any existing token on the login page
    localStorage.removeItem('token');
    document.title = 'Login | AIQA';
    
    // Add the dynamic background
    document.body.classList.add('glassmorphism-bg');
    
    // Trigger features animation after a delay
    setTimeout(() => {
      setFeaturesVisible(true);
    }, 500);
    
    return () => {
      // Clean up the background class
      document.body.classList.remove('glassmorphism-bg');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setErrorMessage('Username and password are required');
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      const result = await login(username, password);
      
      if (!result.success) {
        throw new Error(result.error || 'Login failed. Please check your credentials.');
      }
      
      // Successful login is handled by the context
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glassmorphism-login-container">
      {/* Animated background shapes */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>
      <div className="shape shape-4"></div>
      
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="glassmorphism-card">
              <div className="row g-0">
                {/* Left side - Features */}
                <div className="col-lg-6 d-none d-lg-block">
                  <div className="features-container">
                    <div className="text-center mb-5">
                      <div className="logo-container">
                        <h1 className="logo-text">AIQA</h1>
                      </div>
                      <p className="tagline">Quality Assurance Reimagined</p>
                    </div>
                    
                    <div className={`feature-item ${featuresVisible ? 'feature-visible' : ''}`} style={{transitionDelay: '0.1s'}}>
                      <div className="feature-icon">
                        <CheckCircle size={24} />
                      </div>
                      <div className="feature-text">
                        <h4>AI-Powered Evaluations</h4>
                        <p>Automated call analysis with precision scoring</p>
                      </div>
                    </div>
                    
                    <div className={`feature-item ${featuresVisible ? 'feature-visible' : ''}`} style={{transitionDelay: '0.2s'}}>
                      <div className="feature-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="feature-text">
                        <h4>Real-time Analytics</h4>
                        <p>Instant insights for performance improvement</p>
                      </div>
                    </div>
                    
                    <div className={`feature-item ${featuresVisible ? 'feature-visible' : ''}`} style={{transitionDelay: '0.3s'}}>
                      <div className="feature-icon">
                        <Shield size={24} />
                      </div>
                      <div className="feature-text">
                        <h4>Secure & Compliant</h4>
                        <p>Enterprise-grade security for your sensitive data</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right side - Login form */}
                <div className="col-lg-6">
                  <div className="login-form-container">
                    <div className="d-block d-lg-none text-center mb-4">
                      <h1 className="logo-text">AIQA</h1>
                      <p className="tagline">Quality Assurance Reimagined</p>
                    </div>
                    
                    <h2 className="welcome-text">Welcome Back</h2>
                    <p className="login-subtitle">Sign in to continue to your dashboard</p>
                    
                    {errorMessage && (
                      <div className="error-message">
                        <AlertCircle size={18} />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                    
                    <form onSubmit={handleSubmit}>
                      <div className="mb-4">
                        <label htmlFor="username" className="form-label">Username</label>
                        <div className="input-group">
                          <span className="input-icon">
                            <User size={18} />
                          </span>
                          <input
                            type="text"
                            className="form-control glassmorphism-input"
                            id="username"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center">
                          <label htmlFor="password" className="form-label">Password</label>
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="showPassword"
                              checked={showPassword}
                              onChange={() => setShowPassword(!showPassword)}
                            />
                            <label className="form-check-label small" htmlFor="showPassword">
                              Show
                            </label>
                          </div>
                        </div>
                        <div className="input-group">
                          <span className="input-icon">
                            <Lock size={18} />
                          </span>
                          <input
                            type={showPassword ? "text" : "password"}
                            className="form-control glassmorphism-input"
                            id="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="d-grid">
                        <button
                          type="submit"
                          className="btn glassmorphism-btn"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                              Signing in...
                            </>
                          ) : (
                            <>
                              Sign In
                              <ArrowRight size={18} className="ms-2" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                    
                    <div className="login-footer">
					  <small>
						Version 1.0 &copy; {new Date().getFullYear()} AIQA. All rights reserved.
						<span className="mx-1">|</span>
						<a 
						  href="https://intellicon.io/aiqa" 
						  target="_blank" 
						  rel="noopener noreferrer" 
						  className="intellicon-link"
						>
						  Powered by Intellicon
						</a>
					  </small>
					</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;