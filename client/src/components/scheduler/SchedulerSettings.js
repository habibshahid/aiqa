// src/components/scheduler/SchedulerSettings.js
import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Play, List, AlarmClock } from 'lucide-react';
import Select from 'react-select';

// Cron expression presets
const CRON_PRESETS = [
  { value: '0 17 * * *', label: 'Daily at 5:00 PM' },
  { value: '0 9 * * *', label: 'Daily at 9:00 AM' },
  { value: '0 0 * * *', label: 'Daily at midnight' },
  { value: '0 17 * * 1-5', label: 'Weekdays at 5:00 PM' },
  { value: '0 17 * * 0,6', label: 'Weekends at 5:00 PM' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 */12 * * *', label: 'Every 12 hours' },
  { value: '0 0 * * 1', label: 'Monday at midnight' },
  { value: '0 0 1 * *', label: 'First day of month at midnight' },
];

// Component to display human-readable cron schedule
const CronDescription = ({ expression }) => {
  const preset = CRON_PRESETS.find(p => p.value === expression);
  if (preset) {
    return <span className="text-muted">{preset.label}</span>;
  }
  
  try {
    // Basic parsing for common expressions
    const parts = expression.split(' ');
    if (parts.length !== 5) return <span className="text-muted">Custom schedule</span>;
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    // Simple hour:minute
    if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return <span className="text-muted">Daily at {hour.padStart(2, '0')}:{minute.padStart(2, '0')}</span>;
    }
    
    return <span className="text-muted">Custom schedule</span>;
  } catch (e) {
    return <span className="text-muted">Custom schedule</span>;
  }
};

const SchedulerSettings = ({ value, onChange, isNewProfile = false }) => {
  // Initialize state with provided value or defaults
  const [formData, setFormData] = useState({
    enabled: false,
    cronExpression: '0 17 * * *', // Default to 5:00 PM daily
    maxEvaluations: 50,
    evaluatorId: 'system',
    evaluatorName: 'Automated System',
    ...value
  });
  
  const [schedulerHistory, setSchedulerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showManualRun, setShowManualRun] = useState(false);
  const [manualRunCount, setManualRunCount] = useState(formData.maxEvaluations || 50);
  const [runningManual, setRunningManual] = useState(false);
  const [manualRunResult, setManualRunResult] = useState(null);
  
  // Update parent component when formData changes
  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);
  
  // Fetch scheduler history when profileId is available and settings are shown
  useEffect(() => {
    const fetchHistory = async () => {
      if (!value.profileId || !formData.enabled) return;
      
      try {
        setLoadingHistory(true);
        const response = await fetch(`/api/scheduler/history/${value.profileId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch scheduler history');
        }
        
        const data = await response.json();
        setSchedulerHistory(data);
      } catch (error) {
        console.error('Error fetching scheduler history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    if (formData.enabled) {
      fetchHistory();
    }
  }, [value.profileId, formData.enabled]);
  
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleManualRun = async () => {
    if (!value.profileId) return;
    
    try {
      setRunningManual(true);
      setManualRunResult(null);
      
      const response = await fetch(`/api/scheduler/run/${value.profileId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ maxEvaluations: manualRunCount })
      });
      
      if (!response.ok) {
        throw new Error('Failed to run scheduled evaluation');
      }
      
      const result = await response.json();
      setManualRunResult(result.result);
    } catch (error) {
      console.error('Error running scheduled evaluation:', error);
      setManualRunResult({ 
        success: false, 
        error: error.message 
      });
    } finally {
      setRunningManual(false);
    }
  };
  
  // Format date to readable string
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0 d-flex align-items-center">
          <AlarmClock size={18} className="me-2" />
          Automated Scheduler
        </h5>
      </div>
      <div className="card-body">
        <div className="form-check form-switch mb-4">
          <input
            className="form-check-input"
            type="checkbox"
            id="enableScheduler"
            checked={formData.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          <label className="form-check-label" htmlFor="enableScheduler">
            Enable automated evaluation scheduling
          </label>
          {formData.enabled && isNewProfile && (
            <div className="mt-2 text-muted small">
              <i className="bi bi-info-circle me-1"></i>
              Scheduler will be activated after saving the profile.
            </div>
          )}
        </div>
        
        {formData.enabled && (
          <>
            <div className="row mb-4">
              <div className="col-md-6">
                <label className="form-label d-flex align-items-center">
                  <Clock size={16} className="me-2" />
                  Schedule
                </label>
                <Select
                  options={CRON_PRESETS}
                  value={CRON_PRESETS.find(p => p.value === formData.cronExpression) || { 
                    value: formData.cronExpression, 
                    label: 'Custom Schedule' 
                  }}
                  onChange={(selected) => handleChange('cronExpression', selected.value)}
                  isClearable={false}
                />
                <div className="form-text">
                  <CronDescription expression={formData.cronExpression} />
                </div>
              </div>
              
              <div className="col-md-6">
                <label className="form-label d-flex align-items-center">
                  <List size={16} className="me-2" />
                  Maximum Evaluations Per Run
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="1000"
                  value={formData.maxEvaluations}
                  onChange={(e) => handleChange('maxEvaluations', parseInt(e.target.value))}
                />
                <div className="form-text">
                  Maximum number of interactions to evaluate per scheduled run.
                </div>
              </div>
            </div>
            
            {!isNewProfile && value.profileId && (
              <div className="card border mb-4">
                <div className="card-header bg-light">
                  <h6 className="card-title mb-0 d-flex align-items-center">
                    <Play size={16} className="me-2" />
                    Manual Run
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Number of Evaluations</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="1000"
                        value={manualRunCount}
                        onChange={(e) => setManualRunCount(parseInt(e.target.value))}
                      />
                    </div>
                    
                    <div className="col-md-6">
                      <label className="form-label">Action</label>
                      <button
                        className="btn btn-primary w-100"
                        onClick={handleManualRun}
                        disabled={runningManual}
                      >
                        {runningManual ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play size={16} className="me-2" />
                            Run Now
                          </>
                        )}
                      </button>
                    </div>
                    
                    {manualRunResult && (
                      <div className="col-12 mt-2">
                        <div className={`alert ${manualRunResult.success ? 'alert-success' : 'alert-danger'}`}>
                          {manualRunResult.success ? (
                            <>
                              <p className="mb-1">
                                <strong>Success!</strong> Found {manualRunResult.interactionsFound} interactions, processed {manualRunResult.interactionsProcessed}.
                              </p>
                              {manualRunResult.interactionsProcessed === 0 && (
                                <p className="small mb-0">
                                  No interactions were processed. This may be because no interactions matched the criteria or all interactions have already been evaluated.
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mb-0">
                              <strong>Error:</strong> {manualRunResult.error}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Scheduler History */}
            {!isNewProfile && value.profileId && (
              <div className="border rounded mb-3">
                <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                  <h6 className="mb-0 d-flex align-items-center">
                    <Calendar size={16} className="me-2" />
                    Scheduler History
                  </h6>
                </div>
                
                <div className="p-0">
                  {loadingHistory ? (
                    <div className="text-center p-4">
                      <div className="spinner-border spinner-border-sm text-primary me-2" />
                      Loading history...
                    </div>
                  ) : schedulerHistory.length === 0 ? (
                    <div className="text-center p-4 text-muted">
                      <p className="mb-0">No scheduler history available</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Found</th>
                            <th>Processed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedulerHistory.map((history, index) => (
                            <tr key={index}>
                              <td>{formatDate(history.startTime)}</td>
                              <td>
                                <span className={`badge bg-${
                                  history.status === 'success' ? 'success' :
                                  history.status === 'partial' ? 'warning' : 'danger'
                                }`}>
                                  {history.status}
                                </span>
                              </td>
                              <td>{history.interactionsFound}</td>
                              <td>{history.interactionsProcessed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Last Run Info */}
            {formData.lastRun && (
              <div className="mt-4">
                <h6>Last Scheduled Run</h6>
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-1">
                      <strong>Date:</strong> {formatDate(formData.lastRun)}
                    </p>
                    <p className="mb-1">
                      <strong>Status:</strong> {' '}
                      <span className={`badge bg-${
                        formData.lastRunStatus === 'success' ? 'success' :
                        formData.lastRunStatus === 'partial' ? 'warning' : 'danger'
                      }`}>
                        {formData.lastRunStatus || 'N/A'}
                      </span>
                    </p>
                  </div>
                  <div className="col-md-6">
                    {formData.lastRunSummary && (
                      <>
                        <p className="mb-1">
                          <strong>Found:</strong> {formData.lastRunSummary.interactionsFound || 0}
                        </p>
                        <p className="mb-1">
                          <strong>Processed:</strong> {formData.lastRunSummary.interactionsProcessed || 0}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SchedulerSettings;