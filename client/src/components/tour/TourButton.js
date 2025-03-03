// src/components/tour/TourButton.js
import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useTour } from './TourProvider';
import { useLocation } from 'react-router-dom';

const TourButton = () => {
  const { startMainTour, startSchedulerTour, startNewEvaluationTour } = useTour();
  const location = useLocation();
  
  const handleStartTour = () => {
    // Determine which tour to start based on current route
    if (location.pathname === '/scheduler') {
      startSchedulerTour();
    } else if (location.pathname === '/new-evaluations') {
      startNewEvaluationTour();
    } else {
      startMainTour();
    }
  };
  
  return (
    <button
      className="btn btn-light"
      onClick={handleStartTour}
      title="Start Tour"
    >
      <HelpCircle size={18} />
    </button>
  );
};

export default TourButton;