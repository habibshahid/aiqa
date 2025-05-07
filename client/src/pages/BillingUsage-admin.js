// client/src/pages/BillingUsage.js
import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, BarChart2, Clock, MessageSquare, Download, Settings } from 'lucide-react';
import { api } from '../services/api';
import BillingRates from '../components/BillingRates';
import CreditBalance from '../components/CreditBalance';
import CreditTransactions from '../components/CreditTransactions';

const BillingUsage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0], // Start of current month
    endDate: new Date().toISOString().split('T')[0] // Today
  });
  
  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      const response = await fetch(`/api/billing/usage?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error fetching billing data');
      }
      
      const data = await response.json();
      setBillingData(data);
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch billing data when component mounts or date range changes
  useEffect(() => {
    fetchBillingData();
  }, [dateRange]);
  
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const formatDuration = (seconds) => {
    if (!seconds) return '0 min';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes} min ${remainingSeconds} sec`;
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };
  
  const exportToCsv = () => {
    if (!billingData) return;
    
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    csvContent += "Date,Evaluations,Tokens,Duration (sec),Cost,Price\n";
    
    // Add daily data
    billingData.dailyUsage.forEach(day => {
      csvContent += `${day.date},${day.evaluationCount},${day.totalTokens},${day.totalDuration},${day.totalCost.toFixed(4)},${day.totalPrice.toFixed(4)}\n`;
    });
    
    // Encode and download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `usage-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">
          <h4>Error Loading Billing Data</h4>
          <p>{error}</p>
          <button className="btn btn-outline-danger mt-2" onClick={fetchBillingData}>
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // If no data available
  if (!billingData) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-info">
          <h4>No Billing Data Available</h4>
          <p>There is no billing data available for the selected date range.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container-fluid py-4">
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="card-title mb-0">Billing & Usage</h4>
            <div className="d-flex gap-2">
              <div className="input-group">
                <span className="input-group-text">From</span>
                <input
                  type="date"
                  className="form-control"
                  name="startDate"
                  value={dateRange.startDate}
                  onChange={handleDateChange}
                />
              </div>
              <div className="input-group">
                <span className="input-group-text">To</span>
                <input
                  type="date"
                  className="form-control"
                  name="endDate"
                  value={dateRange.endDate}
                  onChange={handleDateChange}
                />
              </div>
              <button className="btn btn-outline-primary" onClick={exportToCsv}>
                <Download size={16} className="me-1" />
                Export CSV
              </button>
            </div>
          </div>
          
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card border-0 bg-primary text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="card-subtitle">Total Cost</h6>
                    <DollarSign size={20} />
                  </div>
                  <h3 className="mb-0">{formatCurrency(billingData.costBreakdown.total)}</h3>
                  <small>Internal service cost</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 bg-success text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="card-subtitle">Total Price</h6>
                    <DollarSign size={20} />
                  </div>
                  <h3 className="mb-0">{formatCurrency(billingData.priceBreakdown.total)}</h3>
                  <small>Client billable amount</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 bg-info text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="card-subtitle">Total Evaluations</h6>
                    <BarChart2 size={20} />
                  </div>
                  <h3 className="mb-0">{billingData.evaluationCount}</h3>
                  <small>Completed evaluations</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 bg-warning text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="card-subtitle">Total Duration</h6>
                    <Clock size={20} />
                  </div>
                  <h3 className="mb-0">{formatDuration(billingData.totalDuration)}</h3>
                  <small>Recorded call time</small>
                </div>
              </div>
            </div>
          </div>
          
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">Cost Breakdown</h5>
                </div>
                <div className="card-body">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Usage</th>
                        <th>Rate</th>
                        <th>Cost</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Speech to Text</td>
                        <td>{formatDuration(billingData.totalDuration)}</td>
                        <td>{formatCurrency(billingData.rates.costSttPrerecorded)}/min</td>
                        <td>{formatCurrency(billingData.costBreakdown.stt)}</td>
                        <td>{formatCurrency(billingData.priceBreakdown.stt)}</td>
                      </tr>
                      <tr>
                        <td>OpenAI (Input)</td>
                        <td>{billingData.promptTokens.toLocaleString()} tokens</td>
                        <td>{formatCurrency(billingData.rates.costOpenAiInput)}/token</td>
                        <td>{formatCurrency(billingData.costBreakdown.openAiInput)}</td>
                        <td>{formatCurrency(billingData.priceBreakdown.openAiInput)}</td>
                      </tr>
                      <tr>
                        <td>OpenAI (Output)</td>
                        <td>{billingData.completionTokens.toLocaleString()} tokens</td>
                        <td>{formatCurrency(billingData.rates.costOpenAiOutput)}/token</td>
                        <td>{formatCurrency(billingData.costBreakdown.openAiOutput)}</td>
                        <td>{formatCurrency(billingData.priceBreakdown.openAiOutput)}</td>
                      </tr>
                      <tr className="fw-bold table-light">
                        <td>Total</td>
                        <td>{billingData.totalTokens.toLocaleString()} tokens</td>
                        <td>-</td>
                        <td>{formatCurrency(billingData.costBreakdown.total)}</td>
                        <td>{formatCurrency(billingData.priceBreakdown.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">Daily Usage</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive" style={{ maxHeight: '300px' }}>
                    <table className="table table-sm table-hover">
                      <thead className="sticky-top bg-white">
                        <tr>
                          <th>Date</th>
                          <th>Evaluations</th>
                          <th>Tokens</th>
                          <th>Duration</th>
                          <th>Cost</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingData.dailyUsage.map(day => (
                          <tr key={day.date}>
                            <td>{new Date(day.date).toLocaleDateString()}</td>
                            <td>{day.evaluationCount}</td>
                            <td>{day.totalTokens.toLocaleString()}</td>
                            <td>{formatDuration(day.totalDuration)}</td>
                            <td>{formatCurrency(day.totalCost)}</td>
                            <td>{formatCurrency(day.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">Usage by Agent</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive" style={{ maxHeight: '300px' }}>
                    <table className="table table-sm table-hover">
                      <thead className="sticky-top bg-white">
                        <tr>
                          <th>Agent</th>
                          <th>Evaluations</th>
                          <th>Duration</th>
                          <th>Cost</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingData.byAgent.map(agent => (
                          <tr key={agent.agentId}>
                            <td>{agent.name}</td>
                            <td>{agent.evaluationCount}</td>
                            <td>{formatDuration(agent.totalDuration)}</td>
                            <td>{formatCurrency(agent.totalCost)}</td>
                            <td>{formatCurrency(agent.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">Usage by Queue</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive" style={{ maxHeight: '300px' }}>
                    <table className="table table-sm table-hover">
                      <thead className="sticky-top bg-white">
                        <tr>
                          <th>Queue</th>
                          <th>Evaluations</th>
                          <th>Duration</th>
                          <th>Cost</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingData.byQueue.map(queue => (
                          <tr key={queue.queueId}>
                            <td>{queue.name}</td>
                            <td>{queue.evaluationCount}</td>
                            <td>{formatDuration(queue.totalDuration)}</td>
                            <td>{formatCurrency(queue.totalCost)}</td>
                            <td>{formatCurrency(queue.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Billing Rates Section */}
      <div className="card mt-4">
        <div className="card-header">
          <h5 className="card-title mb-0 d-flex align-items-center">
            <Settings size={18} className="me-2" />
            Billing Settings
          </h5>
        </div>
        <div className="card-body">
          <BillingRates />
        </div>
      </div>

      {/* Credit Balance Section */}
      <div className="card mt-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Credit Management</h5>
        </div>
        <div className="card-body p-0">
          <CreditBalance />
        </div>
      </div>

      {/* Credit Transactions Section */}
      <div className="card mt-4 mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Transaction History</h5>
        </div>
        <div className="card-body p-0">
          <CreditTransactions />
        </div>
      </div>
    </div>
  );
};

export default BillingUsage;