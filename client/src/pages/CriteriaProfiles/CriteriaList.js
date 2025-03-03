// src/pages/CriteriaProfiles/CriteriaList.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Plus } from 'lucide-react';
import { api } from '../../services/api';

export default function CriteriaList() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const data = await api.getCriteriaProfiles();
      setProfiles(data);
    } catch (error) {
      setError('Failed to fetch profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete profile "${name}"?`)) return;
    
    try {
      await api.deleteCriteriaProfile(id);
      setProfiles(profiles.filter(profile => profile._id !== id));
    } catch (error) {
      setError('Failed to delete profile');
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Criteria Profiles</h1>
        <button 
          className="btn btn-primary d-flex align-items-center"
          onClick={() => navigate('/criteria/new')}
        >
          <Plus size={18} className="me-2" />
          New Profile
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Queues</th>
                <th>Agents</th>
                <th>Form</th>
                <th>Direction</th>
                <th>Min Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
            {profiles.length === 0 ? (
                <tr>
                    <td colSpan="8" className="text-center py-4">
                    <div className="text-muted">
                        <p className="mb-0">No criteria profiles found</p>
                        <small>Click "New Profile" to create one</small>
                    </div>
                    </td>
                </tr>
                ) : (
                profiles.map(profile => (
                    <tr key={profile._id}>
                    <td>{profile.name}</td>
                    <td>
                        {profile.queues.map(q => (
                        <span key={q.queueId} className="badge bg-light text-dark me-1">
                            {q.queueName}
                        </span>
                        ))}
                    </td>
                    <td>
                        {profile.agents.map(a => (
                        <span key={a.agentId} className="badge bg-light text-dark me-1">
                            {a.agentName}
                        </span>
                        ))}
                    </td>
                    <td>{profile.evaluationForm.formName}</td>
                    <td>
                        <span className="text-capitalize">{profile.direction}</span>
                    </td>
                    <td>{profile.minCallDuration}s</td>
                    <td>
                        <span className={`badge bg-${profile.isActive ? 'success' : 'danger'}`}>
                        {profile.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <div className="btn-group">
                        <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => navigate(`/criteria/edit/${profile._id}`)}
                        >
                            <Edit size={16} />
                        </button>
                        <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(profile._id, profile.name)}
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
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
}