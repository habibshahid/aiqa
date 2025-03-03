// src/pages/AgentComparison.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { format } from 'date-fns';
import Select from 'react-select';
import { Lock } from 'lucide-react';
import { api } from '../services/api';

const AgentComparison = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [isRestrictedView, setIsRestrictedView] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [filters, setFilters] = useState({
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    selectedAgents: [],
    selectedParameters: [],
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

  // Define fetchForms as a useCallback at the top level
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
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  // Fetch agents and parameters
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [agentsResponse, formsResponse] = await Promise.all([
          fetch('/api/agents', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch('/api/qa-forms', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);
        
        if (!agentsResponse.ok || !formsResponse.ok) {
          throw new Error('Failed to fetch options');
        }
        
        const [agentsData, formsData] = await Promise.all([
          agentsResponse.json(),
          formsResponse.json()
        ]);
        
        setAgents(agentsData);
        
        // If in restricted view and user is not admin, filter agents
        if (isRestrictedView && userInfo?.agentId) {
          // Find the agent object for the current user
          const userAgent = agentsData.find(a => a.id.toString() === userInfo.agentId.toString());
          if (userAgent) {
            // Pre-select the user's agent
            setFilters(prev => ({ 
              ...prev, 
              selectedAgents: [{ 
                value: userAgent.id,
                label: userAgent.name
              }]
            }));
          }
        }
        
        // Extract parameters from QA forms
        const params = [];
        formsData.forEach(form => {
          form.parameters?.forEach(param => {
            if (!params.find(p => p.value === param.name)) {
              params.push({
                value: param.name,
                label: param.name
              });
            }
          });
        });
        
        setParameters(params);
      } catch (error) {
        console.error('Error fetching options:', error);
        setError('Failed to load filter options');
      }
    };
    
    fetchOptions();
  }, [userInfo, isRestrictedView]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Fetch comparison data when filters change
  useEffect(() => {
    if (filters.selectedAgents.length === 0 && !isRestrictedView) return;
    
    fetchComparison();
  }, [filters, isRestrictedView]);

  const fetchComparison = async () => {
    try {
      if (!filters.selectedForm && forms.length > 1) {
        setComparison([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        agents: filters.selectedAgents.map(a => a.value).join(',')
      });
      
      if (filters.selectedForm) {
        params.append('formId', filters.selectedForm.value);
      }

      if (filters.selectedParameters.length > 0) {
        params.append('parameters', filters.selectedParameters.map(p => p.value).join(','));
      }
      
      const response = await fetch(`/api/analytics/agent-comparison?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Check if this is a restricted view
      const isRestricted = response.headers.get('X-Restricted-View') === 'agent-only';
      setIsRestrictedView(isRestricted);
      
      if (!response.ok) {
        throw new Error('Failed to fetch comparison data');
      }
      
      const rawData = await response.json();
      
      // Handle different response formats (array or object with data property)
      const data = Array.isArray(rawData) ? rawData : (rawData.data || []);
      
      setComparison(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching comparison:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    // If restricted view, don't allow changing agents
    if (isRestrictedView && name === 'selectedAgents') {
      return;
    }
    
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Format data for radar chart
  const prepareRadarData = () => {
    const parameters = {};
    
    // Find all parameters across all agents
    comparison.forEach(agent => {
      Object.keys(agent.parameters).forEach(param => {
        parameters[param] = true;
      });
    });
    
    // Format data for radar chart
    return Object.keys(parameters).map(param => {
      const entry = { parameter: param };
      
      comparison.forEach(agent => {
        entry[agent.name] = parseFloat(agent.parameters[param]?.avgScore || 0);
      });
      
      return entry;
    });
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Agent Performance Comparison</h2>
      </div>
      
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
            <div>Please select a QA Form to compare agent performance.</div>
          </div>
        </div>
      )}
      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
          <div className="col-md-6">
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
            
            <div className="col-md-6">
              <label className="form-label">Agents</label>
              <Select
                isMulti
                options={agents.map(agent => ({
                  value: agent.id,
                  label: agent.name
                }))}
                value={filters.selectedAgents}
                onChange={(selected) => handleFilterChange('selectedAgents', selected)}
                placeholder="Select agents to compare"
                isDisabled={isRestrictedView}
              />
              {isRestrictedView && (
                <small className="text-muted">You can only view your own performance data</small>
              )}
            </div>
            
            <div className="col-md-6">
              <label className="form-label">Parameters (Optional)</label>
              <Select
                isMulti
                options={parameters}
                value={filters.selectedParameters}
                onChange={(selected) => handleFilterChange('selectedParameters', selected)}
                placeholder="Select specific parameters to compare"
              />
            </div>
            
            <div className="col-md-6 d-flex align-items-end">
              <button
                className="btn btn-primary"
                onClick={fetchComparison}
                disabled={loading || (filters.selectedAgents.length === 0 && !isRestrictedView)}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading...
                  </>
                ) : 'Compare Agents'}
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
      
      {comparison.length > 0 && (
        <>
          {/* Overall Scores Chart */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Overall Performance Comparison</h5>
            </div>
            <div className="card-body">
              <div style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparison}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value) => [`${parseFloat(value).toFixed(1)}%`, 'Score']}
                    />
                    <Legend />
                    <Bar 
                      dataKey="avgScore" 
                      name="Average Score" 
                      fill="#8884d8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="table-responsive mt-4">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Avg Score</th>
                      <th>Evaluations</th>
                      <th>Customer Sentiment</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map(agent => (
                      <tr key={agent.id}>
                        <td>{agent.name}</td>
                        <td>
                          <div className={`badge ${
                            parseFloat(agent.avgScore) >= 80 ? 'bg-success' :
                            parseFloat(agent.avgScore) >= 60 ? 'bg-warning' : 'bg-danger'
                          }`}>
                            {parseFloat(agent.avgScore).toFixed(1)}%
                          </div>
                        </td>
                        <td>{agent.evaluationCount}</td>
                        <td>
                          <div className="d-flex gap-2">
                            <span className="badge bg-success">
                              {agent.sentiments.positive} Positive
                            </span>
                            <span className="badge bg-warning">
                              {agent.sentiments.neutral} Neutral
                            </span>
                            <span className="badge bg-danger">
                              {agent.sentiments.negative} Negative
                            </span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => navigate(`/agent-coaching/${agent.id}`)}
                          >
                            View Coaching
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Radar Chart for Parameter Comparison */}
          {comparison.length > 1 && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Parameter Comparison</h5>
              </div>
              <div className="card-body">
                <div style={{ height: 500 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart outerRadius={150} data={prepareRadarData()}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="parameter" />
                      <PolarRadiusAxis domain={[0, 5]} />
                      {comparison.map((agent, index) => (
                        <Radar
                          key={agent.id}
                          name={agent.name}
                          dataKey={agent.name}
                          stroke={index === 0 ? '#8884d8' : index === 1 ? '#82ca9d' : '#ffc658'}
                          fill={index === 0 ? '#8884d8' : index === 1 ? '#82ca9d' : '#ffc658'}
                          fillOpacity={0.6}
                        />
                      ))}
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          
          {/* Parameter-specific Bar Charts */}
          <div className="row">
            {Object.keys(comparison[0]?.parameters || {}).map(param => (
              <div className="col-md-6 mb-4" key={param}>
                <div className="card h-100">
                  <div className="card-header">
                    <h5 className="card-title mb-0">{param}</h5>
                  </div>
                  <div className="card-body">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={comparison.map(agent => ({
                            name: agent.name,
                            score: parseFloat(agent.parameters[param]?.avgScore || 0)
                          }))}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 5]} />
                          <Tooltip />
                          <Bar dataKey="score" fill="#4f46e5" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AgentComparison;