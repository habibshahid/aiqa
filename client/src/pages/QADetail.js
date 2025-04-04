import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Edit, Eye, EyeOff, MessageSquare, CheckCircle, XCircle, AlertTriangle, Save, Lock } from 'lucide-react';
import Select from 'react-select';

// Section-wise Scoring Component
const SectionWiseScores = ({ evaluation, qaForm }) => {
  // Ensure we have the necessary data
  if (!evaluation || !qaForm) return null;

  // Get section scores from evaluation or initialize if not present
  const sectionScores = evaluation.sectionScores || {
    sections: {},
    overall: { rawScore: 0, adjustedScore: 0, maxScore: 0, percentage: 0 }
  };

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
              {Object.entries(sectionScores.sections).map(([sectionId, section]) => {
                // Calculate deduction amount
                const deduction = section.rawScore - section.adjustedScore;
                
                return (
                  <tr key={sectionId}>
                    <td>{section.name}</td>
                    <td>{section.rawScore.toFixed(1)} / {section.maxScore}</td>
                    <td>
                      {section.classifications.major ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-danger me-2">Major</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : section.classifications.moderate ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-warning me-2">Moderate</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : section.classifications.minor ? (
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
                <td>{sectionScores.overall.rawScore.toFixed(1)} / {sectionScores.overall.maxScore}</td>
                <td>-</td>
                <td>
                  {(sectionScores.overall.rawScore - sectionScores.overall.adjustedScore) > 0 ? (
                    <span className="text-danger">
                      -{(sectionScores.overall.rawScore - sectionScores.overall.adjustedScore).toFixed(1)}
                    </span>
                  ) : (
                    <span>0</span>
                  )}
                </td>
                <td>{sectionScores.overall.adjustedScore.toFixed(1)} / {sectionScores.overall.maxScore}</td>
                <td>
                  <div className={`badge bg-${
                    sectionScores.overall.percentage >= 80 ? 'success' :
                    sectionScores.overall.percentage >= 60 ? 'warning' : 'danger'
                  }`}>
                    {sectionScores.overall.percentage}%
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

// Classification Options
const classificationOptions = [
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'major', label: 'Major' }
];

// Classification Badge Component
const ClassificationBadge = ({ classification }) => {
  if (!classification) return null;
  
  const classificationMap = {
    minor: { label: 'Minor', color: 'info', impact: 10 },
    moderate: { label: 'Moderate', color: 'warning', impact: 25 },
    major: { label: 'Major', color: 'danger', impact: 50 }
  };
  
  const config = classificationMap[classification] || { label: classification, color: 'secondary', impact: 0 };
  
  return (
    <div className="position-relative d-inline-block" style={{ cursor: 'help' }}>
      <span
        className={`badge bg-${config.color} me-1`}
        title={`${config.label} issues deduct up to ${config.impact}% of score`}
      >
        {config.label}
      </span>
    </div>
  );
};

// Score Card Component
const ScoreCard = ({ title, value, bgColor = 'bg-primary', subtitle = null }) => (
  <div className="col-md-3">
    <div className="card mb-3">
      <div className={`card-body ${bgColor} text-white`}>
        <h6 className="card-subtitle mb-2">{title}</h6>
        <h2 className="card-title mb-0">{value}</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  </div>
);

// Main QA Detail Component
const QADetail = () => {
  // State Management
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);
  const [isAgent, setIsAgent] = useState(false);
  const [formParams, setFormParams] = useState(null);
  const [qaForm, setQaForm] = useState(null);
  
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
  
  // Classification State
  const [humanEvaluationModifications, setHumanEvaluationModifications] = useState({
    parameters: {},
    classifications: {}
  });

  // Editing State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Placeholder function for navigation (to be replaced with actual navigation logic)
  const navigate = (path) => {
    console.log(`Navigating to: ${path}`);
  };

  // Utility Functions - These will be implemented in subsequent artifacts
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = () => {
    if (!humanEvaluation.isModerated) {
      return <span className="badge bg-warning">Awaiting Human Moderation</span>;
    } else if (humanEvaluation.isPublished) {
      return <span className="badge bg-success">Published</span>;
    } else {
      return <span className="badge bg-secondary">Not Published</span>;
    }
  };

  // Fetch evaluation data
  const fetchEvaluation = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

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
      
      // Set evaluation data
      setEvaluation(data);
      
      // Initialize human evaluation state
      const initialParameters = {};
      if (data.evaluation?.scores?.categories) {
        Object.entries(data.evaluation.scores.categories).forEach(([criterion, criterionData]) => {
          initialParameters[criterion] = {
            score: criterionData.score,
            explanation: criterionData.explanation,
            humanExplanation: '',
            humanScore: criterionData.score,
            classification: data.evaluation.classification || 'minor'
          };
        });
      }
      
      setHumanEvaluation({
        parameters: initialParameters,
        additionalComments: data.humanEvaluation?.additionalComments || '',
        agentComments: data.humanEvaluation?.agentComments || '',
        isModerated: data.humanEvaluation?.isModerated || false,
        isPublished: data.status === 'published',
        moderatedBy: data.humanEvaluation?.moderatedBy || null,
        moderatedAt: data.humanEvaluation?.moderatedAt || null
      });
      
      // Fetch QA form if form ID exists
      if (data.qaFormId) {
        await fetchQAForm(data.qaFormId);
      }
      
      // Check user permissions
      await checkUserPermissions();
    } catch (err) {
      console.error('Error fetching evaluation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      
      // Determine user role
      const isUserAdmin = permissions["qa-forms"]?.write === true;
      const isUserAgent = permissions["qa-forms"]?.read === true && !isUserAdmin;

      setIsAdmin(isUserAdmin);
      setIsAgent(isUserAgent);
    } catch (err) {
      console.error('Error checking permissions:', err);
      // Default to basic permissions if check fails
      setIsAdmin(false);
      setIsAgent(true);
    }
  };

  // Fetch evaluation on component mount
  useEffect(() => {
    if (id) {
      fetchEvaluation();
    }
  }, [id, fetchEvaluation]);

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
  if (error || !evaluation) {
    return (
      <div className="text-center my-5">
        <div className="alert alert-danger">
          <h4>Failed to load evaluation</h4>
          <p>{error || 'Evaluation not found'}</p>
          <button 
            className="btn btn-primary mt-3"
            onClick={() => {
              // Placeholder for navigation
              console.log('Navigate to dashboard');
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Handler for human score changes
  const handleHumanScoreChange = (criterion, value) => {
    const scoreValue = parseInt(value);
    
    setHumanEvaluation(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [criterion]: {
          ...prev.parameters[criterion],
          humanScore: scoreValue
        }
      }
    }));
  };

  // Handler for human explanation changes
  const handleHumanExplanationChange = (criterion, value) => {
    setHumanEvaluation(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [criterion]: {
          ...prev.parameters[criterion],
          humanExplanation: value
        }
      }
    }));
  };

  // Handler for classification changes
  const handleClassificationChange = (criterion, value) => {
    setHumanEvaluation(prev => {
      // Create the parameter entry if it doesn't exist
      const paramEntry = prev.parameters[criterion] || {
        score: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0,
        explanation: evaluation.evaluation?.scores?.categories?.[criterion]?.explanation || '',
        humanScore: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0
      };
      
      return {
        ...prev,
        parameters: {
          ...prev.parameters,
          [criterion]: {
            ...paramEntry,
            classification: value
          }
        }
      };
    });
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
    } catch (err) {
      console.error('Error saving evaluation:', err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

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
                  <th style={{width: "10%"}}>Classification</th>
                  <th style={{width: "10%"}}>AI Score</th>
                  {(isEditMode || humanEvaluation.isModerated) && (
                    <th style={{width: "10%"}}>Human Score</th>
                  )}
                  <th style={{width: "50%"}}>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(evaluation.evaluation.scores.categories).map(([criterion, data]) => (
                  <tr key={criterion}>
                    <td>{criterion}</td>
                    <td>
                      {isEditMode ? (
                        <select
                          className="form-select"
                          value={humanEvaluation.parameters[criterion]?.classification || 'minor'}
                          onChange={(e) => handleClassificationChange(criterion, e.target.value)}
                        >
                          <option value="minor">Minor</option>
                          <option value="moderate">Moderate</option>
                          <option value="major">Major</option>
                        </select>
                      ) : (
                        <span className={`badge bg-${
                          humanEvaluation.parameters[criterion]?.classification === 'major' ? 'danger' :
                          humanEvaluation.parameters[criterion]?.classification === 'moderate' ? 'warning' : 'info'
                        }`}>
                          {humanEvaluation.parameters[criterion]?.classification || 'minor'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge bg-${
                        data.score >= 4 ? 'success' :
                        data.score >= 3 ? 'warning' : 'danger'
                      }`}>
                        {data.score}/{formParams?.[criterion]?.maxScore || 5}
                      </span>
                    </td>
                    {(isEditMode || humanEvaluation.isModerated) && (
                      <td>
                        {isEditMode ? (
                          <select 
                            className="form-select"
                            value={humanEvaluation.parameters[criterion]?.humanScore || data.score}
                            onChange={(e) => handleHumanScoreChange(criterion, e.target.value)}
                          >
                            {[...Array(6).keys()].map(score => (
                              <option key={score} value={score}>
                                {score} {score === 0 ? '- Failed' : score === 5 ? '- Excellent' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge bg-${
                            humanEvaluation.parameters[criterion]?.humanScore >= 4 ? 'success' :
                            humanEvaluation.parameters[criterion]?.humanScore >= 3 ? 'warning' : 'danger'
                          }`}>
                            {humanEvaluation.parameters[criterion]?.humanScore}/{formParams?.[criterion]?.maxScore || 5}
                          </span>
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
                ))}
              </tbody>
            </table>
          </div>
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

  // Utility function to format duration
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

  // Render Agent Comments Section
  const renderAgentCommentsSection = () => {
    // Only show if user is an agent or comments exist
    if (!(isAgent || humanEvaluation.agentComments)) return null;

    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Agent Response</h5>
        </div>
        <div className="card-body">
          {isAgent ? (
            <div className="form-group">
              <textarea
                className="form-control"
                rows="4"
                value={humanEvaluation.agentComments}
                onChange={(e) => handleAgentCommentsChange(e.target.value)}
                placeholder="Enter your response to this evaluation..."
                disabled={!humanEvaluation.isPublished}
              />
              {!humanEvaluation.isPublished && (
                <div className="alert alert-warning mt-2">
                  <Lock size={16} className="me-2" />
                  You cannot respond until this evaluation is published.
                </div>
              )}
              {humanEvaluation.isPublished && (
                <button 
                  className="btn btn-primary mt-2"
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
              )}
            </div>
          ) : humanEvaluation.agentComments ? (
            <div className="p-3 border rounded bg-light">
              <p className="mb-0">{humanEvaluation.agentComments}</p>
            </div>
          ) : (
            <p className="text-muted mb-0">No response from agent yet.</p>
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
            {humanEvaluation.isPublished ? (
              <span className="badge bg-success">Published</span>
            ) : (
              <span className="badge bg-warning">Not Published</span>
            )}
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
                  onClick={() => setIsEditMode(false)}
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
                {!humanEvaluation.isPublished && (
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
                        Publish Evaluation
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save/Publish Messages */}
      {renderSaveMessages()}

      {/* Evaluation Criteria */}
      {renderEvaluationCriteria()}

      {/* Sentiment Analysis Section */}
      {renderSentimentAnalysis()}

      {/* Call Summary Section */}
      {renderCallSummary()}

      {/* Areas of Improvement */}
      <div className="row">
        <div className="col-md-6">
          {renderAreasOfImprovement()}
        </div>
        
        {/* Agent Strengths */}
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

      {/* QA Evaluator Comments */}
      {renderQAEvaluatorComments()}

      {/* Agent Comments Section */}
      {renderAgentCommentsSection()}

      {/* Section-wise Scores */}
      {qaForm && (
        <SectionWiseScores 
          evaluation={evaluation} 
          qaForm={qaForm} 
        />
      )}
    </div>
  );
};

// Utility Functions
const useQADetailLogic = (id) => {
  // Comprehensive state management
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [formParams, setFormParams] = useState(null);
  const [qaForm, setQaForm] = useState(null);

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

  // Editing State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Utility Functions
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }, []);

  const formatDurationHumanReadable = useCallback((seconds) => {
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
  }, []);

  // Sentiment and Classification Utilities
  const getSentimentColor = useCallback((sentiment) => {
    return sentiment === 'positive' ? 'bg-success' :
           sentiment === 'negative' ? 'bg-danger' : 'bg-warning';
  }, []);

  const getScoreOptions = useCallback((criterion) => {
    if (!formParams || !formParams[criterion]) return [];
    
    const param = formParams[criterion];
    const maxScore = param.maxScore || 5;
    const scoringType = param.scoringType || 'variable';
    
    if (scoringType === 'binary') {
      // Binary scoring only has 0 or max
      return [
        { value: 0, label: '0 - Failed' },
        { value: maxScore, label: `${maxScore} - Passed` }
      ];
    } else {
      // Variable scoring has 0 to max
      return Array.from({ length: maxScore + 1 }, (_, i) => ({
        value: i,
        label: `${i} - ${i === 0 ? 'Failed' : i === maxScore ? 'Excellent' : i < maxScore / 2 ? 'Needs Improvement' : 'Good'}`
      }));
    }
  }, [formParams]);

  // Calculation of adjusted score based on classification
  const calculateAdjustedScore = useCallback((score, maxScore, classification) => {
    if (!classification) return score;
    
    const impactMap = {
      minor: 0.10,    // 10% impact
      moderate: 0.25, // 25% impact
      major: 0.50     // 50% impact
    };
    
    const impact = impactMap[classification] || 0;
    const maxDeduction = maxScore * impact;
    const scoreDeficit = maxScore - score;
    const actualDeduction = Math.min(maxDeduction, scoreDeficit);
    
    return Math.max(0, score - actualDeduction);
  }, []);

  // Fetch evaluation data
  const fetchEvaluation = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/qa/evaluation/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch evaluation');
      }

      const data = await response.json();
      
      // Set evaluation data
      setEvaluation(data);
      
      // Initialize human evaluation state
      const initialParameters = {};
      if (data.evaluation?.scores?.categories) {
        Object.entries(data.evaluation.scores.categories).forEach(([criterion, criterionData]) => {
          initialParameters[criterion] = {
            score: criterionData.score,
            explanation: criterionData.explanation,
            humanExplanation: '',
            humanScore: criterionData.score,
            classification: data.evaluation.classification || 'minor'
          };
        });
      }
      
      setHumanEvaluation({
        parameters: initialParameters,
        additionalComments: data.humanEvaluation?.additionalComments || '',
        agentComments: data.humanEvaluation?.agentComments || '',
        isModerated: data.humanEvaluation?.isModerated || false,
        isPublished: data.status === 'published',
        moderatedBy: data.humanEvaluation?.moderatedBy || null,
        moderatedAt: data.humanEvaluation?.moderatedAt || null
      });
      
      // Fetch QA form if form ID exists
      if (data.qaFormId) {
        await fetchQAForm(data.qaFormId);
      }
      
      // Check user permissions
      await checkUserPermissions();
    } catch (err) {
      console.error('Error fetching evaluation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch QA Form details
  const fetchQAForm = useCallback(async (formId) => {
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
  }, []);

  // Check user permissions
  const checkUserPermissions = useCallback(async () => {
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
      
      // Determine user role
      const isUserAdmin = permissions["qa-forms"]?.write === true;
      const isUserAgent = permissions["qa-forms"]?.read === true && !isUserAdmin;

      setIsAdmin(isUserAdmin);
      setIsAgent(isUserAgent);
    } catch (err) {
      console.error('Error checking permissions:', err);
      // Default to basic permissions if check fails
      setIsAdmin(false);
      setIsAgent(true);
    }
  }, []);

  // Save human evaluation
  const saveHumanEvaluation = useCallback(async (publish = false) => {
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
    } catch (err) {
      console.error('Error saving evaluation:', err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [id, humanEvaluation]);

  // Handle parameter score changes
  const handleParameterScoreChange = useCallback((criterion, value) => {
    setHumanEvaluation(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [criterion]: {
          ...prev.parameters[criterion],
          humanScore: parseInt(value)
        }
      }
    }));
  }, []);

  // Handle parameter explanation changes
  const handleParameterExplanationChange = useCallback((criterion, value) => {
    setHumanEvaluation(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [criterion]: {
          ...prev.parameters[criterion],
          humanExplanation: value
        }
      }
    }));
  }, []);

  // Return all the necessary state and methods
  return {
    // State
    evaluation,
    loading,
    error,
    showTranscription,
    isAdmin,
    isAgent,
    formParams,
    qaForm,
    humanEvaluation,
    isEditMode,
    isSaving,
    saveError,
    saveSuccess,

    // Methods
    setShowTranscription,
    setIsEditMode,
    fetchEvaluation,
    saveHumanEvaluation,
    handleParameterScoreChange,
    handleParameterExplanationChange,

    // Utility Functions
    formatDate,
    formatDurationHumanReadable,
    getSentimentColor,
    getScoreOptions,
    calculateAdjustedScore
  };
};

export { SectionWiseScores, useQADetailLogic, QADetail };