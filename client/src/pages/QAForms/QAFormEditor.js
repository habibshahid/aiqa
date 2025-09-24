// src/pages/QAForms/QAFormEditor.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ArrowLeft, Edit, Save, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ClassificationSelect } from '../../components/classification/ClassificationHelpers';
import { 
  NewGroupModal, 
  RenameGroupModal, 
  DeleteGroupConfirmationModal 
} from '../../components/classification/ModalComponents';
import ClassificationSettings from '../../components/classification/ClassificationSettings';
import AIContextGenerator from '../../components/AIContextGenerator';
import ScoringPreview from '../../components/ScoringPreview';

const initialParameterState = {
  name: '',
  description: '',
  maxScore: 5,
  scoringType: 'variable',
  context: '',
  group: 'default',
  classification: 'none'
};

const baseClassificationOptions = [
  { value: 'none', label: 'None', color: 'secondary', impact: 0 },
  { value: 'minor', label: 'Minor', color: 'info', impact: 10 },
  { value: 'moderate', label: 'Moderate', color: 'warning', impact: 25 },
  { value: 'major', label: 'Major', color: 'danger', impact: 50 }
];

const QAFormEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Modal States
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  const [renameGroupModalOpen, setRenameGroupModalOpen] = useState(false);
  const [groupToRename, setGroupToRename] = useState(null);
  const [renamedGroupName, setRenamedGroupName] = useState('');
  
  const [deleteGroupModalOpen, setDeleteGroupModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [newGroupForQuestions, setNewGroupForQuestions] = useState('');

  // Store updated classification options based on percentages
  const [dynamicClassificationOptions, setDynamicClassificationOptions] = useState([...baseClassificationOptions]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    moderationRequired: true,
    scoringMechanism: 'award',  // NEW - default to award
    totalScore: 100, 
    parameters: [{ ...initialParameterState }],
    groups: [{ id: 'default', name: 'Default Group' }],
    classifications: [
      { 
        type: 'none',  // Added 'none' classification type
        impactPercentage: 0,
        description: 'No classification has no impact on the score.'
      },
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

  // Fetch form data on component mount or when ID changes
  useEffect(() => {
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
        
        // Ensure groups and classifications exist
        if (!data.groups || data.groups.length === 0) {
          data.groups = [{ id: 'default', name: 'Default Group' }];
        }
        
        if (!data.classifications || data.classifications.length === 0) {
          data.classifications = formData.classifications;
        } else {
          // Ensure 'none' classification exists
          if (!data.classifications.find(c => c.type === 'none')) {
            data.classifications.push({
              type: 'none',
              impactPercentage: 0,
              description: 'No classification has no impact on the score.'
            });
          }
        }
        
        // Normalize parameters
        if (data.parameters) {
          data.parameters = data.parameters.map(param => ({
            ...param,
            group: param.group || 'default',
            classification: param.classification || 'none'  // Default to 'none' instead of 'minor'
          }));
        }
        
        data.scoringMechanism = data.scoringMechanism || 'award';
        data.totalScore = data.totalScore || 100;

        // If award mode, calculate total score from parameters
        if (data.scoringMechanism === 'award' && data.parameters) {
          data.totalScore = data.parameters.reduce((sum, param) => sum + (param.maxScore || 5), 0);
        }

        setFormData(data);
        
        // Update classification options
        const loadedOptions = baseClassificationOptions.map(option => {
          const classification = data.classifications.find(c => c.type === option.value);
          return classification 
            ? { ...option, impact: classification.impactPercentage } 
            : option;
        });
        
        setDynamicClassificationOptions(loadedOptions);
        
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

  // Form Submission Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setSaving(true);
      setError(null);
  
      // Validate parameters
      if (!formData.parameters.length) {
        throw new Error('At least one parameter is required');
      }
  
      if (formData.scoringMechanism === 'deduct' && (!formData.totalScore || formData.totalScore <= 0)) {
        throw new Error('Total score must be greater than 0 for deduct scoring mechanism');
      }
      
      // Add order to parameters based on their current position
      const orderedParameters = formData.parameters.map((param, index) => ({
        ...param,
        order: index
      }));
  
      // Prepare payload
      const payload = {
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        moderationRequired: formData.moderationRequired,
        scoringMechanism: formData.scoringMechanism,  // NEW
        totalScore: formData.totalScore, 
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

  const handleScoringMechanismChange = (mechanism) => {
    setFormData(prev => {
      let totalScore = prev.totalScore;
      
      // If switching to award mode, calculate total from parameters
      if (mechanism === 'award') {
        totalScore = prev.parameters.reduce((sum, param) => sum + (param.maxScore || 5), 0);
      }
      // If switching to deduct mode and total is 0, set a default
      else if (mechanism === 'deduct' && totalScore === 0) {
        totalScore = 100;
      }
      
      return {
        ...prev,
        scoringMechanism: mechanism,
        totalScore: totalScore
      };
    });
  };
  
  // Add Group Handler
  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    
    // Generate a unique ID for the group
    const groupId = `group-${Date.now()}`;
    
    setFormData(prev => ({
      ...prev,
      groups: [...prev.groups, { id: groupId, name: newGroupName.trim() }]
    }));
    
    // Reset state and close modal
    setNewGroupName('');
    setNewGroupModalOpen(false);
  };

  // Rename Group Handler
  const handleRenameGroup = () => {
    if (!renamedGroupName.trim() || !groupToRename) return;
    
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.map(group => 
        group.id === groupToRename.id 
          ? { ...group, name: renamedGroupName.trim() }
          : group
      )
    }));
    
    // Reset state and close modal
    setRenamedGroupName('');
    setGroupToRename(null);
    setRenameGroupModalOpen(false);
  };

  // Delete Group Handler
  const handleDeleteGroup = () => {
    if (!groupToDelete) return;
    
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
    
    // Reset state and close modal
    setGroupToDelete(null);
    setNewGroupForQuestions('');
    setDeleteGroupModalOpen(false);
  };

  // Other existing handler methods...
  
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

  // Parameter change handler
  const handleParameterChange = (index, field, value) => {
    setFormData(prev => {
      const updatedParameters = prev.parameters.map((param, i) => 
        i === index ? { ...param, [field]: value } : param
      );
      
      // If in award mode and maxScore changed, recalculate total
      let newTotalScore = prev.totalScore;
      if (prev.scoringMechanism === 'award' && field === 'maxScore') {
        newTotalScore = updatedParameters.reduce((sum, param) => sum + (param.maxScore || 5), 0);
      }
      
      return {
        ...prev,
        parameters: updatedParameters,
        totalScore: newTotalScore
      };
    });
  };

  // Add parameter to a specific group
  const addParameter = (groupId = 'default') => {
    setFormData(prev => {
      const updatedParameters = [
        ...prev.parameters,
        { ...initialParameterState, group: groupId }
      ];
      
      // Recalculate total score if in award mode
      let newTotalScore = prev.totalScore;
      if (prev.scoringMechanism === 'award') {
        newTotalScore = updatedParameters.reduce((sum, param) => sum + (param.maxScore || 5), 0);
      }
      
      return {
        ...prev,
        parameters: updatedParameters,
        totalScore: newTotalScore
      };
    });
  };

  // Remove parameter
  const removeParameter = (index) => {
    if (formData.parameters.length <= 1) {
      setError('At least one parameter is required');
      return;
    }
    
    setFormData(prev => {
      const updatedParameters = prev.parameters.filter((_, i) => i !== index);
      
      // Recalculate total score if in award mode
      let newTotalScore = prev.totalScore;
      if (prev.scoringMechanism === 'award') {
        newTotalScore = updatedParameters.reduce((sum, param) => sum + (param.maxScore || 5), 0);
      }
      
      return {
        ...prev,
        parameters: updatedParameters,
        totalScore: newTotalScore
      };
    });
  };

  // Classification change handler
  const handleClassificationsChange = (classifications) => {
    if (!classifications.find(c => c.type === 'none')) {
      classifications.push({
        type: 'none',
        impactPercentage: 0,
        description: 'No classification has no impact on the score.'
      });
    }

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
          label: option.value === 'none' ? 'None' : 
                 `${option.value.charAt(0).toUpperCase() + option.value.slice(1)}`,
          impact: classification.impactPercentage
        };
      }
      return option;
    });
    
    setDynamicClassificationOptions(updatedOptions);
  };

  // Render loading state
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
      {/* Header */}
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

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} >
        {/* Form Details Card */}
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

              {/* Moderation Required Switch */}
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
          
        {/* Scoring Mechanism Section - Add after Basic Information and before Classification Settings */}
        <div className="card mb-4">
          <div className="card-header bg-light">
            <h5 className="card-title mb-0">Scoring Configuration</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Scoring Mechanism</label>
                <select
                  className="form-select"
                  value={formData.scoringMechanism}
                  onChange={(e) => handleScoringMechanismChange(e.target.value)}
                >
                  <option value="award">Award Points (Traditional)</option>
                  <option value="deduct">Deduct Points (Negative Marking)</option>
                </select>
                <div className="form-text">
                  {formData.scoringMechanism === 'award' 
                    ? 'Points are awarded for correct answers. Total score is the sum of all earned points.'
                    : 'Start with a total score and deduct points for incorrect answers.'}
                </div>
              </div>
              
              <div className="col-md-6">
                <label className="form-label">
                  {formData.scoringMechanism === 'award' ? 'Total Possible Score' : 'Starting Total Score'}
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.totalScore}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setFormData(prev => ({ ...prev, totalScore: Math.max(0, Math.min(1000, value)) }));
                  }}
                  min="0"
                  max="1000"
                  disabled={formData.scoringMechanism === 'award'} // Disable for award mode as it's calculated
                />
                <div className="form-text">
                  {formData.scoringMechanism === 'award' 
                    ? 'Automatically calculated from the sum of all parameter max scores.'
                    : 'The initial score from which deductions will be made (1-1000).'}
                </div>
              </div>
            </div>

            {/* Visual Example */}
            <div className="alert alert-info mt-3 mb-0">
              <h6 className="mb-2">
                <i className="bi bi-info-circle me-2"></i>
                How {formData.scoringMechanism === 'award' ? 'Award' : 'Deduct'} Scoring Works:
              </h6>
              {formData.scoringMechanism === 'award' ? (
                <div>
                  <p className="mb-1">• Each question can earn 0 to its maximum score</p>
                  <p className="mb-1">• Final score = Sum of all earned points</p>
                  <p className="mb-1">• Example: 3 questions worth 5 points each</p>
                  <p className="mb-0 ms-3">
                    - Agent scores: 5 + 3 + 4 = <strong>12 out of 15 points (80%)</strong>
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-1">• Start with {formData.totalScore} points</p>
                  <p className="mb-1">• Deduct points for each incorrect answer</p>
                  <p className="mb-1">• Example: Starting with 100 points, 3 questions worth 5 points each</p>
                  <p className="mb-0 ms-3">
                    - Agent scores: 5 + 3 + 4 = 12/15, so deduct 3 points
                    <br />- Final score: <strong>97 out of 100 points (97%)</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Classification Settings */}
        <ClassificationSettings 
          classifications={formData.classifications} 
          onChange={handleClassificationsChange}
        />

        {/* Groups Section */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Question Groups</h5>
          <button
            type="button"
            className="btn btn-outline-primary d-flex align-items-center"
            onClick={() => setNewGroupModalOpen(true)}
          >
            <Plus size={16} className="me-2" />
            Add Group
          </button>
        </div>

        {/* Drag and Drop Context for Groups */}
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
                        setRenameGroupModalOpen(true);
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
                        setDeleteGroupModalOpen(true);
                      }}
                      disabled={formData.groups.length <= 1}
                    >
                      <X size={14} className="me-1" />
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
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                          <label className="form-label">Context</label>
                                          <AIContextGenerator
                                            paramName={param.name}
                                            existingContext={param.context}
                                            scoringType={param.scoringType}
                                            maxScore={param.maxScore}
                                            classification={param.classification || 'none'}
                                            onApply={(generatedContext) => handleParameterChange(paramIndex, 'context', generatedContext)}
                                          />
                                        </div>
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

        {/* Add this after all the group/parameter sections and before the submit button */}
        {formData.parameters.length > 0 && (
          <div className="mb-4">
            <ScoringPreview formData={formData} />
          </div>
        )}

        {/* Form Actions */}
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

      {/* Modals */}
      <NewGroupModal 
        isOpen={newGroupModalOpen}
        onClose={() => {
          setNewGroupModalOpen(false);
          setNewGroupName('');
        }}
        newGroupName={newGroupName}
        onGroupNameChange={(e) => setNewGroupName(e.target.value)}
        onSubmit={handleAddGroup}
      />

      <RenameGroupModal 
        isOpen={renameGroupModalOpen}
        onClose={() => {
          setRenameGroupModalOpen(false);
          setGroupToRename(null);
          setRenamedGroupName('');
        }}
        groupName={renamedGroupName}
        onGroupNameChange={(e) => setRenamedGroupName(e.target.value)}
        onSubmit={handleRenameGroup}
      />

      <DeleteGroupConfirmationModal 
        isOpen={deleteGroupModalOpen}
        onClose={() => {
          setDeleteGroupModalOpen(false);
          setGroupToDelete(null);
          setNewGroupForQuestions('');
        }}
        groupName={groupToDelete?.name || ''}
        hasParameters={formData.parameters.some(param => param.group === groupToDelete?.id)}
        groupOptions={formData.groups.filter(g => g.id !== groupToDelete?.id)}
        newGroupForQuestions={newGroupForQuestions}
        onNewGroupChange={(e) => setNewGroupForQuestions(e.target.value)}
        onSubmit={handleDeleteGroup}
      />
    </div>
  );
};

export default QAFormEditor;