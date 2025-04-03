// src/components/SectionWiseScores.js
import React from 'react';

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

  // Calculate scores by group
  const groupScores = {};
  qaForm.groups.forEach(group => {
    // Get section score if available
    const sectionScore = sectionScores.sections[group.id] || {
      name: group.name,
      rawScore: 0,
      adjustedScore: 0,
      maxScore: 0,
      percentage: 0,
      classifications: { minor: false, moderate: false, major: false },
      highestClassificationImpact: 0
    };

    // Store parameters for this group
    const parameters = qaForm.parameters.filter(param => param.group === group.id);
    
    // Calculate scores if they're not already set
    if (sectionScore.rawScore === 0 && parameters.length > 0) {
      let rawScore = 0;
      let maxScore = 0;
      let classifications = { minor: false, moderate: false, major: false };
      
      parameters.forEach(param => {
        const paramData = evaluation.evaluation?.scores?.categories?.[param.name] || {};
        const score = paramData.score || 0;
        
        // Skip N/A scores
        if (score === -1) return;
        
        rawScore += score;
        maxScore += param.maxScore || 5;
        
        // Track classifications
        if (param.classification) {
          classifications[param.classification] = true;
        }
      });
      
      // Find highest classification
      let highestClassificationImpact = 0;
      let highestClassification = null;
      
      if (classifications.major) {
        highestClassification = 'major';
        highestClassificationImpact = classificationMap.major.impact;
      } else if (classifications.moderate) {
        highestClassification = 'moderate';
        highestClassificationImpact = classificationMap.moderate.impact;
      } else if (classifications.minor) {
        highestClassification = 'minor';
        highestClassificationImpact = classificationMap.minor.impact;
      }
      
      // Calculate adjusted score
      const deduction = rawScore * (highestClassificationImpact / 100);
      const adjustedScore = Math.max(0, rawScore - deduction);
      const percentage = maxScore > 0 ? Math.round((adjustedScore / maxScore) * 100) : 0;
      
      sectionScore.rawScore = rawScore;
      sectionScore.maxScore = maxScore;
      sectionScore.adjustedScore = adjustedScore;
      sectionScore.percentage = percentage;
      sectionScore.classifications = classifications;
      sectionScore.highestClassification = highestClassification;
      sectionScore.highestClassificationImpact = highestClassificationImpact;
    }
    
    groupScores[group.id] = sectionScore;
  });

  // Calculate overall scores if not already set
  const overallRawScore = Object.values(groupScores).reduce((total, group) => total + group.rawScore, 0);
  const overallMaxScore = Object.values(groupScores).reduce((total, group) => total + group.maxScore, 0);
  const overallAdjustedScore = Object.values(groupScores).reduce((total, group) => total + group.adjustedScore, 0);
  const overallPercentage = overallMaxScore > 0 
    ? Math.round((overallAdjustedScore / overallMaxScore) * 100) 
    : 0;

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0">Group-wise Scoring</h5>
      </div>
      <div className="card-body">
        {/* Overall Score Summary */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Overall Score</h5>
              <div className="d-flex align-items-center">
                <h5 className="mb-0 me-2">{overallAdjustedScore.toFixed(2)}/{overallMaxScore}</h5>
                <span className={`badge bg-${
                  overallPercentage >= 80 ? 'success' :
                  overallPercentage >= 60 ? 'warning' : 'danger'
                }`}>
                  {overallPercentage}%
                </span>
              </div>
            </div>
            <div className="progress" style={{ height: '12px' }}>
              <div 
                className={`progress-bar bg-${
                  overallPercentage >= 80 ? 'success' :
                  overallPercentage >= 60 ? 'warning' : 'danger'
                }`} 
                role="progressbar" 
                style={{ width: `${overallPercentage}%` }} 
                aria-valuenow={overallPercentage} 
                aria-valuemin="0" 
                aria-valuemax="100"
              ></div>
            </div>
          </div>
        </div>

        {/* Classification Impact Legend */}
        <div className="row mb-4">
          <div className="col-12">
            <h6 className="mb-2">Classification Impact</h6>
            <div className="d-flex flex-wrap gap-3">
              {Object.entries(classificationMap).map(([key, value]) => (
                <div key={key} className="d-flex align-items-center">
                  <span className={`badge bg-${value.color} me-2`}>{value.label}</span>
                  <span className="small text-muted">-{value.impact}% impact</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Group-wise Scores */}
        <div className="row">
          {Object.entries(groupScores).map(([groupId, groupScore]) => {
            const rawScore = groupScore.rawScore || 0;
            const maxScore = groupScore.maxScore || 0;
            const adjustedScore = groupScore.adjustedScore || 0;
            const percentage = groupScore.percentage || 0;

            // Determine classification badge
            const classification = groupScore.highestClassification || null;
            const classificationData = classification ? classificationMap[classification] : null;
            
            return (
              <div key={groupId} className="col-md-6 mb-4">
                <div className="card h-100 border">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="card-title mb-0">{groupScore.name || groupMap[groupId] || 'Unknown Group'}</h6>
                    {classification && (
                      <span className={`badge bg-${classificationData?.color || 'secondary'}`}>
                        {classificationData?.label || classification}
                      </span>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>Score</div>
                      <div className="d-flex align-items-center">
                        <div className="me-2">{adjustedScore.toFixed(2)}/{maxScore}</div>
                        <span className={`badge bg-${
                          percentage >= 80 ? 'success' :
                          percentage >= 60 ? 'warning' : 'danger'
                        }`}>
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="progress mb-3" style={{ height: '8px' }}>
                      <div 
                        className={`progress-bar bg-${
                          percentage >= 80 ? 'success' :
                          percentage >= 60 ? 'warning' : 'danger'
                        }`} 
                        role="progressbar" 
                        style={{ width: `${percentage}%` }} 
                        aria-valuenow={percentage} 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      ></div>
                    </div>
                    
                    {/* Detailed Parameter Breakdown */}
                    <ul className="list-group list-group-flush">
                      {qaForm.parameters
                        .filter(param => param.group === groupId)
                        .map((param, index) => {
                          // Find the corresponding parameter data in evaluation
                          const paramData = evaluation.evaluation?.scores?.categories?.[param.name] || {};
                          
                          // Check if the parameter is N/A
                          const isNA = paramData.score === -1;
                          
                          return (
                            <li 
                              key={index} 
                              className={`list-group-item px-0 py-2 border-0 border-bottom ${isNA ? 'text-muted' : ''}`}
                            >
                              <div className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                  <span>{param.name}</span>
                                  {isNA && (
                                    <span className="badge bg-secondary ms-2">N/A</span>
                                  )}
                                  {!isNA && param.classification && (
                                    <span className={`badge bg-${
                                      classificationMap[param.classification]?.color || 'secondary'
                                    } ms-2`}>
                                      {classificationMap[param.classification]?.label || param.classification}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  {isNA ? (
                                    <span className="badge bg-secondary">N/A</span>
                                  ) : (
                                    <span className={`badge ${
                                      (paramData.score / param.maxScore) >= 0.8 ? 'bg-success' :
                                      (paramData.score / param.maxScore) >= 0.6 ? 'bg-warning' : 'bg-danger'
                                    }`}>
                                      {paramData.score}/{param.maxScore}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {!isNA && paramData.explanation && (
                                <div className="text-muted small mt-1">
                                  {paramData.explanation}
                                </div>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Classification Impact Explanation */}
        <div className="alert alert-info mt-3">
          <h6 className="mb-2">How Classification Impacts Are Applied:</h6>
          <ul className="mb-0">
            <li>Each group has its highest classification impact applied to its total score.</li>
            <li>The impact is calculated as a percentage deduction from the group's raw score.</li>
            <li>For example, a "Major" classification with a 50% impact will reduce the group's score by half if severe issues are found.</li>
            <li>The final overall score reflects these group-level adjustments.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SectionWiseScores;