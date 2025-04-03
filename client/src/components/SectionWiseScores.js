// src/components/SectionWiseScores.js
import React from 'react';

const SectionWiseScores = ({ evaluation, qaForm }) => {
  // Ensure we have the necessary data
  if (!evaluation || !qaForm) return null;

  const groupScores = evaluation.evaluation?.groupScores || {};
  const allGroups = qaForm.groups.map(group => group.name);

  const completeGroupScores = allGroups.reduce((acc, groupName) => {
    acc[groupName] = groupScores[groupName] || {
      rawScore: 0,
      maxScore: 0,
      adjustedScore: 0,
      applicableScore: 0,
      applicableMaxScore: 0,
      naQuestions: []
    };
    return acc;
  }, {});

  // Prepare classification impact information
  const classificationMap = {
    minor: { label: 'Minor', color: 'info' },
    moderate: { label: 'Moderate', color: 'warning' },
    major: { label: 'Major', color: 'danger' }
  };

  // Use custom classification definitions if available
  if (qaForm && qaForm.classifications) {
    qaForm.classifications.forEach(classification => {
      if (classificationMap[classification.type]) {
        classificationMap[classification.type].impact = classification.impactPercentage;
      }
    });
  }

  // Calculate overall scores
  const overallRawScore = evaluation.evaluation?.rawScore || 0;
  const overallMaxScore = evaluation.evaluation?.maxScore || 0;
  const overallAdjustedScore = evaluation.evaluation?.totalScore || 0;
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
                  <span className="small text-muted">-{value.impact || 10}% impact</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Group-wise Scores */}
        <div className="row">
          {Object.entries(groupScores).map(([groupName, groupScore]) => {
            const rawScore = groupScore.rawScore || 0;
            const maxScore = groupScore.maxScore || 0;
            const adjustedScore = groupScore.adjustedScore || 0;
            const percentage = maxScore > 0 
              ? Math.round((adjustedScore / maxScore) * 100) 
              : 0;

            // Determine classification badge
            //const classification = groupScore.highestClassification || 'minor';
            
            return (
              <div key={groupName} className="col-md-6 mb-4">
                <div className="card h-100 border">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="card-title mb-0">{groupName}</h6>
                    <span className={`badge bg-${
                      classificationMap[classification]?.color || 'secondary'
                    }`}>
                      {classificationMap[classification]?.label || classification}
                    </span>
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
                        .filter(param => param.group === groupName)
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
                                  {!isNA && (
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
                      
                      {/* Show N/A questions if any */}
                      {groupScores[groupName]?.naQuestions?.length > 0 && (
                        <li className="list-group-item text-muted small">
                          <strong>Not Applicable Questions:</strong>{' '}
                          {groupScores[groupName].naQuestions.map(q => q.name).join(', ')}
                        </li>
                      )}
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