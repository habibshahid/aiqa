// src/pages/QAForms/QAFormsList.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Plus, Upload, Download, Copy } from 'lucide-react';
import { saveAs } from 'file-saver';

const QAFormsList = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleCloneForm = async (formId, formName) => {
    try {
      const newName = window.prompt(`Enter a name for the cloned form:`, `Copy of ${formName}`);
      if (!newName) return; // User cancelled
      
      const response = await fetch(`/api/qa-forms/${formId}/clone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName })
      });
      
      if (!response.ok) {
        throw new Error('Failed to clone form');
      }
      
      // Refresh the forms list
      fetchForms();
      
    } catch (err) {
      console.error('Error cloning form:', err);
      setError('Failed to clone the form. Please try again later.');
    }
  };
  
  const handleExportForm = async (formId, formName) => {
    try {
      const response = await fetch(`/api/qa-forms/${formId}/export`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to export form');
      }
      
      const data = await response.json();
      
      // Create a download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      saveAs(blob, `${formName.replace(/\s+/g, '_')}_qaform.json`);
      
    } catch (err) {
      console.error('Error exporting form:', err);
      setError('Failed to export the form. Please try again later.');
    }
  };
  
  const handleImportForm = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      // Read the file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const formData = JSON.parse(e.target.result);
          
          // Prompt for a new name
          const originalName = formData.name || "Imported Form";
          const newName = window.prompt(
            "Enter a name for the imported QA evaluation form:", 
            originalName
          );
          
          // If user cancels or doesn't provide a name, abort import
          if (!newName || newName.trim() === '') {
            setError('Form import cancelled. A name is required.');
            return;
          }
          
          // Update the form name
          formData.name = newName.trim();
          
          // Send the form data to the server
          const response = await fetch('/api/qa-forms/import', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to import form');
          }
          
          // Show success message
          setSuccess(`Form "${newName}" imported successfully!`);
          
          // Refresh the forms list
          fetchForms();
          
        } catch (parseErr) {
          console.error('Error parsing import file:', parseErr);
          setError('Invalid form file format. Please select a valid JSON file.');
        }
      };
      
      reader.readAsText(file);
      
      // Reset the file input
      event.target.value = null;
      
    } catch (err) {
      console.error('Error importing form:', err);
      setError('Failed to import the form. Please try again later.');
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
      <div className="d-flex justify-content-end mb-4">
        <button 
          className="btn btn-outline-primary"
          onClick={() => fileInputRef.current.click()}
        >
          <Upload size={18} className="me-2" />
          Import Form
        </button>

        <button 
          className="btn btn-primary d-flex align-items-center"
          onClick={() => navigate('/qa-forms/new')}
        >
          <Plus size={18} className="me-2" />
          New Form
        </button>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".json"
          onChange={handleImportForm}
        />
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {success}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setSuccess(null)}
          ></button>
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
                          className="btn btn-sm btn-outline-success"
                          onClick={() => handleCloneForm(form._id, form.name)}
                          title="Clone Form"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-info"
                          onClick={() => handleExportForm(form._id, form.name)}
                          title="Export Form"
                        >
                          <Download size={16} />
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