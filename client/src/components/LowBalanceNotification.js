// client/src/components/LowBalanceNotification.js
import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LowBalanceNotification = () => {
  const [show, setShow] = useState(false);
  const [balance, setBalance] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  
  // Check if notification has been dismissed recently
  useEffect(() => {
    const lastDismissed = localStorage.getItem('lowBalanceNotificationDismissed');
    if (lastDismissed) {
      // Check if it was dismissed within the last 24 hours
      const dismissedTime = parseInt(lastDismissed, 10);
      const now = Date.now();
      const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
      
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
      } else {
        // Reset dismissal after 24 hours
        localStorage.removeItem('lowBalanceNotificationDismissed');
      }
    }
  }, []);
  
  // Check credit balance
  useEffect(() => {
    // Only check balance if not dismissed
    if (dismissed) return;
    
    const checkBalance = async () => {
      try {
        const response = await fetch('api/credits/balance', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          // Silently fail if we can't get the balance
          return;
        }
        
        const data = await response.json();
        setBalance(data);
        
        // Show notification if balance is low
        setShow(data.is_low);
      } catch (error) {
        console.error('Error checking credit balance:', error);
        // Silently fail - don't show an error for this background check
      }
    };
    
    // Check on component mount
    checkBalance();
    
    // Set up interval to check every hour
    const intervalId = setInterval(checkBalance, 60 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [dismissed]);
  
  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    
    // Save dismissal timestamp
    localStorage.setItem('lowBalanceNotificationDismissed', Date.now().toString());
  };
  
  const handleGoToBilling = () => {
    navigate('/billing-usage');
    handleDismiss();
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // Don't render anything if not shown
  if (!show || !balance) {
    return null;
  }
  
  return (
    <div className="alert alert-warning alert-dismissible fade show" role="alert">
      <div className="d-flex align-items-center">
        <AlertTriangle size={20} className="me-2" />
        <div>
          <strong>Low Credit Balance:</strong>{' '}
          Your current balance is {formatCurrency(balance.current_balance)}.
          {balance.current_balance <= 0 ? (
            <span className="text-danger fw-bold"> You need to add credits to continue using the service.</span>
          ) : (
            <span> This is below the {balance.low_balance_threshold}% threshold.</span>
          )}
        </div>
      </div>
      <div className="mt-2">
        <button 
          className="btn btn-sm btn-primary me-2" 
          onClick={handleGoToBilling}
        >
          <DollarSign size={14} className="me-1" />
          Add Credits
        </button>
        <button 
          className="btn btn-sm btn-outline-secondary" 
          onClick={handleDismiss}
        >
          Dismiss for 24 hours
        </button>
      </div>
      <button 
        type="button" 
        className="btn-close" 
        onClick={handleDismiss}
        aria-label="Close"
      ></button>
    </div>
  );
};

export default LowBalanceNotification;