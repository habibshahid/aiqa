// src/pages/GroupManagement/GroupUsers.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  UserMinus, 
  UserPlus, 
  Search,
  RefreshCw
} from 'lucide-react';

const GroupUsers = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [groupData, setGroupData] = useState(null);
  const [users, setUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [removingUserId, setRemovingUserId] = useState(null);
  const [addingUserId, setAddingUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch group details and users in parallel
      const [groupResponse, usersResponse] = await Promise.all([
        fetch(`/api/groups/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch(`/api/groups/${id}/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      if (!groupResponse.ok || !usersResponse.ok) {
        throw new Error('Failed to fetch group data');
      }

      const [groupData, usersData] = await Promise.all([
        groupResponse.json(),
        usersResponse.json()
      ]);
      
      setGroupData(groupData);
      setUsers(usersData);
      
      // Fetch available users too
      fetchAvailableUsers();
      
      setError(null);
    } catch (err) {
      console.error('Error fetching group data:', err);
      setError('Failed to load group data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch(`/api/groups/${id}/available-users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch available users');
      }

      const data = await response.json();
      setAvailableUsers(data);
    } catch (err) {
      console.error('Error fetching available users:', err);
      setError('Failed to load available users. Please try again.');
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      setRemovingUserId(userId);
      
      const response = await fetch(`/api/groups/${id}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove user from group');
      }

      // Update the UI by removing the user
      setUsers(users.filter(user => user.id !== userId));
      
      // Add user to available users
      const removedUser = users.find(user => user.id === userId);
      if (removedUser) {
        setAvailableUsers([...availableUsers, removedUser]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error removing user:', err);
      setError('Failed to remove user from group. Please try again.');
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleAddUser = async (userId) => {
    try {
      setAddingUserId(userId);
      
      const response = await fetch(`/api/groups/${id}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to add user to group');
      }

      // Update the UI by adding the user
      const addedUser = availableUsers.find(user => user.id === userId);
      if (addedUser) {
        setUsers([...users, addedUser]);
        setAvailableUsers(availableUsers.filter(user => user.id !== userId));
      }
      
      setError(null);
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Failed to add user to group. Please try again.');
    } finally {
      setAddingUserId(null);
    }
  };

  const filteredAvailableUsers = availableUsers.filter(user => {
    const searchTermLower = searchTerm.toLowerCase();
    const username = user.username.toLowerCase();
    const firstName = (user.first_name || '').toLowerCase();
    const lastName = (user.last_name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    
    return username.includes(searchTermLower) || 
           firstName.includes(searchTermLower) || 
           lastName.includes(searchTermLower) ||
           email.includes(searchTermLower) ||
           `${firstName} ${lastName}`.includes(searchTermLower);
  });

  const AddUserModal = () => {
    if (!addUserModalOpen) return null;

    return (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
        <div className="modal fade show" style={{ display: 'block', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <UserPlus size={18} className="me-2" />
                  Add Users to Group
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setAddUserModalOpen(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="input-group">
                    <span className="input-group-text">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                {filteredAvailableUsers.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <p>No users available to add to this group.</p>
                    {searchTerm && <p>Try a different search term or clear the search.</p>}
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '400px' }}>
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>Username</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAvailableUsers.map(user => (
                          <tr key={user.id}>
                            <td>{user.username}</td>
                            <td>
                              {user.first_name && user.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : '—'}
                            </td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`badge bg-${user.is_active ? 'success' : 'danger'}`}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => handleAddUser(user.id)}
                                disabled={addingUserId === user.id}
                              >
                                {addingUserId === user.id ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : (
                                  <>
                                    <UserPlus size={14} className="me-1" />
                                    Add
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setAddUserModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  if (loading && !groupData) {
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
        <h1 className="h3 mb-0">Manage Users in {groupData?.name}</h1>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Group Users</h5>
          <div>
            <button 
              className="btn btn-outline-secondary me-2"
              onClick={fetchData}
            >
              <RefreshCw size={16} className="me-1" />
              Refresh
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => setAddUserModalOpen(true)}
            >
              <UserPlus size={16} className="me-1" />
              Add Users
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    <div className="text-muted">
                      <p className="mb-0">No users in this group</p>
                      <small>Click "Add Users" to add users to this group</small>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>
                      {user.first_name && user.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : '—'}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge bg-${user.is_active ? 'success' : 'danger'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleRemoveUser(user.id)}
                        disabled={removingUserId === user.id}
                      >
                        {removingUserId === user.id ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          <>
                            <UserMinus size={14} className="me-1" />
                            Remove
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddUserModal />
    </div>
  );
};

export default GroupUsers;