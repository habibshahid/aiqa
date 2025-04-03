// Section-wise scores component for QADetail.js
import React from 'react';

const SectionWiseScores = ({ evaluation, qaForm }) => {
  // Group parameters by section
  const sections = {};
  const classificationMap = {
    minor: { label: 'Minor', impact: 10, color: 'info' },
    moderate: { label: 'Moderate', impact: 25, color: 'warning' },
    major: { label: 'Major', impact: 50, color: 'danger' }
  };
  
  // Use custom classification definitions if available
  if (qaForm && qaForm.classifications) {
    qaForm.classifications.forEach(classification => {
      if (classificationMap[classification.type]) {
        classificationMap[classification.type].impact = classification.impactPercentage;
      }
    });
  }
  
  // Initialize sections
  if (qaForm && qaForm.groups) {
    qaForm.groups.forEach(group => {
      sections[group.id] = {
        name: group.name,
        parameters: [],
        totalScore: 0,
        maxScore: 0,
        percentage: 0
      };
    });
  }
  
  // Calculate section scores
  if (evaluation && evaluation.evaluation && evaluation.evaluation.scores && evaluation.evaluation.scores.categories) {
    // Process each parameter score
    Object.entries(evaluation.evaluation.scores.categories).forEach(([paramName, paramData]) => {
      // Find parameter definition in QA form
      const paramDef = qaForm?.parameters?.find(p => p.name === paramName);
      if (!paramDef) return;
      
      const sectionId = paramDef.group || 'default';
      if (!sections[sectionId]) {
        // Create section if it doesn't exist
        sections[sectionId] = {
          name: qaForm.groups.find(g => g.id === sectionId)?.name || 'Default',
          parameters: [],
          totalScore: 0,
          maxScore: 0,
          percentage: 0
        };
      }
      
      // Add parameter to section
      sections[sectionId].parameters.push({
        name: paramName,
        score: paramData.score,
        maxScore: paramDef.maxScore || 5,
        classification: paramDef.classification
      });
      
      // Update section totals
      sections[sectionId].totalScore += paramData.score;
      sections[sectionId].maxScore += (paramDef.maxScore || 5);
    });
  }
  
  // Calculate percentages
  Object.values(sections).forEach(section => {
    if (section.maxScore > 0) {
      section.percentage = Math.round((section.totalScore / section.maxScore) * 100);
    }
  });
  
  // Calculate overall score
  const totalScore = Object.values(sections).reduce((sum, section) => sum + section.totalScore, 0);
  const maxScore = Object.values(sections).reduce((sum, section) => sum + section.maxScore, 0);
  const overallPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  
  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0">Section-wise Scores</h5>
      </div>
      <div className="card-body">
        {/* Overall Score */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Overall Score</h5>
              <div className="d-flex align-items-center">
                <h5 className="mb-0 me-2">{totalScore}/{maxScore}</h5>
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
        
        {/* Classification Legend */}
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
        
        {/* Section Scores */}
        <div className="row">
          {Object.entries(sections).map(([sectionId, section]) => (
            <div className="col-md-6 mb-4" key={sectionId}>
              <div className="card h-100 border">
                <div className="card-header bg-light">
                  <h6 className="card-title mb-0">{section.name}</h6>
                </div>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>Score</div>
                    <div className="d-flex align-items-center">
                      <div className="me-2">{section.totalScore}/{section.maxScore}</div>
                      <span className={`badge bg-${
                        section.percentage >= 80 ? 'success' :
                        section.percentage >= 60 ? 'warning' : 'danger'
                      }`}>
                        {section.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="progress mb-3" style={{ height: '8px' }}>
                    <div 
                      className={`progress-bar bg-${
                        section.percentage >= 80 ? 'success' :
                        section.percentage >= 60 ? 'warning' : 'danger'
                      }`} 
                      role="progressbar" 
                      style={{ width: `${section.percentage}%` }} 
                      aria-valuenow={section.percentage} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                  
                  {/* Parameter list */}
                  <ul className="list-group list-group-flush">
                    {section.parameters.map((param, index) => (
                      <li key={index} className="list-group-item px-0 py-2 border-0 border-bottom">
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center">
                            <span>{param.name}</span>
                            {param.classification && (
                              <span className={`badge bg-${classificationMap[param.classification]?.color || 'secondary'} ms-2`}>
                                {classificationMap[param.classification]?.label || param.classification}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className={`badge ${
                              (param.score / param.maxScore) >= 0.8 ? 'bg-success' :
                              (param.score / param.maxScore) >= 0.6 ? 'bg-warning' : 'bg-danger'
                            }`}>
                              {param.score}/{param.maxScore}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SectionWiseScores;