// src/components/tour/TourProvider.js
import React, { useEffect, createContext, useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';
import tourService from '../../services/tourService';

// Create context for tour
const TourContext = createContext({
  startMainTour: () => {},
  startSchedulerTour: () => {},
  startNewEvaluationTour: () => {},
  hasSeenTour: false,
  resetTour: () => {}
});

export const useTour = () => useContext(TourContext);

const TourProvider = ({ children }) => {
  const location = useLocation();
  const [hasSeenTour, setHasSeenTour] = useState(tourService.hasSeenTour);
  const [initialized, setInitialized] = useState(false);
  
  // Initialize tour service
  useEffect(() => {
    if (!initialized) {
      tourService.initialize();
      setInitialized(true);
      setHasSeenTour(tourService.hasSeenTour);
    }
  }, [initialized]);
  
  // Start tour on first login if on dashboard
  useEffect(() => {
    if (initialized && location.pathname === '/dashboard' && !hasSeenTour) {
      // Small delay to let components render
      const timer = setTimeout(() => {
        tourService.startMainTour();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [location.pathname, initialized, hasSeenTour]);
  
  // Start section-specific tours
  useEffect(() => {
    if (!initialized) return;
    
    // Show scheduler tour if on scheduler page
    if (location.pathname === '/scheduler' && !localStorage.getItem('hasSeenSchedulerTour')) {
      const timer = setTimeout(() => {
        tourService.startSchedulerTour();
        localStorage.setItem('hasSeenSchedulerTour', 'true');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // Show new evaluation tour if on new evaluations page
    if (location.pathname === '/new-evaluations' && !localStorage.getItem('hasSeenNewEvalTour')) {
      const timer = setTimeout(() => {
        tourService.startNewEvaluationTour();
        localStorage.setItem('hasSeenNewEvalTour', 'true');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [location.pathname, initialized]);
  
  // Tour context value
  const tourContextValue = {
    startMainTour: () => tourService.startMainTour(),
    startSchedulerTour: () => tourService.startSchedulerTour(),
    startNewEvaluationTour: () => tourService.startNewEvaluationTour(),
    hasSeenTour,
    resetTour: () => {
      tourService.resetTour();
      setHasSeenTour(false);
    }
  };
  
  return (
    <TourContext.Provider value={tourContextValue}>
      {children}
    </TourContext.Provider>
  );
};

export default TourProvider;