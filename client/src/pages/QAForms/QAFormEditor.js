// src/pages/QAForms/QAFormEditor.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ArrowLeft } from 'lucide-react';
import Select from 'react-select';

const initialParameterState = {
  name: '',
  description: '',
  maxScore: 5,
  scoringType: 'variable',
};

const QAFormEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [queues, setQueues] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    parameters: [{ ...initialParameterState }]
  });

  useEffect(() => {
    const fetchQueues = async () => {
      try {
        const response = await fetch('/api/queues', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch queues');
        const data = await response.json();
        setQueues(data);
      } catch (error) {
        console.error('Error fetching queues:', error);
        setError('Failed to load queues');
      }
    };

    fetchQueues();
    if (id) {
      fetchForm();
    }
  }, [id]);

  const fetchForm = async () => {
    try {
      const response = await fetch(`/api/qa-forms/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch form');
      }

      const data = await response.json();
      setFormData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching form:', err);
      setError('Failed to load the form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);

      // Validate parameters
      if (!formData.parameters.length) {
        throw new Error('At least one parameter is required');
      }

      // Add order to parameters
      const orderedParameters = formData.parameters.map((param, index) => ({
        ...param,
        order: index
      }));

      const response = await fetch(`/api/qa-forms${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          parameters: orderedParameters
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save form');
      }

      navigate('/qa-forms');
    } catch (err) {
      console.error('Error saving form:', err);
      setError(err.message || 'Failed to save the form. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleParameterChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.map((param, i) => 
        i === index ? { ...param, [field]: value } : param
      )
    }));
  };

  const addParameter = () => {
    setFormData(prev => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        { ...initialParameterState }
      ]
    }));
  };

  const removeParameter = (index) => {
    if (formData.parameters.length <= 1) {
      setError('At least one parameter is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <button 
            type="button"
            className="btn btn-link p-0 me-3"
            onClick={() => navigate('/qa-forms')}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="h3 mb-0">{id ? 'Edit QA Form' : 'New QA Form'}</h1>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Form Details</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Form Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  maxLength={100}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  maxLength={500}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Evaluation Parameters</h5>
          <button
            type="button"
            className="btn btn-outline-primary d-flex align-items-center"
            onClick={addParameter}
          >
            <Plus size={16} className="me-2" />
            Add Parameter
          </button>
        </div>
        
        {formData.parameters.map((param, index) => (
          <div key={index} className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between mb-3">
                <h6 className="card-title">Parameter {index + 1}</h6>
                {index > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeParameter(index)}
                    title="Remove Parameter"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Parameter Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={param.name}
                    onChange={(e) => handleParameterChange(index, 'name', e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label">Max Score</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="5"
                    value={param.maxScore}
                    onChange={(e) => handleParameterChange(index, 'maxScore', parseInt(e.target.value))}
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label">Scoring Type</label>
                  <select
                    className="form-select"
                    value={param.scoringType}
                    onChange={(e) => handleParameterChange(index, 'scoringType', e.target.value)}
                    required
                  >
                    <option value="binary">Binary</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">Context</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={param.context}
                    onChange={(e) => handleParameterChange(index, 'context', e.target.value)}
                    required
                    maxLength={1000}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="d-flex justify-content-end gap-2 mt-4">
          <button 
            type="button" 
            className="btn btn-outline-secondary"
            onClick={() => navigate('/qa-forms')}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              'Save Form'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QAFormEditor;