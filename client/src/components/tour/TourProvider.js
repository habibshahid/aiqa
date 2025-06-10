// src/components/tour/TourProvider.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import tourService from '../../services/tourService';

// Create a context for tour functionality
const TourContext = createContext(null);

/**
 * Tour Provider component that automatically starts tours
 * based on the current route
 */
const TourProvider = ({ children }) => {
  const location = useLocation();
  const [initialized, setInitialized] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  // Initialize tours and watch for path changes
  useEffect(() => {
    if (!initialized) {
      tourService.initialize();
      setInitialized(true);
    }

    // Store current path to avoid running tours multiple times
    // on the same path if other state changes cause re-renders
    if (currentPath !== location.pathname) {
      setCurrentPath(location.pathname);
      
      // Only run tours if user has not seen them
      if (!tourService.hasSeenTour) {
        // Start appropriate tour based on path
        if (location.pathname === '/dashboard') {
          // Wait for page to fully render
          setTimeout(() => {
            tourService.startMainTour();
          }, 1000);
        } else if (location.pathname.includes('/scheduler')) {
          setTimeout(() => {
            tourService.startSchedulerTour();
          }, 1000);
        } else if (location.pathname.includes('/new-evaluations')) {
          setTimeout(() => {
            tourService.startNewEvaluationTour();
          }, 1000);
        }
      }
    }
  }, [location, initialized, currentPath]);

  // Methods for manually controlling tours
  const startMainTour = () => tourService.startMainTour();
  const startSchedulerTour = () => tourService.startSchedulerTour();
  const startNewEvaluationTour = () => tourService.startNewEvaluationTour();
  const resetTour = () => tourService.resetTour();
  const markTourAsCompleted = () => tourService.markTourAsCompleted();

  // Create a value object with tour methods and state
  const tourContextValue = {
    hasSeenTour: tourService.hasSeenTour,
    startMainTour,
    startSchedulerTour,
    startNewEvaluationTour,
    resetTour,
    markTourAsCompleted
  };

  // Provide the tour context to children
  return (
    <TourContext.Provider value={tourContextValue}>
      {children}
    </TourContext.Provider>
  );
};

/**
 * Hook to access tour functionality in components
 */
export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
};

export default TourProvider;