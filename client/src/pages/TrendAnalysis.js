// src/pages/TrendAnalysis.js
import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, subMonths } from 'date-fns';
import Select from 'react-select';
import { Lock } from 'lucide-react';
import { api } from '../services/api';

const TrendAnalysis = () => {
  const [agents, setAgents] = useState([]);
  const [queues, setQueues] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [isRestrictedView, setIsRestrictedView] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [filters, setFilters] = useState({
    startDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    selectedAgent: null,
    selectedQueue: null,
    interval: { value: 'day', label: 'Daily' },
    selectedForm: null
  });

  // Get user profile to determine if agent or admin
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await api.getUserProfile();
        setUserInfo(userInfo);
        
        // Check if user has isAdmin property
        const isAdmin = userInfo?.isAdmin === true;
        setIsRestrictedView(!isAdmin && !!userInfo?.agentId);
        
        // If not admin and has agent ID, pre-select their agent
        if (!isAdmin && userInfo?.agentId) {
          // We'll handle this after agents are loaded
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserInfo();
  }, []);

  // Define fetchForms function with useCallback
  const fetchForms = useCallback(async () => {
    try {
      setFormsLoading(true);
      const response = await fetch('/api/qa-forms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QA forms');
      }
      
      const data = await response.json();
      setForms(data);
      
      // If there's only one form, select it automatically
      if (data.length === 1) {
        setFilters(prev => ({ ...prev, selectedForm: { value: data[0]._id, label: data[0].name } }));
        // Will trigger fetchTrends via the useEffect that depends on filters
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [agentsResponse, queuesResponse] = await Promise.all([
          fetch('/api/agents', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch('/api/queues', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);
        
        if (!agentsResponse.ok || !queuesResponse.ok) {
          throw new Error('Failed to fetch options');
        }
        
        const [agentsData, queuesData] = await Promise.all([
          agentsResponse.json(),
          queuesResponse.json()
        ]);
        
        setAgents(agentsData);
        setQueues(queuesData);
        
        // If in restricted view and user is not admin, filter agents and auto-select
        if (isRestrictedView && userInfo?.agentId) {
          // Find the agent object for the current user
          const userAgent = agentsData.find(a => a.id.toString() === userInfo.agentId.toString());
          if (userAgent) {
            // Pre-select the user's agent
            setFilters(prev => ({ 
              ...prev, 
              selectedAgent: { 
                value: userAgent.id,
                label: userAgent.name
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching options:', error);
        setError('Failed to load filter options');
      }
    };
    
    fetchOptions();
  }, [userInfo, isRestrictedView]);

  // Fetch forms on component mount
  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Fetch trends when filters change
  useEffect(() => {
    fetchTrends();
  }, [filters]);

  const fetchTrends = async () => {
    try {
      // Only proceed if a form is selected when multiple forms exist
      if (!filters.selectedForm && forms.length > 1) {
        setTrends([]);
        setLoading(false);
        return;
      }
  
      // Start loading
      setLoading(true);
      setError(null);
  
      // Prepare query parameters
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        interval: filters.interval.value
      });
      
      if (filters.selectedForm) {
        params.append('formId', filters.selectedForm.value);
      }

      if (filters.selectedAgent) {
        params.append('agentId', filters.selectedAgent.value);
      }
      
      if (filters.selectedQueue) {
        params.append('queueId', filters.selectedQueue.value);
      }
      
      const response = await fetch(`/api/analytics/trends?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Check if this is a restricted view
      const isRestricted = response.headers.get('X-Restricted-View') === 'agent-only';
      setIsRestrictedView(isRestricted);
      
      if (!response.ok) {
        throw new Error('Failed to fetch trend data');
      }
      
      const rawData = await response.json();
      
      // Handle different response formats (array or object with data property)
      const data = Array.isArray(rawData) ? rawData : (rawData.data || []);
      
      setTrends(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching trends:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    // If in restricted view, don't allow changing the agent
    if (isRestrictedView && name === 'selectedAgent') {
      return;
    }
    
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Format date for display based on interval
  const formatDate = (date) => {
    try {
      if (!date) return 'Unknown Date';
      
      if (filters.interval.value === 'day') {
        return format(new Date(date), 'MMM d');
      } else if (filters.interval.value === 'week') {
        return `Week of ${format(new Date(date), 'MMM d')}`;
      } else if (filters.interval.value === 'month') {
        // The issue is here - for monthly data, the date might be in YYYY-MM format
        // without a day component, which creates an invalid date
        
        // Check if date is in YYYY-MM format (no day)
        if (/^\d{4}-\d{2}$/.test(date)) {
          // Add day component to make it a valid date
          return format(new Date(`${date}-01`), 'MMM yyyy');
        } else {
          // If it already has a day component or is in another format,
          // try to parse it normally
          return format(new Date(date), 'MMM yyyy');
        }
      }
      return date;
    } catch (error) {
      console.error(`Error formatting date: ${date}`, error);
      // Return a fallback string to prevent component from crashing
      return 'Invalid Date';
    }
  };

  return (
    <div className="container-fluid py-4">
      {/* Restricted View Notice */}
      {isRestrictedView && (
        <div className="alert alert-info d-flex align-items-center mb-4">
          <Lock size={18} className="me-2" />
          <div>
            <strong>Agent View:</strong> You can only see your own performance data.
          </div>
        </div>
      )}
      
      {!filters.selectedForm && forms.length > 1 && !loading && (
        <div className="alert alert-info">
          <div className="d-flex align-items-center">
            <i className="bi bi-info-circle me-2"></i>
            <div>Please select a QA Form to view trend analysis.</div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">QA Form</label>
              <Select
                options={forms.map(form => ({
                  value: form._id,
                  label: form.name
                }))}
                value={filters.selectedForm}
                onChange={(selected) => handleFilterChange('selectedForm', selected)}
                placeholder={formsLoading ? "Loading forms..." : "Select QA Form"}
                isDisabled={formsLoading || forms.length === 1}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            
            <div className="col-md-3">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            
            <div className="col-md-3">
              <label className="form-label">Agent</label>
              <Select
                options={agents.map(agent => ({
                  value: agent.id,
                  label: agent.name
                }))}
                value={filters.selectedAgent}
                onChange={(selected) => handleFilterChange('selectedAgent', selected)}
                isClearable={!isRestrictedView}
                placeholder={isRestrictedView ? "Your data only" : "All Agents"}
                isDisabled={isRestrictedView}
              />
              {isRestrictedView && (
                <small className="text-muted">You can only view your own data</small>
              )}
            </div>
            
            <div className="col-md-3">
              <label className="form-label">Queue</label>
              <Select
                options={queues.map(queue => ({
                  value: queue.id,
                  label: queue.name
                }))}
                value={filters.selectedQueue}
                onChange={(selected) => handleFilterChange('selectedQueue', selected)}
                isClearable
                placeholder="All Queues"
              />
            </div>
            
            <div className="col-md-3">
              <label className="form-label">Time Interval</label>
              <Select
                options={[
                  { value: 'day', label: 'Daily' },
                  { value: 'week', label: 'Weekly' },
                  { value: 'month', label: 'Monthly' }
                ]}
                value={filters.interval}
                onChange={(selected) => handleFilterChange('interval', selected)}
              />
            </div>
            
            <div className="col-md-3 d-flex align-items-end">
              <button
                className="btn btn-primary"
                onClick={fetchTrends}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading...
                  </>
                ) : 'Apply Filters'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}
      
      {trends.length > 0 ? (
        <>
          {/* Overall Score Trend Chart */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Score Trend</h5>
            </div>
            <div className="card-body">
              <div style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trends.map(item => ({
                      ...item,
                      displayDate: formatDate(item.date)
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="displayDate" 
                      angle={-45} 
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${parseFloat(value).toFixed(1)}%`, 'Score']} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgScore" 
                      name="Average Score" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Evaluation Volume Chart */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Evaluation Volume</h5>
            </div>
            <div className="card-body">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trends.map(item => ({
                      ...item,
                      displayDate: formatDate(item.date)
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="displayDate" 
                      angle={-45} 
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      name="Evaluations" 
                      stroke="#82ca9d" 
                      fill="#82ca9d"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Customer Sentiment Trend */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Customer Sentiment Trend</h5>
            </div>
            <div className="card-body">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trends.map(item => ({
                      ...item,
                      displayDate: formatDate(item.date),
                      positivePct: item.count > 0 ? (item.customerSentiment.positive / item.count) * 100 : 0,
                      neutralPct: item.count > 0 ? (item.customerSentiment.neutral / item.count) * 100 : 0,
                      negativePct: item.count > 0 ? (item.customerSentiment.negative / item.count) * 100 : 0
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    stackOffset="expand"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="displayDate" 
                      angle={-45} 
                      textAnchor="end"
                      height={70} 
                    />
                    <YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} />
                    <Tooltip 
                      formatter={(value) => [`${parseFloat(value).toFixed(1)}%`, '']}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="positivePct" 
                      name="Positive" 
                      stackId="1" 
                      stroke="#4caf50" 
                      fill="#4caf50" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="neutralPct" 
                      name="Neutral" 
                      stackId="1" 
                      stroke="#ff9800" 
                      fill="#ff9800" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="negativePct" 
                      name="Negative" 
                      stackId="1" 
                      stroke="#f44336" 
                      fill="#f44336" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-body">
            <p className="text-center text-muted my-5">
              {loading ? 'Loading trend data...' : 'No trend data available. Try adjusting your filters.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendAnalysis;