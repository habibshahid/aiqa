// src/pages/QAForms/QAFormsList.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Plus } from 'lucide-react';

const QAFormsList = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/qa-forms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch forms');
      }

      const data = await response.json();
      setForms(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching forms:', err);
      setError('Failed to fetch QA forms. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (formId, formName) => {
    if (!window.confirm(`Are you sure you want to delete the form "${formName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/qa-forms/${formId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete form');
      }

      // Remove form from state
      setForms(forms.filter(form => form._id !== formId));
      setError(null);
    } catch (err) {
      console.error('Error deleting form:', err);
      setError('Failed to delete the form. Please try again later.');
    }
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
        <h1 className="h3 mb-0">QA Forms</h1>
        <button 
          className="btn btn-primary d-flex align-items-center"
          onClick={() => navigate('/qa-forms/new')}
        >
          <Plus size={18} className="me-2" />
          New Form
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {forms.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <h5 className="text-muted mb-3">No QA Forms Available</h5>
            <p className="mb-0">Click the "New Form" button to create your first QA form.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Form Name</th>
                  <th>Description</th>
                  <th>Parameters</th>
                  <th>Created At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
              {forms.length === 0 ? (
                <tr>
                    <td colSpan="8" className="text-center py-4">
                    <div className="text-muted">
                        <p className="mb-0">No Evaluations forms found</p>
                        <small>Click "New Form" to create one</small>
                    </div>
                    </td>
                </tr>
                ) : (
                forms.map(form => (
                  <tr key={form._id}>
                    <td>{form.name}</td>
                    <td>
                      <span className="text-truncate d-inline-block" style={{ maxWidth: '300px' }}>
                        {form.description}
                      </span>
                    </td>
                    <td>{form.parameters?.length || 0} parameters</td>
                    <td>{new Date(form.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge bg-${form.isActive ? 'success' : 'danger'}`}>
                        {form.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => navigate(`/qa-forms/edit/${form._id}`)}
                          title="Edit Form"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(form._id, form.name)}
                          title="Delete Form"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default QAFormsList;