// src/pages/AgentComparison.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { format } from 'date-fns';
import Select from 'react-select';
import { Lock } from 'lucide-react';
import { api } from '../services/api';

const AgentComparison = (props) => {
  console.log("AgentComparison props:", props);
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [channels, setChannels] = useState([]);
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
    selectedChannels: [],
    selectedForm: null
  });

  // Get the props if they exist
  const { agentRestricted, agentId } = props;

  // Get user profile to determine if agent or admin
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        // Get user info directly from API
        const userInfo = await api.getUserProfile();
        console.log('User info from API:', userInfo);
        setUserInfo(userInfo);
        
        // IMPORTANT: Check if user is an agent directly from userInfo
        // This is the key part that needs to work regardless of props
        if (userInfo.isAgent && !userInfo.isAdmin && userInfo.agentId) {
          console.log('User is an agent with ID:', userInfo.agentId);
          setIsRestrictedView(true);
          
          // Also check if props containing agent info are present
          if (agentRestricted && agentId) {
            console.log('Using agent ID from props:', agentId);
          } else {
            console.log('Using agent ID from API:', userInfo.agentId);
          }
          
          // Pre-select the agent using the agent ID (from props or API)
          const agentIdToUse = agentId || userInfo.agentId;
          
          // For agent comparison, we want to preselect just the agent's ID
          const agentOption = { value: agentIdToUse, label: userInfo.username || 'Your Performance' };
          setFilters(prev => ({
            ...prev,
            selectedAgents: [agentOption]
          }));
        } else {
          console.log('User is not restricted to agent view');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserInfo();
  }, []);

  const handleAgentChange = (selected) => {
    // If in restricted view, prevent changes completely by returning early
    if (isRestrictedView || (userInfo && userInfo.isAgent && !userInfo.isAdmin)) {
      console.log('Agent change blocked - user is an agent');
      return;
    }
    
    // Only proceed if not in restricted view
    console.log('Agent selection changed:', selected);
    handleFilterChange('selectedAgents', selected);
  };

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

  const fetchChannels = useCallback(async () => {
    try {
      const response = await fetch('/api/interactions/channels', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }
      
      const data = await response.json();
      setChannels(data);
      console.log('Available channels:', data);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  }, []);

  // Fetch agents and parameters
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // First make sure we have user info
        if (!userInfo) {
          console.log('Waiting for user info before fetching agents');
          return; // Exit early and wait for user info
        }
        
        console.log('Fetching agents with userInfo:', 
          userInfo.isAgent ? 'Agent' : 'Admin');
        
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
        
        console.log('Fetched', agentsData.length, 'agents');
        
        // IMPORTANT: Check directly if user is an agent
        // This ensures we restrict the view regardless of component props
        if (userInfo.isAgent && !userInfo.isAdmin) {
          console.log('User is an agent - restricting view');
          setIsRestrictedView(true);
          
          // Get the agent ID directly from userInfo
          const agentIdToUse = userInfo.agentId;
          console.log('Agent ID to filter by:', agentIdToUse);
          
          if (agentIdToUse) {
            // Use strict filtering - only include current agent
            const agentDataForUser = agentsData.filter(agent => 
              String(agent.id) === String(agentIdToUse)
            );
            
            console.log('Filtered agents for user:', agentDataForUser);
            
            // Check if we found the agent
            if (agentDataForUser.length > 0) {
              // Set the agents list to only include this one agent
              setAgents(agentDataForUser);
              
              // Update filters with the current agent
              const agentOption = {
                value: agentDataForUser[0].id,
                label: agentDataForUser[0].name
              };
              
              console.log('Setting selected agent to:', agentOption);
              setFilters(prev => ({
                ...prev,
                selectedAgents: [agentOption]
              }));
            } else {
              console.log('Agent not found in list - this is a problem!');
              
              // As a fallback, manually add the agent to the list
              const fallbackAgent = {
                id: agentIdToUse,
                name: userInfo.username || 'You'
              };
              
              setAgents([fallbackAgent]);
              
              const agentOption = {
                value: fallbackAgent.id,
                label: fallbackAgent.name
              };
              
              console.log('Using fallback agent:', agentOption);
              setFilters(prev => ({
                ...prev,
                selectedAgents: [agentOption]
              }));
            }
          } else {
            console.log('No agent ID found - cannot filter agents');
            setAgents([]);
          }
        } else {
          // Admin view - show all agents
          console.log('Admin view - showing all agents');
          setAgents(agentsData);
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
    fetchChannels();
  }, [userInfo]);

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
      
      if (filters.selectedChannels.length > 0) {
        params.append('channels', filters.selectedChannels.map(c => c.value).join(','));
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
    // If restricted view or user is agent, don't allow changing agents
    if ((isRestrictedView || (userInfo && userInfo.isAgent && !userInfo.isAdmin)) && name === 'selectedAgents') {
      console.log('Blocked changing agents - user is an agent');
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

  // For debugging - log current state on each render
  useEffect(() => {
    console.log('Current component state:', { 
      isRestrictedView, 
      agentsCount: agents.length,
      selectedAgents: filters.selectedAgents,
      userInfo: userInfo ? {
        isAgent: userInfo.isAgent,
        isAdmin: userInfo.isAdmin,
        agentId: userInfo.agentId
      } : 'not loaded'
    });
  }, [isRestrictedView, agents.length, filters.selectedAgents, userInfo]);

  return (
    <div className="container-fluid py-4">      
      {/* Restricted View Notice */}
      {(isRestrictedView || (userInfo && userInfo.isAgent && !userInfo.isAdmin)) && (
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
              <label className="form-label">Channels</label>
              <Select
                isMulti
                options={channels.map(channel => ({
                  value: channel.id,
                  label: `${channel.name} (${channel.type})`
                }))}
                value={filters.selectedChannels}
                onChange={(selected) => handleFilterChange('selectedChannels', selected)}
                placeholder="All channels"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Select Agents to Compare</label>
              <Select
                isMulti
                options={agents.map(agent => ({
                  value: agent.id,
                  label: agent.name
                }))}
                value={filters.selectedAgents}
                onChange={handleAgentChange}
                placeholder={isRestrictedView || (userInfo && userInfo.isAgent && !userInfo.isAdmin) ? 
                  "Your performance only" : "Select agents to compare"}
                isDisabled={isRestrictedView || (userInfo && userInfo.isAgent && !userInfo.isAdmin)}
                noOptionsMessage={() => isRestrictedView || (userInfo && userInfo.isAgent && !userInfo.isAdmin) ? 
                  "Restricted to your performance only" : "No agents available"}
              />
              {(isRestrictedView || (userInfo && userInfo.isAgent && !userInfo.isAdmin)) && (
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