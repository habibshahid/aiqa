// src/components/tour/TourButton.js
import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTour } from './TourProvider';

/**
 * Tour Button component that allows users to manually start tours
 */
const TourButton = ({ className, variant = 'icon' }) => {
  const location = useLocation();
  const { startMainTour, startSchedulerTour, startNewEvaluationTour } = useTour();

  // Determine which tour to start based on current path
  const handleStartTour = () => {
    if (location.pathname === '/dashboard') {
      startMainTour();
    } else if (location.pathname.includes('/scheduler')) {
      startSchedulerTour();
    } else if (location.pathname.includes('/new-evaluations')) {
      startNewEvaluationTour();
    } else {
      // If not on a page with a specific tour, start the main tour
      startMainTour();
    }
  };

  // Get appropriate text based on current page
  const getTourText = () => {
    if (location.pathname === '/dashboard') {
      return 'Dashboard Tour';
    } else if (location.pathname.includes('/scheduler')) {
      return 'Scheduler Tour';
    } else if (location.pathname.includes('/new-evaluations')) {
      return 'New Evaluations Tour';
    } else {
      return 'Start Tour';
    }
  };

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <button
        className={`btn btn-link p-0 ${className || ''}`}
        onClick={handleStartTour}
        title={`Start ${getTourText()}`}
      >
        <HelpCircle size={20} />
      </button>
    );
  }

  // Text button variant
  return (
    <button
      className={`btn btn-sm btn-outline-info d-flex align-items-center ${className || ''}`}
      onClick={handleStartTour}
    >
      <HelpCircle size={16} className="me-1" />
      {getTourText()}
    </button>
  );
};

export default TourButton;