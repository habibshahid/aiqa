// client/src/components/BillingRates.js
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const BillingRates = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rates, setRates] = useState({
    costSttPrerecorded: 0.0052,
    costOpenAiInput: 0.00005,
    costOpenAiOutput: 0.00015,
    priceSttPrerecorded: 0.0065,
    priceOpenAiInput: 0.0000625,
    priceOpenAiOutput: 0.0001875
  });
  
  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/billing/rates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        // Try to parse as JSON, but handle non-JSON responses
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || 'Error fetching billing rates';
        } catch (e) {
          // If it's not valid JSON, use the raw text or a default message
          errorMessage = errorText.substring(0, 100) || 'Error fetching billing rates';
        }
        
        throw new Error(errorMessage);
      }
      
      // Get response as text first to debug
      const responseText = await response.text();
      console.log('API Response Text:', responseText);
      
      // Then try parsing as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON Parse Error:', e);
        throw new Error(`Failed to parse response as JSON: ${e.message}`);
      }
      
      setRates(data);
    } catch (err) {
      console.error('Error fetching billing rates:', err);
      setError(err.message);
      
      // Use default rates if fetching fails
      setRates({
        costSttPrerecorded: 0.0052,
        costOpenAiInput: 0.00005,
        costOpenAiOutput: 0.00015,
        priceSttPrerecorded: 0.0065,
        priceOpenAiInput: 0.0000625,
        priceOpenAiOutput: 0.0001875
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch rates when component mounts
  useEffect(() => {
    fetchRates();
  }, []);
  
  // Format numbers for display
  const formatNumber = (number) => {
    if (number < 0.0001) {
      return number.toExponential(6);
    }
    return number.toFixed(6);
  };
  
  // Format as currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount < 0.01 ? 6 : 4,
      maximumFractionDigits: amount < 0.01 ? 6 : 4
    }).format(amount);
  };
  
  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading billing rates...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0">Current Billing Rates</h5>
        <div>
          <button 
            className="btn btn-sm btn-outline-secondary" 
            onClick={fetchRates}
          >
            <RefreshCw size={14} className="me-1" />
            Refresh
          </button>
        </div>
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-warning">
            <h5>Error loading billing rates</h5>
            <p className="mb-2">Using default rates. The actual issue was:</p>
            <pre className="mb-0 bg-light p-2 rounded" style={{ fontSize: '0.8rem', maxHeight: '100px', overflow: 'auto' }}>
              {error}
            </pre>
          </div>
        )}
        
        <h6 className="mb-3">Cost Rates (What we pay)</h6>
        <div className="table-responsive mb-4">
          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th>Service</th>
                <th>Rate</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Speech-to-Text (per minute)</td>
                <td className="text-end">{formatCurrency(rates.costSttPrerecorded)}</td>
                <td>Speech to Text pre-recorded audio transcription</td>
              </tr>
              <tr>
                <td>OpenAI Input (per token)</td>
                <td className="text-end">{formatCurrency(rates.costOpenAiInput)}</td>
                <td>GPT-4o prompt tokens</td>
              </tr>
              <tr>
                <td>OpenAI Output (per token)</td>
                <td className="text-end">{formatCurrency(rates.costOpenAiOutput)}</td>
                <td>GPT-4o completion tokens</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <h6 className="mb-3">Price Rates (What we charge)</h6>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th>Service</th>
                <th>Rate</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Speech-to-Text (per minute)</td>
                <td className="text-end">{formatCurrency(rates.priceSttPrerecorded)}</td>
                <td>Speech to Text pre-recorded audio transcription</td>
              </tr>
              <tr>
                <td>OpenAI Input (per token)</td>
                <td className="text-end">{formatCurrency(rates.priceOpenAiInput)}</td>
                <td>GPT-4o prompt tokens</td>
              </tr>
              <tr>
                <td>OpenAI Output (per token)</td>
                <td className="text-end">{formatCurrency(rates.priceOpenAiOutput)}</td>
                <td>GPT-4o completion tokens</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="alert alert-info mt-4">
          <p className="mb-0">
            <strong>Note:</strong> Billing rates are configured by system administrators through environment variables. 
            These settings affect all new evaluations in the system.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingRates;
