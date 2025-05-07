// client/src/components/CreditBalance.js
import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, AlertTriangle, Plus, Upload, Download, RefreshCw } from 'lucide-react';

const CreditBalance = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(null);
  const [stats, setStats] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addingCredits, setAddingCredits] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const fetchCreditData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch credit balance
      const balanceResponse = await fetch('api/credits/balance', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!balanceResponse.ok) {
        throw new Error(`Failed to fetch credit balance: ${balanceResponse.status}`);
      }
      
      const balanceData = await balanceResponse.json();
      setBalance(balanceData);
      
      // Fetch credit stats
      const statsResponse = await fetch('api/credits/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch credit stats: ${statsResponse.status}`);
      }
      
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching credit data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddCredits = async () => {
    try {
      setAddingCredits(true);
      setError(null);
      
      if (!addAmount || parseFloat(addAmount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      
      const response = await fetch('api/credits/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(addAmount),
          description: addDescription || 'Added from billing dashboard'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add credits');
      }
      
      const result = await response.json();
      
      // Show success message
      setSuccessMessage(`Successfully added $${parseFloat(addAmount).toFixed(2)} credits`);
      
      // Reset form
      setAddAmount('');
      setAddDescription('');
      setShowAddModal(false);
      
      // Refresh data
      fetchCreditData();
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Error adding credits:', err);
      setError(err.message);
    } finally {
      setAddingCredits(false);
    }
  };
  
  // Fetch credit data on component mount
  useEffect(() => {
    fetchCreditData();
  }, []);
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center p-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 mb-0">Loading credit information...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-danger mb-0">
            <h5>Error loading credit information</h5>
            <p className="mb-2">{error}</p>
            <button className="btn btn-outline-danger btn-sm" onClick={fetchCreditData}>
              <RefreshCw size={14} className="me-1" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0">
          <CreditCard size={18} className="me-2" />
          Credit Balance
        </h5>
        <div>
          <button 
            className="btn btn-outline-primary btn-sm me-2"
            onClick={fetchCreditData}
          >
            <RefreshCw size={14} className="me-1" />
            Refresh
          </button>
        </div>
      </div>
      <div className="card-body">
        {successMessage && (
          <div className="alert alert-success alert-dismissible fade show">
            {successMessage}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSuccessMessage(null)}
            ></button>
          </div>
        )}
        
        {balance?.is_low && (
          <div className="alert alert-warning d-flex align-items-center mb-4">
            <AlertTriangle size={18} className="me-2" />
            <div>
              <strong>Low Balance Alert:</strong> Your credit balance is below the {balance.low_balance_threshold}% threshold.
              Consider adding more credits to continue using the service.
            </div>
          </div>
        )}
        
        <div className="row">
          <div className="col-md-6 mb-4">
            <div className={`card h-100 ${balance?.is_low ? 'border-warning' : 'border-success'}`}>
              <div className={`card-body ${balance?.is_low ? 'bg-warning bg-opacity-10' : 'bg-success bg-opacity-10'}`}>
                <h5 className="card-title text-muted mb-3">Current Balance</h5>
                <h2 className="mb-0">
                  <DollarSign size={32} className="me-2" />
                  {balance ? formatCurrency(balance.current_balance) : '$0.00'}
                </h2>
                {stats && (
                  <small className="text-muted">
                    {stats.usage_percent > 0 
                      ? `${stats.usage_percent.toFixed(1)}% of ${formatCurrency(stats.total_added)} total credits used`
                      : 'No credits used yet'}
                  </small>
                )}
              </div>
            </div>
          </div>
          
          <div className="col-md-6 mb-4">
            <div className="card h-100">
              <div className="card-body">
                <h5 className="card-title text-muted mb-3">Usage Statistics</h5>
                <div className="d-flex justify-content-between mb-2">
                  <span>
                    <Upload size={14} className="me-1 text-success" />
                    Total Added:
                  </span>
                  <strong>{stats ? formatCurrency(stats.total_added) : '$0.00'}</strong>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>
                    <Download size={14} className="me-1 text-danger" />
                    Total Used:
                  </span>
                  <strong>{stats ? formatCurrency(stats.total_used) : '$0.00'}</strong>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>Low Balance Threshold:</span>
                  <strong>{balance ? `${balance.low_balance_threshold}%` : '20%'}</strong>
                </div>
                
                {/* Progress bar showing usage */}
                {stats && stats.total_added > 0 && (
                  <div className="mt-3">
                    <div className="progress" style={{ height: '10px' }}>
                      <div 
                        className={`progress-bar ${stats.usage_percent >= 80 ? 'bg-danger' : stats.usage_percent >= 60 ? 'bg-warning' : 'bg-success'}`}
                        role="progressbar" 
                        style={{ width: `${Math.min(100, stats.usage_percent)}%` }}
                        aria-valuenow={stats.usage_percent} 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      ></div>
                    </div>
                    <small className="d-flex justify-content-between mt-2">
                      <span>0%</span>
                      <span>Used: {stats.usage_percent.toFixed(1)}%</span>
                      <span>100%</span>
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Add Credits Modal */}
        {showAddModal && (
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Add Credits</h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowAddModal(false)}
                    disabled={addingCredits}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="creditAmount" className="form-label">Amount</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        id="creditAmount"
                        placeholder="Enter amount"
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="creditDescription" className="form-label">Description (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      id="creditDescription"
                      placeholder="Enter description"
                      value={addDescription}
                      onChange={(e) => setAddDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddModal(false)}
                    disabled={addingCredits}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleAddCredits}
                    disabled={addingCredits || !addAmount || parseFloat(addAmount) <= 0}
                  >
                    {addingCredits ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus size={14} className="me-1" />
                        Add Credits
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditBalance;