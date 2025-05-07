import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit, Eye, EyeOff, MessageSquare, CheckCircle, XCircle, AlertTriangle, Save, Lock, AlertCircle } from 'lucide-react';
import Select from 'react-select';

// Classification Badge Component with improved visibility and interaction
const ClassificationBadge = ({ classification, onRemove = null, disabled = false }) => {
  if (!classification) return <span className="badge bg-secondary">None</span>;
  
  const classificationMap = {
    minor: { label: 'Minor', color: 'info', impact: 10 },
    moderate: { label: 'Moderate', color: 'warning', impact: 25 },
    major: { label: 'Major', color: 'danger', impact: 50 },
    none: { label: 'None', color: 'secondary', impact: 0 }
  };
  
  const config = classificationMap[classification] || { label: classification, color: 'secondary', impact: 0 };
  
  return (
    <div className="d-inline-flex align-items-center">
      <span
        className={`badge bg-${config.color} me-1`}
        title={`${config.label} issues deduct up to ${config.impact}% of score`}
      >
        {config.label}
      </span>
      {onRemove && !disabled && (
        <button 
          className="btn btn-sm btn-link text-muted p-0 ms-1" 
          onClick={onRemove} 
          title="Remove classification"
        >
          <XCircle size={14} />
        </button>
      )}
    </div>
  );
};

// Enhanced Score Card Component
const ScoreCard = ({ title, value, maxValue, percentage, bgColor = 'bg-primary', subtitle = null }) => (
  <div className="col-md-3">
    <div className="card mb-3">
      <div className={`card-body ${bgColor} text-white`}>
        <h6 className="card-subtitle mb-2">{title}</h6>
        <h2 className="card-title mb-0">{value} / {maxValue} ({percentage}%)</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  </div>
);

// Enhanced Section-wise Scores Component
const SectionWiseScores = ({ evaluation, qaForm, updatedScores = null }) => {
  // Ensure we have the necessary data
  if (!evaluation || !qaForm) return null;

  // Get section scores from evaluation or initialize if not present
  const sectionScores = evaluation.sectionScores || {
    sections: {},
    overall: { rawScore: 0, adjustedScore: 0, maxScore: 0, percentage: 0 }
  };

  // Incorporate any updated scores if provided
  const mergedScores = updatedScores ? {
    sections: { ...sectionScores.sections, ...updatedScores.sections },
    overall: updatedScores.overall || sectionScores.overall
  } : sectionScores;

  // Map all group IDs to names
  const groupMap = {};
  qaForm.groups.forEach(group => {
    groupMap[group.id] = group.name;
  });

  // Prepare classification impact information
  const classificationMap = {
    minor: { label: 'Minor', color: 'info', impact: 10 },
    moderate: { label: 'Moderate', color: 'warning', impact: 25 },
    major: { label: 'Major', color: 'danger', impact: 50 }
  };

  // Use custom classification definitions if available
  if (qaForm && qaForm.classifications) {
    qaForm.classifications.forEach(classification => {
      if (classificationMap[classification.type]) {
        classificationMap[classification.type].impact = classification.impactPercentage;
      }
    });
  }

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0">Section-Level Scores</h5>
      </div>
      <div className="card-body">
        <p className="text-muted mb-3">
          Section scores reflect the impact of classifications. When a section contains a question 
          with a classification, the section's actual earned points (not the maximum possible) are 
          reduced by the defined percentage.
        </p>
        
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Raw Score</th>
                <th>Classification Impact</th>
                <th>Deduction</th>
                <th>Final Score</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {/* Render all groups from QA form, not just those with scores */}
              {qaForm.groups.map(group => {
                const sectionId = group.id;
                const sectionName = group.name;
                
                // Get section data if it exists, or create placeholder data
                const section = mergedScores.sections[sectionId] || {
                  name: sectionName,
                  rawScore: 0,
                  maxScore: 0,
                  adjustedScore: 0,
                  percentage: 0,
                  classifications: { minor: false, moderate: false, major: false },
                  highestClassification: null,
                  highestClassificationImpact: 0
                };
                
                // Calculate deduction amount
                const deduction = section.rawScore - section.adjustedScore;
                
                return (
                  <tr key={sectionId}>
                    <td>{section.name}</td>
                    <td>{section.rawScore.toFixed(1)} / {section.maxScore}</td>
                    <td>
                      {section.classifications?.major ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-danger me-2">Major</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : section.classifications?.moderate ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-warning me-2">Moderate</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : section.classifications?.minor ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-info me-2">Minor</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : (
                        <span className="badge bg-secondary">None</span>
                      )}
                    </td>
                    <td>
                      {deduction > 0 ? (
                        <span className="text-danger">-{deduction.toFixed(1)}</span>
                      ) : (
                        <span>0</span>
                      )}
                    </td>
                    <td>{section.adjustedScore.toFixed(1)} / {section.maxScore}</td>
                    <td>
                      <div className={`badge bg-${
                        section.percentage >= 80 ? 'success' :
                        section.percentage >= 60 ? 'warning' : 'danger'
                      }`}>
                        {section.percentage}%
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="table-active fw-bold">
                <td>Overall</td>
                <td>{mergedScores.overall.rawScore.toFixed(1)} / {mergedScores.overall.maxScore}</td>
                <td>-</td>
                <td>
                  {(mergedScores.overall.rawScore - mergedScores.overall.adjustedScore) > 0 ? (
                    <span className="text-danger">
                      -{(mergedScores.overall.rawScore - mergedScores.overall.adjustedScore).toFixed(1)}
                    </span>
                  ) : (
                    <span>0</span>
                  )}
                </td>
                <td>{mergedScores.overall.adjustedScore.toFixed(1)} / {mergedScores.overall.maxScore}</td>
                <td>
                  <div className={`badge bg-${
                    mergedScores.overall.percentage >= 80 ? 'success' :
                    mergedScores.overall.percentage >= 60 ? 'warning' : 'danger'
                  }`}>
                    {mergedScores.overall.percentage}%
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="alert alert-info mt-3">
          <h6 className="mb-2">How Classification Impacts Are Applied:</h6>
          <ul className="mb-0">
            <li>When a section contains questions with different classifications, the highest classification is applied.</li>
            <li>The deduction is calculated based on the actual earned points in that section, not the maximum possible.</li>
            <li>For example, if a section has earned 20 points and contains a "moderate" question with a 25% impact, 5 points (25% of 20) will be deducted.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Real-time score calculation function
const calculateScores = (parameters, qaForm) => {
  // Base structure for scores
  const result = {
    sections: {},
    overall: { rawScore: 0, adjustedScore: 0, maxScore: 0, percentage: 0 }
  };
  
  // Classification impact map
  const classificationImpacts = {};
  if (qaForm && qaForm.classifications) {
    qaForm.classifications.forEach(classification => {
      classificationImpacts[classification.type] = classification.impactPercentage / 100;
    });
  } else {
    // Default classification impacts
    classificationImpacts.minor = 0.1;    // 10%
    classificationImpacts.moderate = 0.25; // 25%
    classificationImpacts.major = 0.5;    // 50%
  }
  
  // Initialize sections based on groups in QA form
  if (qaForm && qaForm.groups) {
    qaForm.groups.forEach(group => {
      result.sections[group.id] = {
        name: group.name,
        parameters: [],
        rawScore: 0,
        maxScore: 0,
        adjustedScore: 0,
        percentage: 0,
        classifications: { minor: false, moderate: false, major: false },
        highestClassification: null,
        highestClassificationImpact: 0
      };
    });
  }
  
  // Process each parameter
  if (qaForm && qaForm.parameters && parameters) {
    qaForm.parameters.forEach(paramDef => {
      const paramName = paramDef.name;
      const paramData = parameters[paramName];
      
      if (!paramData) return;
      
      // Skip N/A scores
      if (paramData.humanScore === -1) return;
      
      const groupId = paramDef.group || 'default';
      if (!result.sections[groupId]) return;
      
      const section = result.sections[groupId];
      
      // Get score and classification
      const score = paramData.humanScore || 0;
      const maxScore = paramDef.maxScore || 5;
      const classification = paramData.classification || paramDef.classification || null;
      
      // Add to section data
      section.parameters.push({
        name: paramName,
        score: score,
        maxScore: maxScore,
        classification: classification
      });
      
      // Update section raw totals
      section.rawScore += score;
      section.maxScore += maxScore;
      
      // Track classifications
      if (classification) {
        section.classifications[classification] = true;
        
        // Track highest classification impact
        const currentClassificationImpact = classificationImpacts[classification] || 0;
        if (!section.highestClassification || 
            currentClassificationImpact > classificationImpacts[section.highestClassification]) {
          section.highestClassification = classification;
          section.highestClassificationImpact = currentClassificationImpact * 100; // Convert to percentage
        }
      }
    });
  }
  
  // Calculate adjusted scores and percentages for each section
  let overallRawScore = 0;
  let overallMaxScore = 0;
  let overallAdjustedScore = 0;
  
  Object.values(result.sections).forEach(section => {
    if (section.maxScore === 0) return; // Skip empty sections
    
    // Apply classification impact to calculate adjusted score
    const impact = section.highestClassificationImpact / 100; // Convert back to decimal
    const deduction = section.rawScore * impact;
    section.adjustedScore = Math.max(0, section.rawScore - deduction);
    
    // Calculate percentage
    section.percentage = Math.round((section.adjustedScore / section.maxScore) * 100);
    
    // Accumulate overall scores
    overallRawScore += section.rawScore;
    overallMaxScore += section.maxScore;
    overallAdjustedScore += section.adjustedScore;
  });
  
  // Set overall scores
  result.overall.rawScore = overallRawScore;
  result.overall.maxScore = overallMaxScore;
  result.overall.adjustedScore = overallAdjustedScore;
  result.overall.percentage = overallMaxScore > 0 
    ? Math.round((overallAdjustedScore / overallMaxScore) * 100) 
    : 0;
  
  return result;
};

// Classification Options for Dropdown
const classificationOptions = [
  { value: 'none', label: 'None', color: '#6c757d' },
  { value: 'minor', label: 'Minor', color: '#17a2b8' },
  { value: 'moderate', label: 'Moderate', color: '#ffc107' },
  { value: 'major', label: 'Major', color: '#dc3545' }
];

// Custom Select Component for Classifications
const ClassificationSelect = ({ value, onChange, isDisabled }) => {
  // Convert value for react-select
  const selectedOption = classificationOptions.find(option => option.value === value) || 
                         classificationOptions.find(option => option.value === 'none');
  
  // Custom styles
  const customStyles = {
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? state.data.color : provided.backgroundColor,
      color: state.isSelected ? 'white' : provided.color
    }),
    control: (provided, state) => ({
      ...provided,
      borderColor: value !== 'none' ? classificationOptions.find(o => o.value === value)?.color : provided.borderColor,
      boxShadow: state.isFocused ? `0 0 0 0.2rem rgba(0, 123, 255, 0.25)` : 'none'
    }),
    singleValue: (provided) => ({
      ...provided,
      color: value !== 'none' ? classificationOptions.find(o => o.value === value)?.color : provided.color,
      fontWeight: 'bold'
    })
  };
  
  return (
    <Select
      options={classificationOptions}
      value={selectedOption}
      onChange={(option) => onChange(option.value)}
      isDisabled={isDisabled}
      styles={customStyles}
      className="classification-select"
    />
  );
};

// Main QA Detail Component
const QADetail = ({ agentRestricted = false, agentId = null }) => {
  // Extract ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id') || window.location.pathname.split('/').pop();
  
  // State Management
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);
  const [isAgent, setIsAgent] = useState(false);
  const [formParams, setFormParams] = useState(null);
  const [qaForm, setQaForm] = useState(null);

  const [agentAccessChecked, setAgentAccessChecked] = useState(false);
  
  const [resolutionComment, setResolutionComment] = useState('');
  const [resolvingDispute, setResolvingDispute] = useState(false);

  const handleResolveDispute = async (resolution) => {
    try {
      setResolvingDispute(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa/evaluation/${id}/resolve-dispute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resolution: resolution, // 'accept' or 'reject'
          comments: resolutionComment
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${resolution} dispute`);
      }
      
      // Update local state
      const updatedData = await response.json();
      setEvaluation(updatedData);
      
      // Show success message
      setSaveSuccess(`Dispute ${resolution === 'accept' ? 'accepted' : 'rejected'} successfully`);
      
      // Refresh data to ensure we have the latest
      await fetchEvaluation();
    } catch (err) {
      console.error(`Error ${resolution} dispute:`, err);
      setSaveError(err.message);
    } finally {
      setResolvingDispute(false);
    }
  };

  // Human Evaluation State
  const [humanEvaluation, setHumanEvaluation] = useState({
    parameters: {},
    additionalComments: '',
    agentComments: '',
    isModerated: false,
    isPublished: false,
    moderatedBy: null,
    moderatedAt: null
  });
  
  // Live calculation of scores based on current edits
  const [calculatedScores, setCalculatedScores] = useState(null);
  
  // Editing State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  useEffect(() => {
    try {
      // Directly get user roles from localStorage
      const userRolesStr = localStorage.getItem('userRoles');
      if (userRolesStr) {
        const userRoles = JSON.parse(userRolesStr);
        console.log("User Roles from localStorage:", userRoles);
        
        // Only keep this part, which properly handles both true and false values
        setIsAgent(userRoles.isAgent === true);
        setIsAdmin(userRoles.isAdmin === true);
      }
    } catch (e) {
      console.error("Error retrieving user roles:", e);
    }
  }, []);

  // Fetch evaluation data
  const fetchEvaluation = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const userRoles = JSON.parse(localStorage.getItem('userRoles') || '{}');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log(`Fetching evaluation ${id}, agent restricted: ${agentRestricted}, agent ID: ${agentId}`);
      
      // Fetch the evaluation data
      const response = await fetch(`/api/qa/evaluation/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch evaluation');
      }

      const data = await response.json();
      console.log('Evaluation Data:', data);
      
      // If the user is an agent (not admin), check if this evaluation belongs to them
      if (agentRestricted && agentId) {
        console.log(`Agent check: evaluation agent ID: ${data.agent?.id}, current agent ID: ${agentId}`);
        
        if (data.agent?.id != agentId) {
          console.error('Agent access denied - evaluation belongs to another agent');
          setError('You do not have permission to view this evaluation');
          setAgentAccessChecked(true);
          setLoading(false);
          return;
        }
        
        // Agent is allowed to view their own evaluation
        console.log('Agent access granted - evaluation belongs to this agent');
      }
      
      // Set evaluation data
      setEvaluation(data);
      setAgentAccessChecked(true);
      
      // Initialize human evaluation state
      const initialParameters = {};
      if (data.evaluation?.scores?.categories) {
        Object.entries(data.evaluation.scores.categories).forEach(([criterion, criterionData]) => {
          // Safety check for null criterionData
          if (!criterionData) return;
          
          // Get existing human evaluation data if available
          const existingHumanData = data.humanEvaluation?.parameters?.[criterion] || {};
          
          initialParameters[criterion] = {
            score: criterionData.score || 0,
            explanation: criterionData.explanation || '',
            // Use existing human data if available, otherwise use AI data
            humanExplanation: existingHumanData.humanExplanation || '',
            humanScore: existingHumanData.humanScore !== undefined ? 
              existingHumanData.humanScore : (criterionData.score || 0),
            classification: existingHumanData.classification || 
              criterionData.classification || 'none'
          };
        });
      }
      
      const humanEvalData = {
        parameters: initialParameters,
        additionalComments: data.humanEvaluation?.additionalComments || '',
        agentComments: data.humanEvaluation?.agentComments || '',
        isModerated: data.humanEvaluation?.isModerated || false,
        isPublished: data.status === 'published',
        moderatedBy: data.humanEvaluation?.moderatedBy || null,
        moderatedAt: data.humanEvaluation?.moderatedAt || null
      };
      
      setHumanEvaluation(humanEvalData);
      
      // Fetch QA form if form ID exists
      if (data.qaFormId) {
        await fetchQAForm(data.qaFormId);
      }
      
      // Check user permissions
      await checkUserPermissions();
    } catch (err) {
      console.error('Error fetching evaluation:', err);
      setError(err.message);
      setAgentAccessChecked(true);
    } finally {
      setLoading(false);
    }
  }, [id, agentRestricted, agentId]);

  // Fetch QA Form details
  const fetchQAForm = async (formId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa-forms/${formId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QA form');
      }
      
      const formData = await response.json();
      setQaForm(formData);
      
      // Map parameters for easy access
      const paramsMap = {};
      formData.parameters.forEach(param => {
        paramsMap[param.name] = param;
      });
      
      setFormParams(paramsMap);
    } catch (err) {
      console.error('Error fetching QA form:', err);
    }
  };

  // Check user permissions
  const checkUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/permissions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      
      const permissions = await response.json();
      
      // Only update isAdmin from the API response if needed
      // But DON'T update isAgent - keep the value from localStorage
      const isUserAdmin = permissions["qa-forms"]?.write === true;
      setIsAdmin(isUserAdmin);
      
      // Don't set isAgent here anymore
      // const isUserAgent = permissions["qa-forms"]?.read === true && !isUserAdmin;
      // setIsAdmin(isUserAdmin);
      // setIsAgent(isUserAgent);
      
      console.log("Permissions check completed - keeping original isAgent value:", isAgent);
    } catch (err) {
      console.error('Error checking permissions:', err);
      // Don't override isAgent if the API call fails
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    console.log("Evaluation status:", evaluation?.status);
    console.log("Is published:", humanEvaluation?.isPublished);
    console.log("Is agent:", isAgent);
  }, [evaluation, humanEvaluation, isAgent]);

  // Recalculate scores whenever human evaluation changes in edit mode
  useEffect(() => {
    if (isEditMode && qaForm && humanEvaluation.parameters) {
      const scores = calculateScores(humanEvaluation.parameters, qaForm);
      setCalculatedScores(scores);
    } else {
      setCalculatedScores(null);
    }
  }, [isEditMode, qaForm, humanEvaluation.parameters]);

  // Fetch evaluation on component mount
  useEffect(() => {
    if (id) {
      fetchEvaluation();
    }
  }, [id, fetchEvaluation]);

  // Handler for human score changes
  const handleHumanScoreChange = (criterion, value) => {
    // Convert value to number or -1 for N/A
    const scoreValue = value === '-1' ? -1 : parseInt(value);
    
    setHumanEvaluation(prev => {
      // Make sure parameters object exists
      const currentParameters = prev.parameters || {};
      
      // Make sure parameter object exists for this criterion
      const currentParam = currentParameters[criterion] || {
        score: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0,
        explanation: evaluation.evaluation?.scores?.categories?.[criterion]?.explanation || ''
      };
      
      return {
        ...prev,
        parameters: {
          ...currentParameters,
          [criterion]: {
            ...currentParam,
            humanScore: scoreValue
          }
        }
      };
    });
  };

  const handleDisputeEvaluation = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      
      // Make sure the agent has provided comments
      if (!humanEvaluation.agentComments || humanEvaluation.agentComments.trim() === '') {
        setSaveError('Please provide comments explaining why you are disputing this evaluation.');
        setIsSaving(false);
        return;
      }
      
      // Make API call to update the evaluation with a disputed status
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa/evaluation/${id}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentComments: humanEvaluation.agentComments,
          disputed: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to dispute evaluation');
      }
      
      // Update local state
      const updatedData = await response.json();
      setEvaluation(updatedData);
      
      // Show success message
      setSaveSuccess('Your dispute has been submitted. The QA team will review your comments and respond accordingly.');
      
      // Refresh data to ensure we have the latest
      await fetchEvaluation();
    } catch (err) {
      console.error('Error disputing evaluation:', err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for human explanation changes
  const handleHumanExplanationChange = (criterion, value) => {
    setHumanEvaluation(prev => {
      // Make sure parameters object exists
      const currentParameters = prev.parameters || {};
      
      // Make sure parameter object exists for this criterion
      const currentParam = currentParameters[criterion] || {
        score: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0,
        explanation: evaluation.evaluation?.scores?.categories?.[criterion]?.explanation || '',
        humanScore: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0
      };
      
      return {
        ...prev,
        parameters: {
          ...currentParameters,
          [criterion]: {
            ...currentParam,
            humanExplanation: value
          }
        }
      };
    });
  };

  // Handler for classification changes
  const handleClassificationChange = (criterion, value) => {
    setHumanEvaluation(prev => {
      // Make sure parameters object exists
      const currentParameters = prev.parameters || {};
      
      // Make sure parameter object exists for this criterion
      const currentParam = currentParameters[criterion] || {
        score: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0,
        explanation: evaluation.evaluation?.scores?.categories?.[criterion]?.explanation || '',
        humanScore: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0
      };
      
      return {
        ...prev,
        parameters: {
          ...currentParameters,
          [criterion]: {
            ...currentParam,
            classification: value
          }
        }
      };
    });
  };

  // Handler for removing classification
  const handleRemoveClassification = (criterion) => {
    handleClassificationChange(criterion, 'none');
  };

  // Save human evaluation
  const saveHumanEvaluation = async (publish = false) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      
      // Prepare data for submission
      const updatedEvaluation = {
        ...humanEvaluation,
        isModerated: true,
        isPublished: publish,
        moderatedBy: 'Current User', // Replace with actual user identification
        moderatedAt: new Date().toISOString()
      };
      
      // Include calculated scores in the payload
      if (calculatedScores) {
        updatedEvaluation.calculatedScores = calculatedScores;
      }
      
      // Make API call to save evaluation
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa/evaluation/${id}/moderate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedEvaluation)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save evaluation');
      }
      
      // Update local state
      const updatedData = await response.json();
      setHumanEvaluation(updatedEvaluation);
      setEvaluation(updatedData);
      setIsEditMode(false);
      setSaveSuccess(publish ? 'Evaluation published successfully' : 'Evaluation saved successfully');
      
      // Refresh data to ensure we have the latest
      await fetchEvaluation();
    } catch (err) {
      console.error('Error saving evaluation:', err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle additional comments change
  const handleAdditionalCommentsChange = (value) => {
    setHumanEvaluation(prev => ({
      ...prev,
      additionalComments: value
    }));
  };

  // Handle agent comments change
  const handleAgentCommentsChange = (value) => {
    setHumanEvaluation(prev => ({
      ...prev,
      agentComments: value
    }));
  };

  // Navigate function (to be replaced with actual navigation)
  const navigate = (path) => {
    window.location.href = path;
  };

  // Utility Functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatDurationHumanReadable = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = '';
    
    if (hours > 0) {
      result += `${hours} ${hours === 1 ? 'hr' : 'hrs'} `;
    }
    
    if (minutes > 0 || hours > 0) {
      result += `${minutes} ${minutes === 1 ? 'min' : 'mins'} `;
    }
    
    if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) {
      result += `${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
    }
    
    return result.trim();
  };

  const getStatusBadge = () => {
    // First check for disputed status - this should take priority
    if (evaluation.status === 'disputed' || evaluation.disputed === true) {
      return <span className="badge bg-danger">Disputed</span>;
    } 
    // Then check other statuses
    else if (!humanEvaluation.isModerated) {
      return <span className="badge bg-warning">Awaiting Human Moderation</span>;
    } 
    else if (humanEvaluation.isPublished) {
      return <span className="badge bg-success">Published</span>;
    } 
    else {
      return <span className="badge bg-secondary">Not Published</span>;
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || (!evaluation && agentAccessChecked)) {
    return (
      <div className="text-center my-5">
        <div className="alert alert-danger">
          <h4>Failed to load evaluation</h4>
          <p>{error || 'Evaluation not found or you do not have permission to view it'}</p>
          <button 
            className="btn btn-primary mt-3"
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render method for evaluation criteria
  const renderEvaluationCriteria = () => {
    if (!evaluation?.evaluation?.scores?.categories) return null;
  
    return (
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">Evaluation Criteria</h5>
          {isAdmin && !isEditMode && (
            <button 
              className="btn btn-sm btn-outline-primary"
              onClick={() => setIsEditMode(true)}
            >
              <Edit size={14} className="me-1" />
              Edit Criteria
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th style={{width: "20%"}}>Criterion</th>
                  <th style={{width: "15%"}}>Classification</th>
                  <th style={{width: "10%"}}>AI Score</th>
                  {(isEditMode || humanEvaluation.isModerated) && (
                    <th style={{width: "10%"}}>Human Score</th>
                  )}
                  <th style={{width: "45%"}}>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(evaluation.evaluation.scores.categories).map(([criterion, data]) => {
                  // Find parameter definition in QA form
                  const paramDef = formParams?.[criterion];
                  
                  return (
                    <tr key={criterion}>
                      <td>
                        <div className="d-flex flex-column">
                          <strong>{criterion}</strong>
                          {paramDef && (
                            <small className="text-muted">
                              Group: {qaForm?.groups.find(g => g.id === paramDef.group)?.name || 'Unknown'}
                              <br/>
                              Scoring Type: {paramDef.scoringType || 'variable'}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        {isEditMode ? (
                          <ClassificationSelect
                            value={humanEvaluation.parameters[criterion]?.classification || 'none'}
                            onChange={(value) => handleClassificationChange(criterion, value)}
                            isDisabled={isSaving}
                          />
                        ) : (
                          <ClassificationBadge 
                            classification={humanEvaluation.parameters[criterion]?.classification || 'none'}
                            onRemove={isAdmin ? () => handleRemoveClassification(criterion) : null}
                            disabled={!isAdmin}
                          />
                        )}
                      </td>
                      <td>
                        <span className={`badge bg-${
                          data.score >= 4 ? 'success' :
                          data.score >= 3 ? 'warning' : 'danger'
                        }`}>
                          {data.score}/{paramDef?.maxScore || 5}
                        </span>
                      </td>
                      {(isEditMode || humanEvaluation.isModerated) && (
                        <td>
                          {isEditMode ? (
                            paramDef?.scoringType === 'binary' ? (
                              // Binary scoring type - only 0 or maxScore
                              <select 
                                className="form-select"
                                value={humanEvaluation.parameters[criterion]?.humanScore !== undefined ? 
                                  humanEvaluation.parameters[criterion].humanScore : 
                                  data.score}
                                onChange={(e) => handleHumanScoreChange(criterion, e.target.value)}
                                disabled={isSaving}
                              >
                                <option value="-1">N/A</option>
                                <option value="0">0 - Failed</option>
                                <option value={paramDef.maxScore || 5}>{paramDef.maxScore || 5} - Passed</option>
                              </select>
                            ) : (
                              // Variable scoring type - 0 to maxScore
                              <select 
                                className="form-select"
                                value={humanEvaluation.parameters[criterion]?.humanScore !== undefined ? 
                                  humanEvaluation.parameters[criterion].humanScore : 
                                  data.score}
                                onChange={(e) => handleHumanScoreChange(criterion, e.target.value)}
                                disabled={isSaving}
                              >
                                <option value="-1">N/A</option>
                                {[...Array(parseInt(paramDef?.maxScore || 5) + 1).keys()].map(score => (
                                  <option key={score} value={score}>
                                    {score} {score === 0 ? '- Failed' : score === parseInt(paramDef?.maxScore || 5) ? '- Excellent' : ''}
                                  </option>
                                ))}
                              </select>
                            )
                          ) : (
                            humanEvaluation.parameters[criterion]?.humanScore === -1 ? (
                              <span className="badge bg-secondary">N/A</span>
                            ) : (
                              <span className={`badge bg-${
                                (humanEvaluation.parameters[criterion]?.humanScore || 0) >= 4 ? 'success' :
                                (humanEvaluation.parameters[criterion]?.humanScore || 0) >= 3 ? 'warning' : 'danger'
                              }`}>
                                {humanEvaluation.parameters[criterion]?.humanScore !== undefined ? 
                                  humanEvaluation.parameters[criterion].humanScore : 
                                  data.score}
                                /{paramDef?.maxScore || 5}
                              </span>
                            )
                          )}
                        </td>
                      )}
                      <td>
                        {isEditMode ? (
                          <div>
                            <div className="mb-2">
                              <small className="text-muted">AI Explanation:</small>
                              <p className="mb-2">{data.explanation}</p>
                            </div>
                            <div>
                              <small className="text-muted">Human Explanation:</small>
                              <textarea
                                className="form-control mt-1"
                                rows="3"
                                value={humanEvaluation.parameters[criterion]?.humanExplanation || ''}
                                onChange={(e) => handleHumanExplanationChange(criterion, e.target.value)}
                                placeholder="Add your explanation here..."
                                disabled={isSaving}
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            {humanEvaluation.isModerated && humanEvaluation.parameters[criterion]?.humanExplanation ? (
                              <div>
                                <div className="mb-2">
                                  <small className="text-muted">AI:</small>
                                  <p className="mb-0">{data.explanation}</p>
                                </div>
                                <div className="mt-2 p-2 border-start border-primary border-3 bg-light">
                                  <small className="text-primary">Human QA:</small>
                                  <p className="mb-0">{humanEvaluation.parameters[criterion].humanExplanation}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="mb-0">{data.explanation}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {isEditMode && (
            <div className="alert alert-info mt-3">
              <AlertCircle size={16} className="me-2" />
              <strong>Important:</strong> 
              <ul className="mb-0 mt-1">
                <li>Binary questions can only be scored as 0 or full marks.</li>
                <li>Variable questions can be scored from 0 to the maximum score.</li>
                <li>Changes to scores and classifications will be immediately reflected in the section scores below.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render method for save/publish messages
  const renderSaveMessages = () => {
    return (
      <>
        {saveError && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <AlertTriangle size={16} className="me-2" />
            {saveError}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSaveError(null)}
            ></button>
          </div>
        )}
        
        {saveSuccess && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            <CheckCircle size={16} className="me-2" />
            {saveSuccess}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSaveSuccess(null)}
            ></button>
          </div>
        )}
      </>
    );
  };

  // Utility function to get sentiment color
  const getSentimentColor = (sentiment) => {
    return sentiment === 'positive' ? 'bg-success' :
           sentiment === 'negative' ? 'bg-danger' : 'bg-warning';
  };

  // Render Sentiment Analysis Section
  const renderSentimentAnalysis = () => {
    // Get agent and customer sentiment
    const getAgentSentiment = () => {
      if (!evaluation?.evaluation?.agentSentiment) return 'neutral';
      
      return Array.isArray(evaluation.evaluation.agentSentiment) 
        ? evaluation.evaluation.agentSentiment[0] 
        : evaluation.evaluation.agentSentiment;
    };

    const getCustomerSentiment = () => {
      if (!evaluation?.evaluation?.customerSentiment) return 'neutral';
      
      return Array.isArray(evaluation.evaluation.customerSentiment) 
        ? evaluation.evaluation.customerSentiment[0] 
        : evaluation.evaluation.customerSentiment;
    };

    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Sentiment Analysis</h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <h6 className="mb-3">Agent Sentiment</h6>
              <div className="d-flex align-items-center">
                <div className={`badge ${getSentimentColor(getAgentSentiment())} me-2`}>
                  {getAgentSentiment()}
                </div>
                <span className="text-muted small">Overall Call Sentiment</span>
              </div>
            </div>
            <div className="col-md-6">
              <h6 className="mb-3">Customer Sentiment</h6>
              <div className="d-flex align-items-center">
                <div className={`badge ${getSentimentColor(getCustomerSentiment())} me-2`}>
                  {getCustomerSentiment()}
                </div>
                <span className="text-muted small">Overall Call Sentiment</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <h6 className="mb-3">Sentiment Trends</h6>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Start</th>
                    <th>Middle</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Agent</td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.agentSentiment) ?
                          evaluation.evaluation.agentSentiment[0] : getAgentSentiment()
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.agentSentiment) ? 
                          (evaluation.evaluation.agentSentiment[0] || 'neutral') : 
                          getAgentSentiment()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.agentSentiment) ?
                          evaluation.evaluation.agentSentiment[1] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.agentSentiment) ? 
                          (evaluation.evaluation.agentSentiment[1] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.agentSentiment) ?
                          evaluation.evaluation.agentSentiment[2] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.agentSentiment) ? 
                          (evaluation.evaluation.agentSentiment[2] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Customer</td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.customerSentiment) ?
                          evaluation.evaluation.customerSentiment[0] : getCustomerSentiment()
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.customerSentiment) ? 
                          (evaluation.evaluation.customerSentiment[0] || 'neutral') : 
                          getCustomerSentiment()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.customerSentiment) ?
                          evaluation.evaluation.customerSentiment[1] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.customerSentiment) ? 
                          (evaluation.evaluation.customerSentiment[1] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.customerSentiment) ?
                          evaluation.evaluation.customerSentiment[2] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.customerSentiment) ? 
                          (evaluation.evaluation.customerSentiment[2] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Call Summary Section
  const renderCallSummary = () => {
    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Call Summary</h5>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-6">
              <h6 className="mb-3">Duration Details</h6>
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <td><strong>Queue Duration:</strong></td>
                    <td>{formatDurationHumanReadable(evaluation.interaction?.timestamps?.queueDuration)}</td>
                  </tr>
                  <tr>
                    <td><strong>Talk Duration:</strong></td>
                    <td>{formatDurationHumanReadable(evaluation.interaction?.timestamps?.talkDuration)}</td>
                  </tr>
                  <tr>
                    <td><strong>Wrap Up Duration:</strong></td>
                    <td>{formatDurationHumanReadable(evaluation.interaction?.timestamps?.wrapUpDuration)}</td>
                  </tr>
                  {evaluation.interaction?.workCodes && evaluation.interaction.workCodes.length > 0 && (
                    <tr>
                      <td><strong>Work Codes:</strong></td>
                      <td>
                        {evaluation.interaction.workCodes.map((code, index) => (
                          <span key={index} className="badge bg-light text-dark me-1 mb-1">
                            {code.name || code.code}
                          </span>
                        ))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="col-md-6">
              <h6 className="mb-3">Contact Details</h6>
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <td><strong>Agent:</strong></td>
                    <td>{evaluation.agent?.name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Direction:</strong></td>
                    <td className="text-capitalize">{(evaluation.interaction?.direction === 0) ? 'Inbound' : 'Outbound'}</td>
                  </tr>
                  <tr>
                    <td><strong>Channel / Queue:</strong></td>
                    <td className="text-capitalize">{evaluation.interaction?.channel || 'call'} / {evaluation.interaction?.queue?.name || ''}</td>
                  </tr>
                  <tr>
                    <td><strong>Customer ID:</strong></td>
                    <td>{evaluation.interaction?.caller?.id || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Evaluated By:</strong></td>
                    <td>{evaluation.evaluator?.name || 'AI System'}</td>
                  </tr>
                  <tr>
                    <td><strong>Evaluation Date:</strong></td>
                    <td>{evaluation.createdAt ? new Date(evaluation.createdAt).toLocaleString() : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-4">
            <h6 className="mb-3">Evaluation Summary</h6>
            <p className="text-muted mb-0">
              {evaluation.evaluation?.summary || 'No summary available'}
            </p>
          </div>
        </div>
      
        {evaluation.interaction?.recording?.webPath && (
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Call Recording</h5>
            </div>
            <div className="card-body">
              <audio 
                controls 
                className="w-100" 
                controlsList="nodownload"
                preload="metadata"
              >
                <source 
                  src={`/api/audio-proxy?url=${encodeURIComponent(evaluation.interaction.recording.webPath)}`}
                  type="audio/mpeg"
                />
                <p>Your browser does not support the audio element.</p>
              </audio>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Areas of Improvement Section
  const renderAreasOfImprovement = () => {
    if (!evaluation.evaluation?.areasOfImprovement?.length) return null;

    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Areas of Improvement</h5>
        </div>
        <div className="card-body p-0">
          <ul className="list-group list-group-flush">
            {evaluation.evaluation.areasOfImprovement.map((area, index) => (
              <li key={index} className="list-group-item">
                <i className="bi bi-exclamation-triangle text-warning me-2"></i>
                {area}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // Render What the Agent Did Well Section
  const renderAgentStrengths = () => {
    if (!evaluation.evaluation?.whatTheAgentDidWell?.length) return null;

    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">What the Agent Did Well</h5>
        </div>
        <div className="card-body p-0">
          <ul className="list-group list-group-flush">
            {evaluation.evaluation.whatTheAgentDidWell.map((strength, index) => (
              <li key={index} className="list-group-item">
                <i className="bi bi-check-circle text-success me-2"></i>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // Render Silence Periods Section
  const renderSilencePeriods = () => {
    if (!evaluation.evaluation?.silencePeriods?.length) return null;

    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Silence Periods</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.evaluation.silencePeriods.map((period, index) => (
                  <tr key={index}>
                    <td>{period.fromTimeStamp}</td>
                    <td>{period.toTimeStamp}</td>
                    <td>{period.silenceDuration} seconds</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Render Transcription Section
  const renderTranscription = () => {
    // Check if transcription exists
    const hasTranscription = () => {
      const transcriptionSources = [
        evaluation.transcription,
        evaluation.recordedTranscription,
        evaluation.transcriptionAnalysis
      ];

      return transcriptionSources.some(source => 
        source && 
        ((Array.isArray(source) && source.length > 0) || 
         (typeof source === 'object' && Object.keys(source).length > 0))
      );
    };

    // Get transcription data
    const getTranscriptionData = () => {
      if (!evaluation) return [];

      // Prioritize recordedTranscription, then transcription
      if (Array.isArray(evaluation.recordedTranscription) && evaluation.recordedTranscription.length > 0) {
        return evaluation.recordedTranscription;
      }

      if (Array.isArray(evaluation.transcription) && evaluation.transcription.length > 0) {
        return evaluation.transcription.map(message => {
          const timestamp = Object.keys(message)[0];
          let msg = message[timestamp];
          msg.timestamp = new Date(parseInt(timestamp)).toLocaleTimeString();
          return msg;
        });
      }

      return [];
    };

    // If no transcription, return null
    if (!hasTranscription()) return null;

    return (
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            Conversation Transcription 
            {evaluation.transcriptionVersion && (
              <span className="ms-2 badge bg-info">
                {evaluation.transcriptionVersion}
              </span>
            )}
          </h5>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => setShowTranscription(!showTranscription)}
          >
            {showTranscription ? (
              <>
                <EyeOff size={16} className="me-1" />
                Hide Transcription
              </>
            ) : (
              <>
                <Eye size={16} className="me-1" />
                Show Transcription
              </>
            )}
          </button>
        </div>
        
        {showTranscription && (
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Speaker</th>
                    <th>Message</th>
                    <th>Language</th>
                    <th>Sentiment</th>
                  </tr>
                </thead>
                <tbody>
                  {getTranscriptionData().map((entry, index) => (
                    <tr key={index}>
                      <td className="text-nowrap">
                        {entry.timestamp || 'N/A'}
                      </td>
                      <td>
                        <span className={`badge bg-${
                          entry.speaker_id?.includes('agent') ? 'primary' : 'success'
                        }`}>
                          {entry.speaker_id?.includes('agent') ? 'Agent' : 'Customer'}
                        </span>
                      </td>
                      <td>
                        <div>{entry.translated_text || entry.original_text}</div>
                        {entry.original_text && entry.translated_text !== entry.original_text && (
                          <small className="text-muted d-block">
                            Original: {entry.original_text}
                          </small>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-info">
                          {entry.language?.toUpperCase() || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className={`badge bg-${
                          entry.sentiment?.sentiment === 'positive' ? 'success' :
                          entry.sentiment?.sentiment === 'negative' ? 'danger' : 'warning'
                        }`}>
                          {entry.sentiment?.sentiment || 'neutral'}
                        </div>
                        {entry.sentiment?.score && (
                          <small className="d-block text-muted mt-1">
                            {(entry.sentiment.score * 100).toFixed(0)}%
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Transcription Analysis Section
  const renderTranscriptionAnalysis = () => {
    if (!evaluation.transcriptionAnalysis) return null;

    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Transcription Analysis</h5>
        </div>
        <div className="card-body">
          {/* Sentiment Distribution */}
          <div className="row mb-4">
            <div className="col-md-12">
              <h6 className="mb-3">Sentiment Distribution</h6>
              <div className="d-flex justify-content-between">
                <div className="text-center flex-grow-1">
                  <span className="badge bg-success">Positive</span>
                  <h3>{evaluation.transcriptionAnalysis.sentimentDistribution?.positive?.toFixed(1) || 0}%</h3>
                </div>
                <div className="text-center flex-grow-1">
                  <span className="badge bg-danger">Negative</span>
                  <h3>{evaluation.transcriptionAnalysis.sentimentDistribution?.negative?.toFixed(1) || 0}%</h3>
                </div>
                <div className="text-center flex-grow-1">
                  <span className="badge bg-warning">Neutral</span>
                  <h3>{evaluation.transcriptionAnalysis.sentimentDistribution?.neutral?.toFixed(1) || 0}%</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="row mb-4">
            <div className="col-md-12">
              <h6 className="mb-3">Languages Detected</h6>
              <div>
                {Object.entries(evaluation.transcriptionAnalysis.languages || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([language, count]) => (
                    <span key={language} className="badge bg-info me-2 mb-2">
                      {language.toUpperCase()}: {count}
                    </span>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Intents */}
          <div className="row">
            <div className="col-md-12">
              <h6 className="mb-3">Detected Intents</h6>
              <div>
                {evaluation.transcriptionAnalysis.intents?.map((intent, index) => (
                  <span key={index} className="badge bg-secondary me-2 mb-2">
                    {intent}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="row mt-4">
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Total Tokens</h6>
                  <h4>{evaluation.transcriptionAnalysis.totalTokens || 0}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Message Count</h6>
                  <h4>{evaluation.transcriptionAnalysis.messageCount || 0}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render QA Evaluator Comments Section
  const renderQAEvaluatorComments = () => {
    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">QA Evaluator Comments</h5>
        </div>
        <div className="card-body">
          {isEditMode ? (
            <div className="form-group">
              <textarea
                className="form-control"
                rows="4"
                value={humanEvaluation.additionalComments}
                onChange={(e) => handleAdditionalCommentsChange(e.target.value)}
                placeholder="Enter additional comments or feedback for this evaluation..."
                disabled={isSaving}
              />
            </div>
          ) : (
            <div>
              {humanEvaluation.additionalComments ? (
                <div className="p-3 border rounded bg-light">
                  <p className="mb-0">{humanEvaluation.additionalComments}</p>
                </div>
              ) : (
                <p className="text-muted mb-0">No additional comments from QA evaluator.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDisputeResolutionSection = () => {
    // Only show for admins and when the evaluation is disputed
    if (!isAdmin || !(evaluation.status === 'disputed' || evaluation.disputed === true)) {
      return null;
    }
  
    return (
      <div className="card mb-4 border-danger">
        <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            <AlertTriangle size={18} className="me-2" />
            Dispute Resolution
          </h5>
        </div>
        <div className="card-body">
          <div className="alert alert-danger">
            <AlertTriangle size={16} className="me-2" />
            <strong>This evaluation has been disputed by the agent.</strong>
            <p className="mt-2 mb-0">Review the agent's comments above and decide whether to accept or reject the dispute.</p>
          </div>
          
          <div className="form-group mt-3">
            <label className="form-label">Resolution Comments</label>
            <textarea
              className="form-control"
              rows="4"
              value={resolutionComment}
              onChange={(e) => setResolutionComment(e.target.value)}
              placeholder="Provide comments explaining your decision..."
              disabled={resolvingDispute}
            />
          </div>
          
          <div className="d-flex gap-2 mt-3">
            <button 
              className="btn btn-success"
              onClick={() => handleResolveDispute('accept')}
              disabled={resolvingDispute || !resolutionComment.trim()}
              title={!resolutionComment.trim() ? "Please provide comments explaining your decision" : ""}
            >
              {resolvingDispute ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="me-2" />
                  Accept Dispute
                </>
              )}
            </button>
            <button 
              className="btn btn-danger"
              onClick={() => handleResolveDispute('reject')}
              disabled={resolvingDispute || !resolutionComment.trim()}
              title={!resolutionComment.trim() ? "Please provide comments explaining your decision" : ""}
            >
              {resolvingDispute ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle size={16} className="me-2" />
                  Reject Dispute
                </>
              )}
            </button>
          </div>
          
          <div className="mt-3">
            <h6>What happens next?</h6>
            <ul className="mb-0">
              <li><strong>Accept Dispute</strong>: The evaluation will be marked for review and require re-moderation</li>
              <li><strong>Reject Dispute</strong>: The evaluation will remain as is, with your comments added as feedback</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // Render Agent Comments Section
  const renderAgentCommentsSection = () => {
    // Show if:
    // 1. User is an agent AND evaluation is published, OR
    // 2. User is an admin, OR
    // 3. There are existing agent comments
    if (!(
      (isAgent && humanEvaluation.isPublished) || 
      isAdmin || 
      humanEvaluation.agentComments
    )) return null;
    
    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Agent Response</h5>
        </div>
        <div className="card-body">
          {isAgent && humanEvaluation.isPublished ? (
            // Show editable form for agent
            <div className="form-group">
              <textarea
                className="form-control"
                rows="4"
                value={humanEvaluation.agentComments}
                onChange={(e) => handleAgentCommentsChange(e.target.value)}
                placeholder="Enter your response to this evaluation..."
                disabled={isSaving}
              />
              <div className="d-flex gap-2 mt-2">
                <button 
                  className="btn btn-primary"
                  onClick={() => saveHumanEvaluation(true)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <MessageSquare size={16} className="me-2" />
                      Save Response
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={handleDisputeEvaluation}
                  disabled={isSaving || !humanEvaluation.agentComments}
                  title={!humanEvaluation.agentComments ? "Please add comments explaining why you're disputing this evaluation" : ""}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Disputing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="me-2" />
                      Dispute Evaluation
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Show read-only version for admins or when comments exist
            <div>
              {humanEvaluation.agentComments ? (
                <div className="p-3 border rounded bg-light">
                  <p className="mb-0">{humanEvaluation.agentComments}</p>
                  {evaluation.status === 'disputed' || evaluation.disputed ? (
                    <div className="alert alert-danger mt-2">
                      <AlertTriangle size={16} className="me-2" />
                      This evaluation has been disputed by the agent.
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted mb-0">No response from agent yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render method
  return (
    <div className="container-fluid py-4">
      {/* Status and Action Bar */}
      <div className="card mb-4">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <h4 className="mb-0 me-3">QA Evaluation</h4>
            {getStatusBadge()}
          </div>
          
          <div className="d-flex gap-2">
            {isAdmin && !isEditMode && (
              <button 
                className="btn btn-primary"
                onClick={() => setIsEditMode(true)}
              >
                <Edit size={16} className="me-2" />
                Edit Evaluation
              </button>
            )}
            
            {isAdmin && isEditMode && (
              <>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setIsEditMode(false);
                    // Reset any unsaved changes
                    fetchEvaluation();
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => saveHumanEvaluation(false)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="me-2" />
                      Save Evaluation
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-success"
                  onClick={() => saveHumanEvaluation(true)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="me-2" />
                      {humanEvaluation.isPublished ? 'Update & Publish' : 'Publish Evaluation'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save/Publish Messages */}
      {renderSaveMessages()}

      {/* Overall Score Summary */}
      <div className="row mb-4">
        <ScoreCard 
          title="Overall Score" 
          value={isEditMode && calculatedScores ? 
            calculatedScores.overall.adjustedScore.toFixed(1) : 
            evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0}
          maxValue={isEditMode && calculatedScores ? 
            calculatedScores.overall.maxScore : 
            evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100}
          percentage={isEditMode && calculatedScores ? 
            calculatedScores.overall.percentage : 
            Math.round(((evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0) / 
              (evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100)) * 100) || 0}
          bgColor={
            (isEditMode && calculatedScores ? calculatedScores.overall.percentage : 
            Math.round(((evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0) / 
              (evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100)) * 100) || 0) >= 80 ? 
            'bg-success' : 
            (isEditMode && calculatedScores ? calculatedScores.overall.percentage : 
            Math.round(((evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0) / 
              (evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100)) * 100) || 0) >= 60 ? 
            'bg-warning' : 'bg-danger'
          }
        />
      </div>

      {/* Evaluation Criteria */}
      {renderEvaluationCriteria()}

      {/* Section-wise Scores */}
      {qaForm && (
        <SectionWiseScores 
          evaluation={evaluation} 
          qaForm={qaForm} 
          updatedScores={calculatedScores}
        />
      )}

      {/* QA Evaluator Comments */}
      {renderQAEvaluatorComments()}

      {/* Agent Comments Section */}
      {renderAgentCommentsSection()}

      {/* Dispute Resolution Section - for admins only */}
      {renderDisputeResolutionSection()}

      {/* Sentiment Analysis Section */}
      {renderSentimentAnalysis()}

      {/* Call Summary Section */}
      {renderCallSummary()}

      {/* Areas of Improvement and Agent Strengths */}
      <div className="row">
        <div className="col-md-6">
          {renderAreasOfImprovement()}
        </div>
        
        <div className="col-md-6">
          {renderAgentStrengths()}
        </div>
      </div>

      {/* Silence Periods */}
      {renderSilencePeriods()}

      {/* Transcription */}
      {renderTranscription()}

      {/* Transcription Analysis */}
      {renderTranscriptionAnalysis()}
    </div>
  );
};

export default QADetail;