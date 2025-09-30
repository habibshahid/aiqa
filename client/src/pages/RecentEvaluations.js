// src/pages/RecentEvaluations.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { PhoneIncoming, PhoneOutgoing, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

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

// Storage keys
const FILTERS_STORAGE_KEY = 'recentEvaluations_filters';
const METRICS_STORAGE_KEY = 'recentEvaluations_metrics';

// Helper functions for storage
const saveFiltersToStorage = (filters) => {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving filters to localStorage:', error);
  }
};

const loadFiltersFromStorage = () => {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading filters from localStorage:', error);
  }
  return null;
};

const saveMetricsToStorage = (metrics) => {
  try {
    sessionStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch (error) {
    console.error('Error saving metrics to sessionStorage:', error);
  }
};

const loadMetricsFromStorage = () => {
  try {
    const stored = sessionStorage.getItem(METRICS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading metrics from sessionStorage:', error);
  }
  return null;
};

const ScoreDisplay = ({ evaluation }) => {
  const isDeductMode = evaluation.scoringMechanism === 'deduct';
  const percentage = evaluation?.sectionScores?.overall?.percentage || 
                    (evaluation?.sectionScores?.overall?.average / 5 * 100) || 0;
  
  return (
    <div className="d-flex flex-column align-items-center">
      {/* Scoring mechanism badge */}
      <span className={`badge mb-1 bg-${isDeductMode ? 'warning text-dark' : 'success'}`}>
        {isDeductMode ? 'Deduct' : 'Award'}
      </span>
      
      {/* Score display */}
      <div className={`badge bg-${
        percentage >= 80 ? 'success' : 
        percentage >= 60 ? 'warning' : 'danger'
      }`}>
        {isDeductMode ? (
          <>
            {evaluation?.sectionScores?.overall?.adjustedScore || evaluation.evaluation?.totalScore || 0}
            {' / '}
            {evaluation.totalScore || 100}
          </>
        ) : (
          <>
            {evaluation?.sectionScores?.overall?.adjustedScore || evaluation.evaluation?.totalScore || 0}
            {' / '}
            {evaluation?.sectionScores?.overall?.maxScore || evaluation.evaluation?.maxScore || 'N/A'}
          </>
        )}
      </div>
      
      {/* Percentage */}
      <small className="text-muted mt-1">
        {percentage.toFixed(0)}%
      </small>
      
      {/* Deductions for deduct mode */}
      {isDeductMode && evaluation.evaluation?.sectionScores?.overall?.totalDeductions > 0 && (
        <small className="text-danger">
          -{evaluation.evaluation?.sectionScores?.overall?.totalDeductions} pts
        </small>
      )}
    </div>
  );
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Evaluation navigation">
      <ul className="pagination justify-content-end mb-0">
        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
          <button
            className="page-link"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
        </li>
        
        {[...Array(totalPages)].map((_, index) => (
          <li key={index + 1} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
            <button
              className="page-link"
              onClick={() => onPageChange(index + 1)}
            >
              {index + 1}
            </button>
          </li>
        ))}

        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
          <button
            className="page-link"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
};

const RecentEvaluations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [metrics, setMetrics] = useState(null);
  const [filters, setFilters] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [isRestrictedView, setIsRestrictedView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isReturningFromDetail, setIsReturningFromDetail] = useState(false);
  
  // Get initial filters with storage
  const getInitialFilters = () => {
    // Check if returning from detail page
    if (location.state?.fromEvaluationDetail) {
      setIsReturningFromDetail(true);
    }

    // Try to load saved filters
    const savedFilters = loadFiltersFromStorage();
    
    if (savedFilters) {
      return savedFilters;
    }

    // Default filters
    return {
      agentId: '',
      queueId: '',
      channelId: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      formId: ''
    };
  };

  const [selectedFilters, setSelectedFilters] = useState(getInitialFilters);
  
  // Track if an API fetch is in progress to prevent duplicate calls
  const isFetchingRef = useRef(false);
  const prevFiltersRef = useRef(null);
  const hasAppliedRestrictedFilterRef = useRef(false);

  // Save filters when they change
  useEffect(() => {
    saveFiltersToStorage(selectedFilters);
  }, [selectedFilters]);

  // Save metrics when they change
  useEffect(() => {
    if (metrics) {
      saveMetricsToStorage(metrics);
    }
  }, [metrics]);

  // Auto-load when returning from detail page
  useEffect(() => {
    if (isReturningFromDetail) {
      const cachedMetrics = loadMetricsFromStorage();
      if (cachedMetrics) {
        setMetrics(cachedMetrics);
        setLoading(false);
      }
      setIsReturningFromDetail(false);
    }
  }, [isReturningFromDetail]);

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
        setSelectedFilters(prev => ({ ...prev, formId: data[0]._id }));
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  // Get user profile - ONLY ONCE
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await api.getUserProfile();
        setUserInfo(userInfo);
        
        // If user is an agent, pre-select their ID in the filters
        if (userInfo.isAgent && !userInfo.isAdmin && userInfo.agentId) {
          setSelectedFilters(prev => ({
            ...prev,
            agentId: userInfo.agentId
          }));
          hasAppliedRestrictedFilterRef.current = true;
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserInfo();
  }, []);

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

  const fetchQueues = useCallback(async () => {
    try {
      let response = await fetch('/api/dashboard/filters', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.queues && data.queues.length > 0) {
          return data.queues;
        }
      }
      
      response = await fetch('/api/queues/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const queues = await response.json();
        return queues;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching queues:', error);
      return [];
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      const channels = await api.getChannels();
      return channels || [];
    } catch (error) {
      console.error('Error fetching channels:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    const loadQueues = async () => {
      if (!filters?.queues || filters.queues.length === 0) {
        const queuesData = await fetchQueues();
        if (queuesData.length > 0) {
          setFilters(prev => ({
            ...prev,
            queues: queuesData
          }));
        }
      }
    };
    
    loadQueues();
  }, [filters, fetchQueues]);
  
  useEffect(() => {
    const loadChannels = async () => {
      if (!filters?.channels || filters.channels.length === 0) {
        const channelsData = await fetchChannels();
        if (channelsData.length > 0) {
          setFilters(prev => ({
            ...prev,
            channels: channelsData
          }));
        }
      }
    };
    
    loadChannels();
  }, [filters, fetchChannels]);

  const getChannelBadgeColor = (channel) => {
    if (TEXT_CHANNELS.includes(channel)) {
      return 'bg-info';
    }
    return 'bg-primary';
  };

  const getChannelDisplayName = (channel) => {
    return CHANNEL_DISPLAY_NAMES[channel] || channel?.charAt(0).toUpperCase() + channel?.slice(1) || 'Unknown';
  };

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    if (prevFiltersRef.current && 
        JSON.stringify(prevFiltersRef.current) === JSON.stringify(selectedFilters)) {
      return;
    }
    
    try {
      if (!selectedFilters.formId && forms.length > 1) {
        setMetrics(null);
        setLoading(false);
        return;
      }
      
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      prevFiltersRef.current = {...selectedFilters};

      const [filtersResponse, metricsResponse] = await Promise.all([
        fetch('/api/dashboard/filters', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch(`/api/dashboard/metrics?${new URLSearchParams(selectedFilters)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      const isRestricted = metricsResponse.headers.get('X-Restricted-View') === 'agent-only';
      setIsRestrictedView(isRestricted);

      if (!filtersResponse.ok || !metricsResponse.ok) {
        throw new Error('Failed to fetch evaluations data');
      }

      const [filtersData, metricsData] = await Promise.all([
        filtersResponse.json(),
        metricsResponse.json()
      ]);

      setFilters(filtersData);
      setMetrics(metricsData);
      
    } catch (err) {
      console.error('Evaluations error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [selectedFilters, forms.length]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [fetchData]);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    if (isRestrictedView && name === 'agentId' && userInfo && userInfo.agentId) {
      return;
    }
    
    setSelectedFilters(prev => {
      const newFilters = {
        ...prev,
        [name]: value
      };
      saveFiltersToStorage(newFilters);
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    const defaultFilters = {
      agentId: userInfo?.isAgent && !userInfo?.isAdmin ? userInfo.agentId : '',
      queueId: '',
      channelId: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      formId: ''
    };
    setSelectedFilters(defaultFilters);
    saveFiltersToStorage(defaultFilters);
    sessionStorage.removeItem(METRICS_STORAGE_KEY);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center my-5">
        <div className="alert alert-danger">
          <h4>Error Loading Evaluations</h4>
          <p>{error}</p>
          <button 
            className="btn btn-outline-danger"
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {isRestrictedView && (
        <div className="alert alert-info d-flex align-items-center mb-4">
          <Lock size={18} className="me-2" />
          <div>
            <strong>Agent View:</strong> You can only see your own evaluations.
          </div>
        </div>
      )}
      
      {!selectedFilters.formId && forms.length > 1 && !loading && (
        <div className="alert alert-info">
          <div className="d-flex align-items-center">
            <i className="bi bi-info-circle me-2"></i>
            <div>Please select a QA Form to view evaluations.</div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Filters</h5>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">QA Form</label>
              <select 
                className="form-select"
                name="formId"
                value={selectedFilters.formId}
                onChange={handleFilterChange}
                disabled={formsLoading}
              >
                <option value="">
                  {formsLoading ? 'Loading forms...' : forms.length > 1 ? 'Select QA Form' : 'All Forms'}
                </option>
                {forms.map(form => (
                  <option key={form._id} value={form._id}>
                    {form.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Agent</label>
              <select 
                className="form-select"
                name="agentId"
                value={selectedFilters.agentId}
                onChange={handleFilterChange}
                disabled={isRestrictedView}
              >
                <option value="">All Agents</option>
                {filters?.agents?.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              {isRestrictedView && (
                <small className="text-muted">You can only view your own evaluations</small>
              )}
            </div>

            <div className="col-md-3">
              <label className="form-label">Queue</label>
              <select
                className="form-select"
                name="queueId"
                value={selectedFilters.queueId}
                onChange={handleFilterChange}
              >
                <option value="">All Queues</option>
                {filters?.queues?.map(queue => (
                  <option key={queue.id} value={queue.id}>
                    {queue.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Channel</label>
              <select
                className="form-select"
                name="channelId"
                value={selectedFilters.channelId}
                onChange={handleFilterChange}
              >
                <option value="">All Channels</option>
                {filters?.channels?.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} ({channel.type})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="col-md-3">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                name="startDate"
                value={selectedFilters.startDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-control"
                name="endDate"
                value={selectedFilters.endDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-md-6 d-flex align-items-end">
              <button
                className="btn btn-outline-secondary"
                onClick={handleClearFilters}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">Recent Evaluations</h5>
          {metrics?.qa?.recentEvaluations && (
            <div className="text-muted small">
              Showing {Math.min(itemsPerPage * currentPage, metrics.qa.recentEvaluations.length)} of {metrics.qa.recentEvaluations.length}
            </div>
          )}
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Channel</th>
                <th>Agent</th>
                <th>Queue</th>
                <th>Duration</th>
                <th>Caller ID</th>
                <th>Scoring</th>
                <th>Score</th>
                <th>Evaluator</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!metrics?.qa?.recentEvaluations || metrics.qa.recentEvaluations.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-4">
                    <div className="text-muted">
                      <p className="mb-0">No Evaluations found.</p>
                      <small>Adjust your filters to find more evaluations</small>
                    </div>
                  </td>
                </tr>
              ) : (
                metrics.qa.recentEvaluations
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map(evaluation => (
                    <tr key={evaluation.id}>
                      <td>{format(new Date(evaluation.createdAt), 'MMM d, yyyy')}</td>
                      <td>
                        <span className={`badge ${getChannelBadgeColor(evaluation.channel)} me-1`}>
                          {getChannelDisplayName(evaluation.channel)}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar-xs me-2">
                            <span className="avatar-title rounded-circle bg-primary bg-soft text-primary">
                              {evaluation.agent?.name?.charAt(0) || 'A'}
                            </span>
                          </div>
                          <span>{evaluation.agent?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>{evaluation.queue?.name || 'N/A'}</td>
                      <td>
                        {formatDurationHumanReadable(evaluation?.duration || 0)}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          {evaluation.direction === '0' || evaluation.direction === 0 ? (
                            <PhoneIncoming size={16} className="text-success me-2" title="Incoming Call" />
                          ) : (
                            <PhoneOutgoing size={16} className="text-primary me-2" title="Outgoing Call" />
                          )}
                          <span>{evaluation.caller?.id || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <ScoreDisplay evaluation={evaluation} />
                      </td>
                      <td>
                        <div className={`badge bg-${
                          evaluation.scorePerc >= 90 ? 'success' : 
                          evaluation.scorePerc >= 70 ? 'warning' : 'danger'
                        }`}>
                          {evaluation.score || 0}
                          {evaluation.maxScore ? ` / ${evaluation.maxScore}` : ''}
                        </div>
                      </td>
                      <td>
                        <small className="text-muted">
                          {evaluation.evaluator?.name || 'AI System'}
                        </small>
                      </td>
                      <td>
                        {evaluation.status === 'disputed' ? (
                          <button
                            onClick={() => navigate(`/evaluation/${evaluation.id}`, {
                              state: { fromRecentEvaluations: true }
                            })}
                            className="btn btn-sm btn-outline-danger"
                          >
                            <AlertTriangle size={14} className="me-1" />
                            Disputed
                          </button>
                        ) : evaluation.status === 'published' ? (
                          <button
                            onClick={() => navigate(`/evaluation/${evaluation.id}`, {
                              state: { fromRecentEvaluations: true }
                            })}
                            className="btn btn-sm btn-outline-success"
                          >
                            <CheckCircle size={14} className="me-1" />
                            View Published
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/evaluation/${evaluation.id}`, {
                              state: { fromRecentEvaluations: true }
                            })}
                            className="btn btn-sm btn-outline-primary"
                          >
                            <i className="bi bi-eye me-1"></i>
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer bg-white">
          <Pagination
            totalItems={metrics?.qa?.recentEvaluations?.length || 0}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
};

export default RecentEvaluations;