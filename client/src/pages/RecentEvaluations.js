// src/pages/RecentEvaluations.js - Fixed to prevent infinite fetch loops
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { PhoneIncoming, PhoneOutgoing, Lock } from 'lucide-react';
import { api } from '../services/api';

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
  const [metrics, setMetrics] = useState(null);
  const [filters, setFilters] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [isRestrictedView, setIsRestrictedView] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    agentId: '',
    queueId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    formId: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  
  // Track if an API fetch is in progress to prevent duplicate calls
  const isFetchingRef = useRef(false);
  // Add a ref to track previous filter selections to avoid unnecessary requests
  const prevFiltersRef = useRef(null);

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

  // Get user profile to determine if agent or admin
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await api.getUserProfile();
        setUserInfo(userInfo);
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

  const fetchData = useCallback(async () => {
    // Check if we're already fetching - prevents duplicate calls
    if (isFetchingRef.current) return;
    
    // Compare with previous filters to avoid unnecessary fetches
    if (prevFiltersRef.current && 
        JSON.stringify(prevFiltersRef.current) === JSON.stringify(selectedFilters)) {
      return;
    }
    
    try {
      // Only fetch data if a form is selected or we're showing all forms
      if (!selectedFilters.formId && forms.length > 1) {
        setMetrics(null);
        setLoading(false);
        return;
      }
      
      // Set fetching flag to true to prevent duplicate requests
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      // Store current filters to compare against future changes
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

      // Check if we're in a restricted view
      const isRestricted = metricsResponse.headers.get('X-Restricted-View') === 'agent-only';
      setIsRestrictedView(isRestricted);

      if (!filtersResponse.ok || !metricsResponse.ok) {
        throw new Error('Failed to fetch evaluations data');
      }

      const [filtersData, metricsData] = await Promise.all([
        filtersResponse.json(),
        metricsResponse.json()
      ]);

      console.log('Metrics Data:', metricsData);
      setFilters(filtersData);
      setMetrics(metricsData);
      
      // If we're in a restricted view and this is the first load
      if (isRestricted && !selectedFilters.agentId && userInfo && userInfo.agentId) {
        // Auto-select the current user's agent ID
        setSelectedFilters(prev => ({
          ...prev,
          agentId: userInfo.agentId
        }));
      }
    } catch (err) {
      console.error('Evaluations error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      // Reset fetching flag when done
      isFetchingRef.current = false;
    }
  }, [selectedFilters, forms.length, userInfo]);

  // Fetch forms on mount
  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Fetch data when filters change
  useEffect(() => {
    // Debounce the fetch to prevent hammering the API with rapid changes
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [fetchData]);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    // If in restricted view, don't allow changing the agent
    if (isRestrictedView && name === 'agentId' && userInfo && userInfo.agentId) {
      return;
    }
    
    setSelectedFilters(prev => ({
      ...prev,
      [name]: value
    }));
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
      {/* Restricted View Notice */}
      {isRestrictedView && (
        <div className="alert alert-info d-flex align-items-center mb-4">
          <Lock size={18} className="me-2" />
          <div>
            <strong>Agent View:</strong> You can only see your own evaluations.
          </div>
        </div>
      )}
      
      {/* Filters */}
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
              <input
                type="date"
                className="form-control"
                name="startDate"
                value={selectedFilters.startDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                name="endDate"
                value={selectedFilters.endDate}
                onChange={handleFilterChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Evaluations */}
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
              <th>Agent</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Caller ID</th>
                  <th>Duration</th>
                  <th>Evaluator</th>
                  <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!metrics?.qa?.recentEvaluations || metrics.qa.recentEvaluations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
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
                      <td>
                        <div className={`badge bg-${
                          evaluation.scorePerc >= 90 ? 'success' : 
                          evaluation.scorePerc >= 70 ? 'warning' : 'danger'
                        }`}>
                          {evaluation.score || 0}
                          {evaluation.maxScore ? ` / ${evaluation.maxScore}` : ''}
                        </div>
                      </td>
                      <td>{format(new Date(evaluation.createdAt), 'MMM d, yyyy')}</td>
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
                        {formatDurationHumanReadable(evaluation?.duration || 0)}
                      </td>
                      <td>
                        <small className="text-muted">
                          Evaluated by: {evaluation.evaluator?.name || 'AI System'}
                        </small>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/evaluation/${evaluation.id}`)}
                          className="btn btn-sm btn-outline-primary"
                        >
                          <i className="bi bi-eye me-1"></i>
                          View Details
                        </button>
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