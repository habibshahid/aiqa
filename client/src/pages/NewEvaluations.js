// src/pages/NewEvaluations.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Select from 'react-select';
import { api } from '../services/api';
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react';

// NEW: Multi-channel support constants
const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'chat', 'email', 'sms'];

const CHANNEL_DISPLAY_NAMES = {
  'call': 'Voice Call',
  'whatsapp': 'WhatsApp',
  'fb_messenger': 'Facebook Messenger', 
  'facebook': 'Facebook Comments',
  'instagram_dm': 'Instagram DM',
  'email': 'Email',
  'chat': 'Live Chat',
  'sms': 'SMS'
};

const NewEvaluations = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showQueueConfirmation, setShowQueueConfirmation] = useState(false);
  const [queuedJobsCount, setQueuedJobsCount] = useState(0);
  const [userInfo, setUserInfo] = useState(null);
  
  // Filters state - ENHANCED with channels
  const [filters, setFilters] = useState({
    startDate: format(new Date(new Date().setHours(0, 0, 0, 0)), 'yyyy-MM-dd\'T\'HH:mm'),
    endDate: format(new Date(new Date().setHours(23, 59, 59, 999)), 'yyyy-MM-dd\'T\'HH:mm'),
    criteriaProfileId: '',
    queueIds: [],
    agentIds: [],
    minDuration: 0,
    durationComparison: '>',
    workCodeIds: [],
    qaFormId: '',
    excludeEvaluated: true,
    direction: 'all',
    channels: [] // NEW: Channel filter
  });
  
  // Options for dropdowns - ENHANCED with channels
  const [options, setOptions] = useState({
    criteriaProfiles: [],
    queues: [],
    agents: [],
    workCodes: [],
    qaForms: [],
    channels: [] // NEW: Available channels
  });
  
  // Interactions and selection state
  const [interactions, setInteractions] = useState([]);
  const [selectedInteractions, setSelectedInteractions] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await api.getUserProfile();
        setUserInfo(userInfo);
        
        // If user is an agent, pre-select their ID in the filters
        if (userInfo.isAgent && !userInfo.isAdmin && userInfo.agentId) {
          setFilters(prev => ({
            ...prev,
            agentIds: [userInfo.agentId]
          }));
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserInfo();
  }, []);

  // Fetch options for dropdowns - ENHANCED with channels
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true);
        const [
          criteriaProfiles,
          queues,
          agents,
          workCodes,
          qaForms,
          channels // NEW: Fetch available channels
        ] = await Promise.all([
          api.getCriteriaProfiles(),
          api.getQueues(),
          api.getAgents(),
          api.getWorkCodes(),
          api.getQAForms(),
          api.getChannels() // NEW: Add this API call
        ]);

        setOptions({
          criteriaProfiles,
          queues,
          agents,
          workCodes,
          qaForms,
          channels // NEW: Add channels to options
        });
        
        setError(null);
      } catch (err) {
        console.error('Error fetching options:', err);
        setError('Failed to load filter options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, []);

  // Handle criteria profile selection
  useEffect(() => {
    if (filters.criteriaProfileId) {
      // Find the selected profile
      const selectedProfile = options.criteriaProfiles.find(
        profile => profile._id === filters.criteriaProfileId
      );
      
      if (selectedProfile) {
        // Apply profile filters
        setFilters(prev => ({
          ...prev,
          queueIds: selectedProfile.queues.map(q => q.queueId),
          agentIds: selectedProfile.agents.map(a => a.agentId),
          workCodeIds: selectedProfile.workCodes.map(w => w.code),
          minDuration: selectedProfile.minCallDuration,
          durationComparison: selectedProfile.durationComparison || '>',
          qaFormId: selectedProfile.evaluationForm?.formId || '',
          excludeEvaluated: selectedProfile.excludeEvaluated !== false,
          channels: selectedProfile.channels.map(ch => ch.channelId),
          direction: selectedProfile.direction || 'all'
        }));
      }
    }
  }, [filters.criteriaProfileId, options.criteriaProfiles]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle select changes
  const handleSelectChange = (name, selected) => {
    setFilters(prev => ({
      ...prev,
      [name]: Array.isArray(selected) 
        ? selected.map(item => item.value) 
        : (selected?.value || '')
    }));
  };

  // Search interactions based on filters - ENHANCED with channels
  const searchInteractions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Prepare the search criteria - ENHANCED with channels
      const searchParams = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        queues: filters.queueIds.map(id => {
          // Find the queue name by ID
          const queue = options.queues.find(q => q.id.toString() === id.toString());
          return queue ? queue.name : id;
        }),
        agents: filters.agentIds,
        minDuration: filters.minDuration,
        durationComparison: filters.durationComparison,
        workCodes: filters.workCodeIds,
        qaFormId: filters.qaFormId,
        excludeEvaluated: filters.excludeEvaluated,
        direction: filters.direction !== 'all' ? filters.direction : undefined,
        channels: filters.channels.length > 0 ? filters.channels : undefined // NEW: Include channel filter
      };
      
      console.log('Search params with channels:', searchParams);
      
      // Make API call to search interactions
      const response = await fetch('/api/interactions/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(searchParams)
      });
      
      if (!response.ok) {
        throw new Error('Failed to search interactions');
      }
      
      const data = await response.json();
      setInteractions(data);
      
      // Reset selections
      setSelectedInteractions([]);
      setSelectAll(false);
      
      // NEW: Log channel distribution
      const channelCounts = data.reduce((acc, interaction) => {
        const channel = interaction.channel || 'call';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {});
      
      console.log('Found interactions:', data.length);
      console.log('Channel distribution:', channelCounts);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Error searching interactions');
    } finally {
      setLoading(false);
    }
  };

  // Run evaluations on selected interactions - ENHANCED with multi-channel support
  const runEvaluations = async () => {
    if (selectedInteractions.length === 0) {
      setError('Please select at least one interaction to evaluate');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      
      // Get current user info from localStorage or context
      const userString = localStorage.getItem('user');
      let evaluator = { id: 'unknown', name: 'Unknown User' };
      
      if (userString) {
        try {
          const userData = JSON.parse(userString);
          evaluator = {
            id: userData.id,
            name: userData.first_name && userData.last_name 
              ? `${userData.first_name} ${userData.last_name}` 
              : userData.username || 'Unknown'
          };
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      // Format the data for the API - ENHANCED with multi-channel support
      const evaluationData = selectedInteractions.map(interactionId => {
        const interaction = interactions.find(item => item._id === interactionId);
        const isTextChannel = TEXT_CHANNELS.includes(interaction.channel);
        
        const evaluationItem = {
          interactionId,
          agent: {
            id: interaction.agent?.id,
            name: interaction.agent?.name
          },
          caller: {
            id: interaction.caller?.id
          },
          qaFormId: filters.qaFormId,
          channel: interaction.channel || 'call', // NEW: Include channel info
          processingType: isTextChannel ? 'text' : 'audio' // NEW: Include processing type
        };
        
        // NEW: Only add recording URL for audio channels
        if (!isTextChannel) {
          const recordingUrl = interaction.extraPayload?.callRecording?.webPathQA || 
                              interaction.extraPayload?.callRecording?.webPath;
          evaluationItem.recordingUrl = recordingUrl;
        }
        
        return evaluationItem;
      });
      
      console.log('Prepared evaluation data with channels:', evaluationData);
      
      // Make API call to process evaluations
      const response = await fetch('/api/qa-process/process-evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          evaluations: evaluationData, 
          evaluator: evaluator 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to process evaluations');
      }
      
      const result = await response.json();
      
      // NEW: Enhanced success message with channel breakdown
      const channelBreakdown = result.summary ? 
        `(${result.summary.audioChannels || 0} audio, ${result.summary.textChannels || 0} text)` : '';
      
      setSuccess(`Successfully queued ${result.processed} evaluations for processing ${channelBreakdown}`);
      
      // NEW: Show validation errors if any
      if (result.validationErrors && result.validationErrors.length > 0) {
        const errorChannels = result.validationErrors.map(e => e.channel).join(', ');
        setError(`Some evaluations failed validation for channels: ${errorChannels}`);
      }
      
      // Clear selections after successful processing
      setSelectedInteractions([]);
      setSelectAll(false);
      
      setQueuedJobsCount(result.jobs.length);
      setShowQueueConfirmation(true);

      // Refresh the interaction list to reflect changes
      searchInteractions();
    } catch (err) {
      console.error('Processing error:', err);
      setError(err.message || 'Error processing evaluations');
    } finally {
      setSubmitting(false);
    }
  };

  // NEW: Helper functions for channel display
  const getChannelDisplayName = (channel) => {
    return CHANNEL_DISPLAY_NAMES[channel] || channel?.charAt(0).toUpperCase() + channel?.slice(1) || 'Unknown';
  };

  const getChannelBadgeColor = (channel) => {
    if (TEXT_CHANNELS.includes(channel)) {
      return 'bg-info';
    }
    return 'bg-primary';
  };

  // Handle selection change for an interaction
  const handleSelectionChange = (interactionId) => {
    setSelectedInteractions(prev => {
      if (prev.includes(interactionId)) {
        return prev.filter(id => id !== interactionId);
      } else {
        return [...prev, interactionId];
      }
    });
  };

  // Handle select all change
  const handleSelectAllChange = () => {
    if (selectAll) {
      setSelectedInteractions([]);
    } else {
      setSelectedInteractions(interactions.map(interaction => interaction._id));
    }
    setSelectAll(!selectAll);
  };

  const handleInteractionClick = async (interaction) => {
    if (interaction.extraPayload?.evaluated && interaction.extraPayload?.evaluationId) {
      // If we already have the evaluation ID, navigate directly
      navigate(`/evaluation/${interaction.extraPayload.evaluationId}`);
    } else if (interaction.extraPayload?.evaluated) {
      // If interaction is marked as evaluated but we don't have the ID, fetch it
      try {
        const response = await fetch(`/api/qa/evaluation/by-interaction/${interaction._id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch evaluation');
        }
        
        const data = await response.json();
        navigate(`/evaluation/${data.evaluationId}`);
      } catch (error) {
        console.error('Error fetching evaluation by interaction ID:', error);
        setError('Unable to find the evaluation for this interaction');
      }
    } else {
      // For non-evaluated interactions, toggle selection
      handleSelectionChange(interaction._id);
    }
  };

  const QueueConfirmationModal = () => {
    if (!showQueueConfirmation) return null;
    
    return (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Evaluations Queued</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowQueueConfirmation(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>{queuedJobsCount} evaluations have been queued for processing.</p>
                <p>Would you like to monitor their progress?</p>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowQueueConfirmation(false)}
                >
                  No, Stay Here
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => {
                    setShowQueueConfirmation(false);
                    navigate('/queue-monitor');
                  }}
                >
                  Go to Queue Monitor
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };  

  const formatDurationHumanReadable = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = '';
    
    if (hours > 0) {
      result += `${hours} ${hours === 1 ? 'hr' : 'hrs'} `;
    }
    
    if (minutes > 0 || hours > 0) {
      result += `${minutes} ${minutes === 1 ? 'min' : 'mins'} `;
    }
    
    if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) {
      result += `${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
    }
    
    return result.trim();
  };

  // Update selectAll state when selections change
  useEffect(() => {
    if (interactions.length > 0 && selectedInteractions.length === interactions.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedInteractions, interactions]);

  if (loading && interactions.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      )}

      {/* Filters - ENHANCED with channels */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Search Filters</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {/* Date Range */}
            <div className="col-md-6">
              <label className="form-label">From Date</label>
              <input
                type="datetime-local"
                className="form-control"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">To Date</label>
              <input
                type="datetime-local"
                className="form-control"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
            
            {/* Criteria Profile */}
            <div className="col-md-6">
              <label className="form-label">Criteria Profile (Optional)</label>
              <Select
                options={options.criteriaProfiles.map(profile => ({
                  value: profile._id,
                  label: profile.name
                }))}
                value={filters.criteriaProfileId ? {
                  value: filters.criteriaProfileId,
                  label: options.criteriaProfiles.find(p => p._id === filters.criteriaProfileId)?.name
                } : null}
                onChange={(selected) => handleSelectChange('criteriaProfileId', selected)}
                isClearable
                placeholder="Select a criteria profile"
              />
              <small className="form-text text-muted">
                Selecting a profile will auto-fill the fields below based on the profile settings
              </small>
            </div>
            
            {/* QA Form */}
            <div className="col-md-6">
              <label className="form-label">QA Form</label>
              <Select
                options={options.qaForms.map(form => ({
                  value: form._id,
                  label: form.name
                }))}
                value={filters.qaFormId ? {
                  value: filters.qaFormId,
                  label: options.qaForms.find(f => f._id === filters.qaFormId)?.name
                } : null}
                onChange={(selected) => handleSelectChange('qaFormId', selected)}
                placeholder="Select QA form"
                isRequired
              />
            </div>

            {/* Queues */}
            <div className="col-md-6">
              <label className="form-label">Queues</label>
              <Select
                isMulti
                options={options.queues.map(queue => ({
                  value: queue.id,
                  label: queue.name
                }))}
                value={filters.queueIds.map(id => {
                  const queue = options.queues.find(q => q.id.toString() === id.toString());
                  return queue ? { value: queue.id, label: queue.name } : null;
                }).filter(Boolean)}
                onChange={(selected) => handleSelectChange('queueIds', selected)}
                placeholder="Select queues"
              />
            </div>

            {/* Agents */}
            <div className="col-md-6">
              <label className="form-label">Agents</label>
              <Select
                isMulti
                options={options.agents.map(agent => ({
                  value: agent.id,
                  label: agent.name
                }))}
                value={filters.agentIds.map(id => {
                  const agent = options.agents.find(a => a.id.toString() === id.toString());
                  return agent ? { value: agent.id, label: agent.name } : null;
                }).filter(Boolean)}
                onChange={(selected) => handleSelectChange('agentIds', selected)}
                placeholder="Select agents"
                isDisabled={userInfo && userInfo.isAgent && !userInfo.isAdmin} // Disable for agents
              />
              {userInfo && userInfo.isAgent && !userInfo.isAdmin && (
                <small className="form-text text-muted">
                  As an agent, you can only create evaluations for yourself
                </small>
              )}
            </div>
            
            {/* NEW: Channels */}
            <div className="col-md-4">
              <label className="form-label">Channels</label>
              <Select
                isMulti
                options={options.channels.map(channel => ({
                  value: channel.id,
                  label: `${channel.name} (${channel.type})`
                }))}
                value={filters.channels.map(id => {
                  const channel = options.channels.find(c => c.id === id);
                  return channel ? { value: channel.id, label: `${channel.name} (${channel.type})` } : null;
                }).filter(Boolean)}
                onChange={(selected) => handleSelectChange('channels', selected)}
                placeholder="Select channels (leave empty for all)"
              />
              <small className="form-text text-muted">
                Filter by communication channel. Leave empty to include all channels.
              </small>
            </div>
            {/* Duration */}
            <div className="col-md-4">
              <label className="form-label">Duration (seconds)</label>
              <div className="input-group">
                <select
                  className="form-select"
                  name="durationComparison"
                  value={filters.durationComparison}
                  onChange={handleFilterChange}
                  style={{ maxWidth: '60px' }}
                >
                  <option value=">">{">"}</option>
                  <option value="<">{"<"}</option>
                  <option value="=">{"="}</option>
                </select>
                <input
                  type="number"
                  className="form-control"
                  name="minDuration"
                  value={filters.minDuration}
                  onChange={handleFilterChange}
                  min="0"
                />
              </div>
            </div>
            
            <div className="col-md-4">
              <label className="form-label">Direction</label>
              <select
                className="form-select"
                name="direction"
                value={filters.direction}
                onChange={handleFilterChange}
              >
                <option value="all">All</option>
                <option value="0">Inbound</option>
                <option value="1">Outbound</option>
              </select>
            </div>
            
            {/* Work Codes */}
            <div className="col-md-6">
              <label className="form-label">Work Codes</label>
              <Select
                isMulti
                options={options.workCodes.map(code => ({
                  value: code.id,
                  label: code.name
                }))}
                value={filters.workCodeIds.map(id => {
                  const code = options.workCodes.find(c => c.id.toString() === id.toString());
                  return code ? { value: code.id, label: code.name } : null;
                }).filter(Boolean)}
                onChange={(selected) => handleSelectChange('workCodeIds', selected)}
                placeholder="Select work codes"
              />
            </div>
          </div>

          <div className="row g-3 mt-3">
            <div className="col-auto me-auto">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="excludeEvaluated"
                  id="excludeEvaluated"
                  checked={filters.excludeEvaluated}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    excludeEvaluated: e.target.checked
                  }))}
                />
                <label className="form-check-label" htmlFor="excludeEvaluated">
                  Exclude already evaluated interactions
                </label>
              </div>
            </div>
            
            <div className="col-auto">
              <button
                className="btn btn-primary"
                onClick={searchInteractions}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Searching...
                  </>
                ) : (
                  'Search Interactions'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactions Table - ENHANCED with channels */}
      {interactions.length > 0 && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Interactions ({interactions.length})</h5>
            <button
              className="btn btn-success"
              onClick={runEvaluations}
              disabled={submitting || selectedInteractions.length === 0}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Processing...
                </>
              ) : (
                `Run Evaluations (${selectedInteractions.length})`
              )}
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAllChange}
                      />
                    </div>
                  </th>
                  <th>Date/Time</th>
                  <th>Channel</th> {/* NEW COLUMN */}
                  <th>Agent</th>
                  <th>Queue</th>
                  <th>Duration</th>
                  <th>Caller ID</th>
                  <th>Recording/Messages</th> {/* ENHANCED COLUMN */}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {interactions.map(interaction => {
                  const isTextChannel = TEXT_CHANNELS.includes(interaction.channel);
                  const hasRecording = !!(interaction.extraPayload?.callRecording?.webPathQA || 
                                         interaction.extraPayload?.callRecording?.webPath);
                  
                  return (
                    <tr key={interaction._id} 
                      onClick={() => handleInteractionClick(interaction)}
                      className={interaction.extraPayload?.evaluated ? 'table-info cursor-pointer' : 'cursor-pointer'}
                    >
                      <td>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedInteractions.includes(interaction._id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectionChange(interaction._id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </td>
                      <td>
                        {interaction.createdAt 
                          ? format(new Date(interaction.createdAt), 'MMM d, yyyy h:mm a')
                          : 'N/A'}
                      </td>
                      {/* NEW: Channel column */}
                      <td>
                        <span className={`badge ${getChannelBadgeColor(interaction.channel)} me-1`}>
                          {getChannelDisplayName(interaction.channel)}
                        </span>
                        {isTextChannel && interaction.messageCount > 0 && (
                          <small className="text-muted d-block">
                            {interaction.messageCount} messages
                          </small>
                        )}
                      </td>
                      <td>{interaction.agent?.name || 'N/A'}</td>
                      <td>{interaction.queue?.name || 'N/A'}</td>
                      <td>
                        {isTextChannel ? (
                          <span className="text-muted">Text Conversation</span>
                        ) : (
                          formatDurationHumanReadable(interaction?.connect?.duration || 0)
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          {!isTextChannel && (
                            <>
                              {interaction.direction === '0' || interaction.direction === 0 ? (
                                <PhoneIncoming size={16} className="text-success me-2" title="Incoming Call" />
                              ) : (
                                <PhoneOutgoing size={16} className="text-primary me-2" title="Outgoing Call" />
                              )}
                            </>
                          )}
                          <span>{interaction.caller?.id || 'Unknown'}</span>
                        </div>
                      </td>
                      {/* ENHANCED: Recording/Messages column */}
                      <td>
                        {isTextChannel ? (
                          interaction.messageCount > 0 ? (
                            <span className="badge bg-success">
                              {interaction.messageCount} Messages
                            </span>
                          ) : (
                            <span className="badge bg-warning">No Messages</span>
                          )
                        ) : (
                          <>
                            {interaction.extraPayload?.callRecording?.webPathQA ? (
                              <span className="badge bg-success">Available</span>
                            ) : interaction.extraPayload?.callRecording?.webPath ? (
                              <span className="badge bg-warning">Available</span>
                            ) : (
                              <span className="badge bg-danger">Missing</span>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        {interaction.extraPayload?.evaluated ? (
                          <button
                            onClick={() => navigate(`/evaluation/${interaction.extraPayload.evaluationId}`)}
                            className="btn btn-sm btn-info"
                          >
                            <i className="bi bi-check-circle-fill me-1"></i>
                            View Evaluation
                          </button>
                        ) : (
                          <span className="badge bg-secondary">Not Evaluated</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <QueueConfirmationModal />
    </div>
  );
};

export default NewEvaluations;