// src/pages/SchedulerDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, Play, AlarmClock, Edit, 
  AlertTriangle, CheckCircle, XCircle, RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';

const SchedulerDashboard = () => {
  const navigate = useNavigate();
  const [activeSchedules, setActiveSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [manualRunCount, setManualRunCount] = useState(50);
  const [runningManual, setRunningManual] = useState(false);
  const [manualRunResult, setManualRunResult] = useState(null);
  const [showManualRunModal, setShowManualRunModal] = useState(false);
  
  // Fetch active scheduled profiles
  const fetchSchedules = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/scheduler/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch scheduled profiles');
      }
      
      const data = await response.json();
      setActiveSchedules(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching scheduled profiles:', error);
      setError('Failed to load scheduled profiles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Fetch data on component mount
  useEffect(() => {
    fetchSchedules();
  }, []);
  
  // Run a scheduled evaluation manually
  const handleManualRun = async () => {
    if (!selectedProfile) return;
    
    try {
      setRunningManual(true);
      setManualRunResult(null);
      
      const response = await fetch(`/api/scheduler/run/${selectedProfile._id}`, {
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
      
      // Refresh schedules to see updated lastRun info
      fetchSchedules();
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
  
  // Handle edit profile click
  const handleEditProfile = (profileId) => {
    navigate(`/criteria/edit/${profileId}`);
  };
  
  // Format cron expression to human-readable format
  const formatCronExpression = (expression) => {
    // Common cron patterns
    const patterns = {
      '0 0 * * *': 'Daily at midnight',
      '0 9 * * *': 'Daily at 9:00 AM',
      '0 17 * * *': 'Daily at 5:00 PM',
      '0 0 * * 1-5': 'Weekdays at midnight',
      '0 9 * * 1-5': 'Weekdays at 9:00 AM',
      '0 17 * * 1-5': 'Weekdays at 5:00 PM',
      '0 0 * * 0,6': 'Weekends at midnight',
      '0 0 1 * *': 'First day of month at midnight'
    };
    
    return patterns[expression] || expression;
  };
  
  // Format date to readable string
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  };
  
  // Manual run modal component
  const ManualRunModal = () => {
    if (!showManualRunModal) return null;
    
    return (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Run Scheduled Evaluation</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowManualRunModal(false);
                    setManualRunResult(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  You are about to manually run the scheduled evaluation for:
                  <strong className="d-block mt-2">{selectedProfile?.name}</strong>
                </p>
                
                <div className="mb-3">
                  <label className="form-label">Number of Evaluations</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="1000"
                    value={manualRunCount}
                    onChange={(e) => setManualRunCount(parseInt(e.target.value))}
                    disabled={runningManual}
                  />
                  <div className="form-text">Maximum number of interactions to evaluate</div>
                </div>
                
                {manualRunResult && (
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
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowManualRunModal(false);
                    setManualRunResult(null);
                  }}
                  disabled={runningManual}
                >
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary d-flex align-items-center" 
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
            </div>
          </div>
        </div>
      </>
    );
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

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-end mb-4">
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary d-flex align-items-center"
            onClick={fetchSchedules}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={`me-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/criteria/new')}
          >
            Create New Profile
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <AlertTriangle size={16} className="me-2" />
          {error}
        </div>
      )}

      {activeSchedules.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="mb-3">
              <AlarmClock size={48} className="text-muted" />
            </div>
            <h5 className="text-muted mb-3">No Active Scheduled Profiles</h5>
            <p className="mb-4">You don't have any active scheduled evaluation profiles yet.</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/criteria/new')}
            >
              Create New Profile
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header bg-white">
            <h5 className="card-title mb-0">Active Scheduled Profiles</h5>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Profile Name</th>
                  <th>Schedule</th>
                  <th>Maximum Evaluations</th>
                  <th>QA Form</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeSchedules.map(profile => (
                  <tr key={profile._id}>
                    <td>{profile.name}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <Clock size={16} className="me-2 text-muted" />
                        {formatCronExpression(profile.scheduler.cronExpression)}
                      </div>
                    </td>
                    <td>{profile.scheduler.maxEvaluations}</td>
                    <td>{profile.evaluationForm.formName}</td>
                    <td>
                      {profile.scheduler.lastRun ? (
                        <div>
                          {formatDate(profile.scheduler.lastRun)}
                          {profile.scheduler.lastRunStatus && (
                            <div className="mt-1">
                              <span className={`badge bg-${
                                profile.scheduler.lastRunStatus === 'success' ? 'success' :
                                profile.scheduler.lastRunStatus === 'partial' ? 'warning' : 'danger'
                              }`}>
                                {profile.scheduler.lastRunStatus}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">Never run</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${profile.isRunning ? 'bg-success' : 'bg-secondary'}`}>
                        {profile.isRunning ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleEditProfile(profile._id)}
                          title="Edit Profile"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-success"
                          onClick={() => {
                            setSelectedProfile(profile);
                            setManualRunCount(profile.scheduler.maxEvaluations);
                            setShowManualRunModal(true);
                          }}
                          title="Run Now"
                        >
                          <Play size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Stats Cards */}
      {activeSchedules.length > 0 && (
        <div className="row mt-4">
          <div className="col-md-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">Active Profiles</h6>
                <div className="d-flex align-items-center">
                  <h3 className="mb-0 me-3">{activeSchedules.length}</h3>
                  <div className="bg-primary bg-opacity-10 rounded-circle p-2">
                    <AlarmClock size={24} className="text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">Running Schedules</h6>
                <div className="d-flex align-items-center">
                  <h3 className="mb-0 me-3">
                    {activeSchedules.filter(p => p.isRunning).length}
                  </h3>
                  <div className="bg-success bg-opacity-10 rounded-circle p-2">
                    <CheckCircle size={24} className="text-success" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">Last Run Success</h6>
                <div className="d-flex align-items-center">
                  <h3 className="mb-0 me-3">
                    {activeSchedules.filter(p => p.scheduler.lastRunStatus === 'success').length}
                  </h3>
                  <div className="bg-success bg-opacity-10 rounded-circle p-2">
                    <CheckCircle size={24} className="text-success" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">Last Run Failed</h6>
                <div className="d-flex align-items-center">
                  <h3 className="mb-0 me-3">
                    {activeSchedules.filter(p => p.scheduler.lastRunStatus === 'failed').length}
                  </h3>
                  <div className="bg-danger bg-opacity-10 rounded-circle p-2">
                    <XCircle size={24} className="text-danger" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <ManualRunModal />
    </div>
  );
};

export default SchedulerDashboard;