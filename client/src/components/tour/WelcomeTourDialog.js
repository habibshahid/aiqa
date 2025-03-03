// src/components/tour/WelcomeTourDialog.js
import React, { useState, useEffect } from 'react';
import { useTour } from './TourProvider';

const WelcomeTourDialog = () => {
  const { startMainTour, hasSeenTour } = useTour();
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    // Only show welcome dialog for first-time users
    if (!hasSeenTour && !localStorage.getItem('hasSeenWelcome')) {
      // Small delay to ensure the app is fully loaded
      const timer = setTimeout(() => {
        setShow(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour]);
  
  const handleStartTour = () => {
    setShow(false);
    localStorage.setItem('hasSeenWelcome', 'true');
    startMainTour();
  };
  
  const handleSkipTour = () => {
    setShow(false);
    localStorage.setItem('hasSeenWelcome', 'true');
    localStorage.setItem('hasSeenTour', 'true');
  };
  
  if (!show) return null;
  
  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
      <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Welcome to AIQA!</h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={handleSkipTour}
              ></button>
            </div>
            <div className="modal-body">
              <div className="text-center mb-4">
                <div className="display-1 text-primary mb-3">
                  <i className="bi bi-graph-up-arrow"></i>
                </div>
                <h4>Welcome to the AI Quality Assessment System</h4>
                <p className="text-muted">
                  Your intelligent platform for automating call quality evaluations.
                </p>
              </div>
              
              <p>
                This system helps you:
              </p>
              
              <ul className="mb-4">
                <li>Automate quality evaluations of customer interactions</li>
                <li>Schedule regular quality assessments</li>
                <li>Analyze agent performance trends</li>
                <li>Generate comprehensive reports</li>
              </ul>
              
              <p>
                Would you like a quick tour of the main features?
              </p>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-outline-secondary" 
                onClick={handleSkipTour}
              >
                Skip Tour
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleStartTour}
              >
                Start Tour
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WelcomeTourDialog;