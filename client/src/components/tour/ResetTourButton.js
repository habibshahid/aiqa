// src/components/tour/ResetTourButton.js
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTour } from './TourProvider';

/**
 * Button component to reset tour viewed status
 * Can be used in profile dropdown menu
 */
const ResetTourButton = ({ className, variant = 'menu-item' }) => {
  const { resetTour } = useTour();

  const handleResetTour = () => {
    resetTour();
    // Optional: Show confirmation toast or message
    alert('Tours have been reset. The tour will start automatically on your next visit to the dashboard.');
  };

  // Menu item variant (for dropdowns)
  if (variant === 'menu-item') {
    return (
      <button
        className={`dropdown-item d-flex align-items-center ${className || ''}`}
        onClick={handleResetTour}
      >
        <RefreshCw size={16} className="me-2" />
        Reset Interactive Tours
      </button>
    );
  }

  // Button variant
  return (
    <button
      className={`btn btn-sm btn-outline-secondary d-flex align-items-center ${className || ''}`}
      onClick={handleResetTour}
    >
      <RefreshCw size={16} className="me-1" />
      Reset Tours
    </button>
  );
};

export default ResetTourButton;