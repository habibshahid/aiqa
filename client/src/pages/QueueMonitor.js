// src/pages/QueueMonitor.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

const QueueMonitor = () => {
  const [nextRefreshTime, setNextRefreshTime] = useState(0);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const refreshInterval = 60000; // 1 minute refresh interval
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    total: 0
  });
  const navigate = useNavigate();
  const prevJobs = useRef([]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/qa-process/queue-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job data');
      }

      const data = await response.json();
      setJobs(data.jobs);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(err.message || 'Failed to fetch job queue data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchJobs();
    
    let intervalId = null;
    
    // Only set up interval if auto-refresh is enabled
    if (isAutoRefreshEnabled) {
      // Set next refresh time
      setNextRefreshTime(Date.now() + refreshInterval);
      
      // Set up polling at reduced frequency
      intervalId = setInterval(() => {
        // Only fetch if we're past the next refresh time
        if (Date.now() >= nextRefreshTime) {
          fetchJobs();
          setNextRefreshTime(Date.now() + refreshInterval);
        }
      }, refreshInterval);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoRefreshEnabled]);

  useEffect(() => {
    if (!isAutoRefreshEnabled) {
      setCountdown(0);
      return;
    }
    
    const countdownInterval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((nextRefreshTime - Date.now()) / 1000));
      setCountdown(remaining);
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [nextRefreshTime, isAutoRefreshEnabled]);

  // Set up job completion notifications
  useEffect(() => {
    const setupNotifications = async () => {
      // Check if browser supports notifications
      if (!("Notification" in window)) {
        console.log("This browser does not support notifications");
        return;
      }
      
      // Request permission if needed
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        await Notification.requestPermission();
      }
    };

    setupNotifications();
  }, []);

  // Function to check for newly completed jobs and show notifications
  const checkForCompletedJobs = (newJobs, oldJobs) => {
    if (!oldJobs.length) return; // Skip on first load
    
    const oldJobsMap = new Map(oldJobs.map(job => [job.id, job]));
    
    newJobs.forEach(job => {
      const oldJob = oldJobsMap.get(job.id);
      
      // If job just completed
      if (oldJob && oldJob.state !== 'completed' && job.state === 'completed') {
        showNotification('Evaluation Complete', `Evaluation for interaction ${job.data?.interactionId || 'unknown'} completed successfully.`);
      }
      
      // If job just failed
      if (oldJob && oldJob.state !== 'failed' && job.state === 'failed') {
        showNotification('Evaluation Failed', `Evaluation for interaction ${job.data?.interactionId || 'unknown'} failed: ${job.failedReason || 'Unknown error'}`);
      }
    });
  };

  // Function to show notification
  const showNotification = (title, body) => {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: '/logo192.png'  // Path to your app icon
      });
    }
  };

  // When jobs are updated, check for newly completed ones
  useEffect(() => {
    if (jobs.length > 0) {
      const oldJobs = prevJobs.current;
      checkForCompletedJobs(jobs, oldJobs);
      prevJobs.current = [...jobs];
    }
  }, [jobs]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="badge bg-success"><CheckCircle size={14} className="me-1" /> Completed</span>;
      case 'failed':
        return <span className="badge bg-danger"><XCircle size={14} className="me-1" /> Failed</span>;
      case 'active':
        return <span className="badge bg-primary"><RefreshCw size={14} className="me-1" /> Processing</span>;
      case 'waiting':
        return <span className="badge bg-warning"><Clock size={14} className="me-1" /> Queued</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  const viewEvaluation = (evaluationId) => {
    if (evaluationId) {
      navigate(`/evaluation/${evaluationId}`);
    }
  };

  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // Show failure reason modal
  const showFailureDetails = (reason) => {
    alert(`Error Details: ${reason || 'Unknown error'}`);
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Evaluation Queue Monitor</h1>
        <button 
          className="btn btn-primary d-flex align-items-center"
          onClick={fetchJobs}
          disabled={loading}
        >
          <RefreshCw size={16} className={`me-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={16} className="me-2" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">Total Jobs</h6>
              <h3 className="card-title mb-0">{stats.total}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-warning bg-opacity-10">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-warning">Queued</h6>
              <h3 className="card-title mb-0">{stats.waiting}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-primary bg-opacity-10">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-primary">Processing</h6>
              <h3 className="card-title mb-0">{stats.active}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success bg-opacity-10">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-success">Completed</h6>
              <h3 className="card-title mb-0">{stats.completed}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card">
        <div className="card-header bg-white">
          <h5 className="card-title mb-0">Recent Jobs</h5>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Job ID</th>
                <th>Interaction ID</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Created At</th>
                <th>Completed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    <div className="text-muted">
                      <p className="mb-0">No jobs found</p>
                      <small>Start processing evaluations to see jobs here</small>
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.data?.interactionId || 'N/A'}</td>
                    <td>{getStatusBadge(job.state)}</td>
                    <td>
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className={`progress-bar ${job.state === 'completed' ? 'bg-success' : job.state === 'failed' ? 'bg-danger' : 'bg-primary'}`}
                          role="progressbar" 
                          style={{ width: `${job.progress || 0}%` }}
                          aria-valuenow={job.progress || 0} 
                          aria-valuemin="0" 
                          aria-valuemax="100"
                        />
                      </div>
                      <small className="text-muted">{job.progress || 0}%</small>
                    </td>
                    <td>{formatTimestamp(job.timestamp)}</td>
                    <td>{job.finishedOn ? formatTimestamp(job.finishedOn) : '—'}</td>
                    <td>
                      {job.state === 'completed' && job.result?.success ? (
                        <button 
                          className="btn btn-sm btn-outline-success"
                          onClick={() => viewEvaluation(job.result.evaluationId)}
                        >
                          View Evaluation
                        </button>
                      ) : job.state === 'failed' ? (
                        <button 
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => showFailureDetails(job.failedReason)}
                        >
                          View Error
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QueueMonitor;