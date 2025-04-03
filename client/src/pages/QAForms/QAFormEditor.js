// src/pages/QAForms/QAFormEditor.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ArrowLeft, Edit, Save, PlusCircle, Trash2, GripVertical, Move } from 'lucide-react';
import Select from 'react-select';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ClassificationInfo, ClassificationSelect } from '../../components/classification/ClassificationHelpers';

const initialParameterState = {
  name: '',
  description: '',
  maxScore: 5,
  scoringType: 'variable',
  context: '',
  group: 'default',
  classification: 'minor' // default classification
};

// Base classification options
const baseClassificationOptions = [
  { value: 'minor', label: 'Minor', color: 'info', impact: 10 },
  { value: 'moderate', label: 'Moderate', color: 'warning', impact: 25 },
  { value: 'major', label: 'Major', color: 'danger', impact: 50 }
];

const ClassificationSettings = ({ classifications, onChange }) => {
  // Create local state for each classification to manage UI updates
  const [localClassifications, setLocalClassifications] = useState(classifications || [
    { 
      type: 'minor', 
      impactPercentage: 10, 
      description: 'Minor issues have a small impact on quality and deduct 10% of the section\'s possible score.'
    },
    { 
      type: 'moderate', 
      impactPercentage: 25, 
      description: 'Moderate issues have a significant impact on quality and deduct 25% of the section\'s possible score.'
    },
    { 
      type: 'major', 
      impactPercentage: 50, 
      description: 'Major issues have a critical impact on quality and deduct 50% of the section\'s possible score.'
    }
  ]);

  // When local settings change, notify parent
  useEffect(() => {
    if (onChange) {
      onChange(localClassifications);
    }
  }, [localClassifications, onChange]);

  // Safely parse number input
  const parseNumber = (value) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Handle percentage change
  const handlePercentageChange = (type, value) => {
    const newValue = Math.max(0, Math.min(100, parseNumber(value)));
    
    setLocalClassifications(prev => 
      prev.map(item => 
        item.type === type ? { ...item, impactPercentage: newValue } : item
      )
    );
  };

  // Handle description change
  const handleDescriptionChange = (type, value) => {
    setLocalClassifications(prev => 
      prev.map(item => 
        item.type === type ? { ...item, description: value } : item
      )
    );
  };

  return (
    <div className="card mb-4">
      <div className="card-header bg-light">
        <h5 className="card-title mb-0">Classification Impact Settings</h5>
      </div>
      <div className="card-body">
        <p className="text-muted mb-3">
          Define how different classifications impact scoring. The percentage values represent 
          the portion of points deducted from the entire section when any question in that section 
          has the specified classification.
        </p>
        
        {localClassifications.map((classification) => (
          <div key={classification.type} className="row mb-4">
            <div className="col-12">
              <h6 className="text-capitalize">{classification.type} Classification</h6>
            </div>
            <div className="col-md-3">
              <label className="form-label">Impact Percentage</label>
              <div className="input-group">
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  max="100"
                  value={classification.impactPercentage}
                  onChange={(e) => handlePercentageChange(classification.type, e.target.value)}
                />
                <span className="input-group-text">%</span>
              </div>
              <small className="form-text text-muted">
                % of points deducted from the section
              </small>
            </div>
            <div className="col-md-9">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-control"
                value={classification.description}
                onChange={(e) => handleDescriptionChange(classification.type, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QAFormEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const handleClassificationsChange = (classifications) => {
    setFormData(prev => ({
      ...prev,
      classifications
    }));
    
    // Update classification options based on the new percentages
    const updatedOptions = baseClassificationOptions.map(option => {
      const classification = classifications.find(c => c.type === option.value);
      if (classification) {
        return {
          ...option,
          label: `${option.value.charAt(0).toUpperCase() + option.value.slice(1)}`,
          impact: classification.impactPercentage
        };
      }
      return option;
    });
    
    setDynamicClassificationOptions(updatedOptions);
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    moderationRequired: true,
    parameters: [{ ...initialParameterState }],
    groups: [{ id: 'default', name: 'Default Group' }],
    classifications: [
      { 
        type: 'minor', 
        impactPercentage: 10, 
        description: 'Minor issues have a small impact on quality and deduct 10% of the section\'s possible score.'
      },
      { 
        type: 'moderate', 
        impactPercentage: 25, 
        description: 'Moderate issues have a significant impact on quality and deduct 25% of the section\'s possible score.'
      },
      { 
        type: 'major', 
        impactPercentage: 50, 
        description: 'Major issues have a critical impact on quality and deduct 50% of the section\'s possible score.'
      }
    ]
  });

  // Store updated classification options based on percentages
  const [dynamicClassificationOptions, setDynamicClassificationOptions] = useState([...baseClassificationOptions]);

  // State for the new group modal
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  // State for group rename modal
  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [groupToRename, setGroupToRename] = useState(null);
  const [renamedGroupName, setRenamedGroupName] = useState('');

  // State for group delete confirmation
  const [showDeleteGroupConfirmation, setShowDeleteGroupConfirmation] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [newGroupForQuestions, setNewGroupForQuestions] = useState('');

  useEffect(() => {
    // Define the fetchForm function directly inside the useEffect
    const fetchForm = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/qa-forms/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to fetch form');
        }
  
        const data = await response.json();
        
        // If form doesn't have groups, add a default group
        if (!data.groups || data.groups.length === 0) {
          data.groups = [{ id: 'default', name: 'Default Group' }];
          
          // Assign all parameters to the default group
          if (data.parameters) {
            data.parameters = data.parameters.map(param => ({
              ...param,
              group: 'default',
              classification: param.classification || 'minor'
            }));
          }
        }
        
        // If form doesn't have classifications, add default ones
        if (!data.classifications || data.classifications.length === 0) {
          data.classifications = [
            { 
              type: 'minor', 
              impactPercentage: 10, 
              description: 'Minor issues have a small impact on quality and deduct 10% of the section\'s possible score.'
            },
            { 
              type: 'moderate', 
              impactPercentage: 25, 
              description: 'Moderate issues have a significant impact on quality and deduct 25% of the section\'s possible score.'
            },
            { 
              type: 'major', 
              impactPercentage: 50, 
              description: 'Major issues have a critical impact on quality and deduct 50% of the section\'s possible score.'
            }
          ];
        }
        
        setFormData(data);
        
        // Update classification options based on loaded data
        if (data.classifications && data.classifications.length > 0) {
          const loadedOptions = baseClassificationOptions.map(option => {
            const classification = data.classifications.find(c => c.type === option.value);
            if (classification) {
              return {
                ...option,
                label: `${option.value.charAt(0).toUpperCase() + option.value.slice(1)}`,
                impact: classification.impactPercentage
              };
            }
            return option;
          });
          
          setDynamicClassificationOptions(loadedOptions);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching form:', err);
        setError('Failed to load the form. Please try again.');
      } finally {
        setLoading(false);
      }
    };
  
    if (id) {
      fetchForm();
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
  
      // Validate parameters
      if (!formData.parameters.length) {
        throw new Error('At least one parameter is required');
      }
  
      // Add order to parameters based on their current position
      const orderedParameters = formData.parameters.map((param, index) => ({
        ...param,
        order: index
      }));
  
      // Prepare payload including classifications
      const payload = {
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        moderationRequired: formData.moderationRequired,
        parameters: orderedParameters,
        groups: formData.groups,
        classifications: formData.classifications
      };
  
      // Submit the form
      const response = await fetch(`/api/qa-forms${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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

  const addParameter = (groupId = 'default') => {
    setFormData(prev => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        { ...initialParameterState, group: groupId }
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

  // Function to add a new group
  const addGroup = () => {
    if (!newGroupName.trim()) {
      return;
    }
    
    // Generate a unique ID for the group
    const groupId = `group-${Date.now()}`;
    
    // Update the form data with the new group
    setFormData(prev => ({
      ...prev,
      groups: [...prev.groups, { id: groupId, name: newGroupName.trim() }]
    }));
    
    // Reset state and close modal
    setNewGroupName('');
    setShowNewGroupModal(false);
  };

  // Function to rename a group
  const renameGroup = () => {
    if (!renamedGroupName.trim() || !groupToRename) {
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.map(group => 
        group.id === groupToRename.id 
          ? { ...group, name: renamedGroupName.trim() }
          : group
      )
    }));
    
    setRenamedGroupName('');
    setGroupToRename(null);
    setShowRenameGroupModal(false);
  };

  // Function to check if a group can be deleted
  const canDeleteGroup = (groupId) => {
    // Can't delete the group if it has parameters
    const hasParameters = formData.parameters.some(param => param.group === groupId);
    return !hasParameters;
  };

  // Function to delete a group
  const deleteGroup = () => {
    if (!groupToDelete) {
      return;
    }
    
    // If no new group is selected for questions, we can't delete
    if (formData.parameters.some(param => param.group === groupToDelete.id) && !newGroupForQuestions) {
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      // Remove the group
      groups: prev.groups.filter(group => group.id !== groupToDelete.id),
      // Move parameters to new group if needed
      parameters: prev.parameters.map(param => 
        param.group === groupToDelete.id 
          ? { ...param, group: newGroupForQuestions }
          : param
      )
    }));
    
    setGroupToDelete(null);
    setNewGroupForQuestions('');
    setShowDeleteGroupConfirmation(false);
  };

  // Handle drag end for drag and drop
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    
    // If dropping in the same group, reorder parameters
    if (source.droppableId === destination.droppableId) {
      const groupParameters = formData.parameters.filter(param => param.group === source.droppableId);
      const otherParameters = formData.parameters.filter(param => param.group !== source.droppableId);
      
      const [reorderedItem] = groupParameters.splice(source.index, 1);
      groupParameters.splice(destination.index, 0, reorderedItem);
      
      const newParameters = [...otherParameters, ...groupParameters];
      
      setFormData(prev => ({
        ...prev,
        parameters: newParameters
      }));
    } 
    // If dropping in a different group, move parameter to new group
    else {
      const paramToMove = formData.parameters.find((param, idx) => 
        param.group === source.droppableId && 
        formData.parameters.filter(p => p.group === source.droppableId).indexOf(param) === source.index
      );
      
      if (paramToMove) {
        setFormData(prev => ({
          ...prev,
          parameters: prev.parameters.map(param => 
            param === paramToMove 
              ? { ...param, group: destination.droppableId }
              : param
          )
        }));
      }
    }
  };

  // Modal components
  const NewGroupModal = () => {
    // Only render if the modal state is true
    if (!showNewGroupModal) return null;
  
    // Support for keyboard controls
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addGroup();
      } else if (e.key === 'Escape') {
        setShowNewGroupModal(false);
      }
    };
  
    return (
      <>
        <div className="modal-backdrop fade show"></div>
        <div 
          className="modal fade show" 
          style={{ display: 'block' }} 
          tabIndex="-1"
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Group</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowNewGroupModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Group Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowNewGroupModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={addGroup}
                  disabled={!newGroupName.trim()}
                >
                  Add Group
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const RenameGroupModal = () => {
    if (!showRenameGroupModal || !groupToRename) return null;
    
    return (
      <>
        <div className="modal-backdrop fade show"></div>
        <div className="modal fade show" style={{ display: 'block' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Rename Group</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowRenameGroupModal(false);
                    setGroupToRename(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">New Group Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={renamedGroupName}
                    onChange={(e) => setRenamedGroupName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowRenameGroupModal(false);
                    setGroupToRename(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={renameGroup}
                  disabled={!renamedGroupName.trim()}
                >
                  Rename Group
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const DeleteGroupConfirmationModal = () => {
    if (!showDeleteGroupConfirmation || !groupToDelete) return null;
    
    const hasParameters = formData.parameters.some(param => param.group === groupToDelete.id);
    
    return (
      <>
        <div className="modal-backdrop fade show"></div>
        <div className="modal fade show" style={{ display: 'block' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Group</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowDeleteGroupConfirmation(false);
                    setGroupToDelete(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {hasParameters ? (
                  <>
                    <div className="alert alert-warning">
                      <strong>Warning:</strong> This group contains questions that need to be moved to another group.
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Move questions to:</label>
                      <select
                        className="form-select"
                        value={newGroupForQuestions}
                        onChange={(e) => setNewGroupForQuestions(e.target.value)}
                        required
                      >
                        <option value="">Select a group</option>
                        {formData.groups
                          .filter(group => group.id !== groupToDelete.id)
                          .map(group => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <p>Are you sure you want to delete the group "{groupToDelete.name}"?</p>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowDeleteGroupConfirmation(false);
                    setGroupToDelete(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={deleteGroup}
                  disabled={hasParameters && !newGroupForQuestions}
                >
                  Delete Group
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
              <div className="col-md-12 mt-3">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="moderationRequired"
                    checked={formData.moderationRequired}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      moderationRequired: e.target.checked
                    }))}
                  />
                  <label className="form-check-label" htmlFor="moderationRequired">
                    Require Human Moderation Before Publishing
                  </label>
                  <div className="form-text">
                    When enabled, AI evaluations will require review by a human QA evaluator before they are visible to agents.
                    When disabled, evaluations will be automatically published to agents upon completion.
                  </div>
                </div>
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
          
        {/* Classification settings section */}
        <ClassificationSettings 
          classifications={formData.classifications} 
          onChange={handleClassificationsChange}
        />

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Question Groups</h5>
          <button
            type="button"
            className="btn btn-outline-primary d-flex align-items-center"
            onClick={() => setShowNewGroupModal(true)}
          >
            <Plus size={16} className="me-2" />
            Add Group
          </button>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          {formData.groups.map((group) => {
            // Filter parameters for this group
            const groupParameters = formData.parameters.filter(param => param.group === group.id);
            
            return (
              <div key={group.id} className="card mb-4">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h6 className="card-title mb-0">{group.name}</h6>
                  <div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => {
                        setGroupToRename(group);
                        setRenamedGroupName(group.name);
                        setShowRenameGroupModal(true);
                      }}
                    >
                      <Edit size={14} className="me-1" />
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger me-2"
                      onClick={() => {
                        setGroupToDelete(group);
                        setNewGroupForQuestions('');
                        setShowDeleteGroupConfirmation(true);
                      }}
                      disabled={formData.groups.length <= 1} // Prevent deleting if only one group exists
                    >
                      <Trash2 size={14} className="me-1" />
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => addParameter(group.id)}
                    >
                      <Plus size={14} className="me-1" />
                      Add Question
                    </button>
                  </div>
                </div>
                <Droppable droppableId={group.id}>
                  {(provided) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="card-body"
                    >
                      {groupParameters.length === 0 ? (
                        <div className="text-center py-3 text-muted">
                          <p className="mb-0">No questions in this group.</p>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary mt-2"
                            onClick={() => addParameter(group.id)}
                          >
                            <Plus size={14} className="me-1" />
                            Add Question
                          </button>
                        </div>
                      ) : (
                        groupParameters.map((param, groupIndex) => {
                          // Find the actual index in the overall parameters array
                          const paramIndex = formData.parameters.findIndex(p => p === param);
                          
                          return (
                            <Draggable 
                              key={`param-${paramIndex}`} 
                              draggableId={`param-${paramIndex}`} 
                              index={groupIndex}
                            >
                              {(provided) => (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="card mb-3 border"
                                >
                                  <div className="card-body">
                                    <div className="d-flex justify-content-between mb-3">
                                      <div className="d-flex align-items-center">
                                        <div {...provided.dragHandleProps} className="me-2 text-muted">
                                          <GripVertical size={16} />
                                        </div>
                                        <h6 className="card-title mb-0">Question {groupIndex + 1}</h6>
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeParameter(paramIndex)}
                                        title="Remove Parameter"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>

                                    <div className="row g-3">
                                      <div className="col-md-6">
                                        <label className="form-label">Question Name</label>
                                        <input
                                          type="text"
                                          className="form-control"
                                          value={param.name}
                                          onChange={(e) => handleParameterChange(paramIndex, 'name', e.target.value)}
                                          required
                                          maxLength={100}
                                        />
                                      </div>

                                      <div className="col-md-2">
                                        <label className="form-label">Max Score</label>
                                        <input
                                          type="number"
                                          className="form-control"
                                          min="1"
                                          max="5"
                                          value={param.maxScore}
                                          onChange={(e) => handleParameterChange(paramIndex, 'maxScore', parseInt(e.target.value))}
                                          required
                                        />
                                      </div>

                                      <div className="col-md-2">
                                        <label className="form-label">Scoring Type</label>
                                        <select
                                          className="form-select"
                                          value={param.scoringType}
                                          onChange={(e) => handleParameterChange(paramIndex, 'scoringType', e.target.value)}
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
                                          onChange={(e) => handleParameterChange(paramIndex, 'context', e.target.value)}
                                          required
                                          maxLength={1000}
                                        />
                                      </div>

                                      <div className="col-md-4">
                                        <label className="form-label">Classification</label>
                                        <ClassificationSelect
                                          value={param.classification || 'minor'}
                                          onChange={(e) => handleParameterChange(paramIndex, 'classification', e.target.value)}
                                          customOptions={dynamicClassificationOptions}
                                        />
                                        <small className="form-text text-muted mt-1">
                                          Impact: {formData.classifications.find(c => c.type === param.classification)?.impactPercentage || 10}% 
                                          score deduction
                                        </small>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </DragDropContext>

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

      {/* Modals for Group Actions */}
      <NewGroupModal />
      <RenameGroupModal />
      <DeleteGroupConfirmationModal />
    </div>
  );
};

export default QAFormEditor;