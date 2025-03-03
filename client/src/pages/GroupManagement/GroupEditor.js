// src/pages/GroupManagement/GroupEditor.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { AVAILABLE_MODULES, createEmptyPermissionsTemplate } from '../../constants/permissions';

const GroupEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: createEmptyPermissionsTemplate()
  });
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEditMode) {
      fetchGroupData();
    }
  }, [id]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch group');
      }

      const groupData = await response.json();
      
      // Parse permissions if they're a string
      let permissions = createEmptyPermissionsTemplate();
      
      if (groupData.permissions) {
        try {
          const parsedPermissions = typeof groupData.permissions === 'string' 
            ? JSON.parse(groupData.permissions) 
            : groupData.permissions;
            
          // Merge with default template to ensure all modules are present
          permissions = {
            ...permissions,
            ...parsedPermissions
          };
        } catch (e) {
          console.error('Error parsing permissions:', e);
        }
      }
      
      setFormData({
        name: groupData.name || '',
        description: groupData.description || '',
        permissions
      });
      
      setError(null);
    } catch (err) {
      console.error('Error fetching group:', err);
      setError('Failed to load group data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handlePermissionChange = (moduleKey, action, value) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [moduleKey]: {
          ...formData.permissions[moduleKey],
          [action]: value
        }
      }
    });
  };

  const handleModuleSelectAll = (moduleKey, value) => {
    const updatedModule = {};
    
    // Set all actions within the module to the specified value
    AVAILABLE_MODULES[moduleKey].actions.forEach(action => {
      updatedModule[action] = value;
    });
    
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [moduleKey]: updatedModule
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      setError('Group name is required');
      return;
    }
    
    try {
      setSaving(true);
      
      const method = isEditMode ? 'PUT' : 'POST';
      const url = isEditMode ? `/api/groups/${id}` : '/api/groups';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save group');
      }

      // Redirect back to groups list
      navigate('/groups');
    } catch (err) {
      console.error('Error saving group:', err);
      setError(err.message || 'Failed to save group. Please try again.');
    } finally {
      setSaving(false);
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
      <div className="d-flex align-items-center mb-4">
        <button 
          className="btn btn-link p-0 me-3"
          onClick={() => navigate('/groups')}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="h3 mb-0">{isEditMode ? 'Edit Group' : 'New Group'}</h1>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Group Details</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Group Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Permissions</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead className="table-light">
                  <tr>
                    <th>Module</th>
                    <th>Description</th>
                    <th>Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(AVAILABLE_MODULES).map(([moduleKey, moduleData]) => (
                    <tr key={moduleKey}>
                      <td>
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`module-${moduleKey}`}
                            checked={Object.values(formData.permissions[moduleKey]).some(v => v)}
                            onChange={(e) => handleModuleSelectAll(moduleKey, e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor={`module-${moduleKey}`}>
                            {moduleData.name}
                          </label>
                        </div>
                      </td>
                      <td>{moduleData.description}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-3">
                          {moduleData.actions.map(action => (
                            <div className="form-check" key={`${moduleKey}-${action}`}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id={`${moduleKey}-${action}`}
                                checked={formData.permissions[moduleKey][action] || false}
                                onChange={(e) => handlePermissionChange(moduleKey, action, e.target.checked)}
                              />
                              <label className="form-check-label text-capitalize" htmlFor={`${moduleKey}-${action}`}>
                                {action}
                              </label>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button 
            type="button" 
            className="btn btn-outline-secondary"
            onClick={() => navigate('/groups')}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary d-flex align-items-center"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} className="me-2" />
                Save Group
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroupEditor;