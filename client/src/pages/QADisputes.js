// src/pages/QADisputes.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, X, MessageSquare } from 'lucide-react';
import { api } from '../services/api';

const QADisputes = () => {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchDisputes();
  }, []);
  
  const fetchDisputes = async () => {
    try {
      setLoading(true);
      // This endpoint would need to be implemented
      const response = await fetch('/api/qa/disputes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch disputed evaluations');
      }
      
      const data = await response.json();
      setDisputes(data);
    } catch (err) {
      console.error('Error fetching disputes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleResolveDispute = async (id, resolution) => {
    try {
      // This endpoint would need to be implemented
      const response = await fetch(`/api/qa/evaluation/${id}/resolve-dispute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolution })
      });
      
      if (!response.ok) {
        throw new Error('Failed to resolve dispute');
      }
      
      // Refresh disputes list
      fetchDisputes();
    } catch (err) {
      console.error('Error resolving dispute:', err);
      setError(err.message);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">Error Loading Disputes</h4>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchDisputes}>
          Try Again
        </button>
      </div>
    );
  }
  
  return (
    <div className="container-fluid py-4">
      <div className="card mb-4">
        <div className="card-header bg-danger text-white">
          <h5 className="card-title mb-0">
            <AlertTriangle size={18} className="me-2" />
            Disputed Evaluations
          </h5>
        </div>
        <div className="card-body">
          {disputes.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="text-success mb-3" />
              <h5>No Disputed Evaluations</h5>
              <p className="text-muted">All evaluations are currently in good standing.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Date Disputed</th>
                    <th>Agent</th>
                    <th>Original Score</th>
                    <th>Agent Comments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map(dispute => (
                    <tr key={dispute.id}>
                      <td>{format(new Date(dispute.updatedAt), 'MMM d, yyyy')}</td>
                      <td>{dispute.agent?.name || 'Unknown'}</td>
                      <td>
                        <div className={`badge bg-${
                          dispute.scorePerc >= 90 ? 'success' : 
                          dispute.scorePerc >= 70 ? 'warning' : 'danger'
                        }`}>
                          {dispute.score || 0}
                          {dispute.maxScore ? ` / ${dispute.maxScore}` : ''}
                        </div>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '300px' }}>
                          {dispute.humanEvaluation?.agentComments || 'No comments provided'}
                        </div>
                      </td>
                      <td>
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => navigate(`/evaluation/${dispute.id}`)}
                            title="View Details"
                          >
                            <MessageSquare size={16} />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleResolveDispute(dispute.id, 'accept')}
                            title="Accept Dispute"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleResolveDispute(dispute.id, 'reject')}
                            title="Reject Dispute"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QADisputes;