// src/pages/GroupManagement/GroupsList.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  Edit, 
  Trash2, 
  Plus, 
  Users, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

const GroupsList = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteGroupId, setDeleteGroupId] = useState(null);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedNewGroupId, setSelectedNewGroupId] = useState('');
  const [affectedUsers, setAffectedUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }

      const data = await response.json();
      setGroups(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Failed to load groups. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (groupId) => {
    try {
      setDeleteGroupId(groupId);
      
      // First check if there are users in the group
      const response = await fetch(`/api/groups/${groupId}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to check group users');
      }
      
      const users = await response.json();
      
      if (users.length > 0) {
        // If there are users, open the reassignment modal
        setAffectedUsers(users);
        setReassignModalOpen(true);
      } else {
        // If no users, proceed with direct deletion
        await deleteGroup(groupId);
      }
    } catch (err) {
      console.error('Error handling delete:', err);
      setError('Error checking group users. Please try again.');
      setDeleteGroupId(null);
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete group');
      }

      // Remove group from state
      setGroups(groups.filter(group => group.id !== groupId));
      setError(null);
      setDeleteGroupId(null);
      setReassignModalOpen(false);
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('Failed to delete the group. Please try again.');
      setDeleteGroupId(null);
    }
  };

  const handleReassignAndDelete = async () => {
    if (!selectedNewGroupId) {
      setError('Please select a new group for reassignment');
      return;
    }

    try {
      const response = await fetch(`/api/groups/${deleteGroupId}/reassign-and-delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newGroupId: selectedNewGroupId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reassign users and delete group');
      }

      // Update state - remove deleted group and close modal
      setGroups(groups.filter(group => group.id !== deleteGroupId));
      setReassignModalOpen(false);
      setDeleteGroupId(null);
      setSelectedNewGroupId('');
      setAffectedUsers([]);
      setError(null);
    } catch (err) {
      console.error('Error reassigning users and deleting group:', err);
      setError('Failed to reassign users and delete group. Please try again.');
    }
  };

  const ReassignmentModal = () => {
    if (!reassignModalOpen) return null;

    const availableGroups = groups.filter(group => group.id !== deleteGroupId);

    return (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <AlertTriangle size={18} className="text-warning me-2" />
                  Reassign Users
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setReassignModalOpen(false);
                    setDeleteGroupId(null);
                    setSelectedNewGroupId('');
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <p>This group has {affectedUsers.length} user(s) assigned to it. Please select a new group for these users before deleting.</p>
                
                <div className="mb-3">
                  <label className="form-label">New Group</label>
                  <select 
                    className="form-select"
                    value={selectedNewGroupId}
                    onChange={(e) => setSelectedNewGroupId(e.target.value)}
                    required
                  >
                    <option value="">Select a group</option>
                    {availableGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="alert alert-info">
                  <h6>Affected Users:</h6>
                  <ul className="mb-0 small">
                    {affectedUsers.map(user => (
                      <li key={user.id}>
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}`
                          : user.username}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setReassignModalOpen(false);
                    setDeleteGroupId(null);
                    setSelectedNewGroupId('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleReassignAndDelete}
                  disabled={!selectedNewGroupId}
                >
                  Reassign and Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  if (loading && groups.length === 0) {
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
        <h1 className="h3 mb-0">Group Management</h1>
        <button 
          className="btn btn-primary d-flex align-items-center"
          onClick={() => navigate('/groups/new')}
        >
          <Plus size={18} className="me-2" />
          New Group
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Groups</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={fetchGroups}>
            <RefreshCw size={16} className="me-1" />
            Refresh
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Permissions</th>
                <th>Users</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    <div className="text-muted">
                      <p className="mb-0">No groups found</p>
                      <small>Click "New Group" to create one</small>
                    </div>
                  </td>
                </tr>
              ) : (
                groups.map(group => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>
                      <span className="text-truncate d-inline-block" style={{ maxWidth: '250px' }}>
                        {group.description}
                      </span>
                    </td>
                    <td>
                      {group.permissions ? (
                        <div className="d-flex flex-wrap gap-1">
                          {Object.entries(JSON.parse(typeof group.permissions === 'string' ? group.permissions : JSON.stringify(group.permissions))).map(([module, perms]) => {
                            if (Object.values(perms).some(val => val === true)) {
                              return (
                                <span key={module} className="badge bg-primary me-1 mb-1">
                                  {module}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      ) : (
                        <span className="text-muted">No permissions</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/groups/${group.id}/users`)}
                        title="Manage users in this group"
                      >
                        <Users size={16} className="me-1" />
                        Manage Users
                      </button>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate(`/groups/edit/${group.id}`)}
                          title="Edit Group"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteClick(group.id)}
                          title="Delete Group"
                          disabled={deleteGroupId === group.id}
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

      <ReassignmentModal />
    </div>
  );
};

export default GroupsList;