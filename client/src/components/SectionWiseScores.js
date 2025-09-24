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

  const scoringMechanism = evaluation.scoringMechanism || 'award';
  const isDeductMode = scoringMechanism === 'deduct';
  const formTotalScore = evaluation.formTotalScore || 100;

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
        <h5 className="card-title mb-0">
          {isDeductMode ? 'Section-wise Deductions' : 'Section-level Scores'}
        </h5>
      </div>
      <div className="card-body">
        <p className="text-muted mb-3">
          {isDeductMode ? (
            <>
              Starting with {formTotalScore} points, deductions are applied for each incorrect answer. 
              Classification impacts further reduce the remaining score.
            </>
          ) : (
            <>
              Section scores reflect the impact of classifications. When a section contains a question 
              with a classification, the section's actual earned points are reduced by the defined percentage.
            </>
          )}
        </p>
        
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Section</th>
                {isDeductMode ? (
                  <>
                    <th>Base Score</th>
                    <th>Answer Deductions</th>
                    <th>Classification Impact</th>
                    <th>Total Deductions</th>
                    <th>Final Score</th>
                    <th>Percentage</th>
                  </>
                ) : (
                  <>
                    <th>Raw Score</th>
                    <th>Classification Impact</th>
                    <th>Deduction</th>
                    <th>Final Score</th>
                    <th>Percentage</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
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
                  deductions: 0,
                  classifications: { minor: false, moderate: false, major: false },
                  highestClassification: null,
                  highestClassificationImpact: 0
                };
                
                if (isDeductMode) {
                  const baseScore = section.maxScore || 0;
                  const answerDeductions = section.deductions || 0;
                  const classificationDeduction = section.rawScore - section.adjustedScore;
                  const totalDeductions = answerDeductions + classificationDeduction;
                  
                  return (
                    <tr key={sectionId}>
                      <td>{section.name}</td>
                      <td>{baseScore.toFixed(1)}</td>
                      <td>
                        <span className="text-danger">-{answerDeductions.toFixed(1)}</span>
                      </td>
                      <td>
                        {section.highestClassification ? (
                          <span className="d-flex align-items-center">
                            <span className={`badge bg-${
                              section.highestClassification === 'major' ? 'danger' :
                              section.highestClassification === 'moderate' ? 'warning' : 'info'
                            } me-2`}>
                              {section.highestClassification}
                            </span>
                            <span className="text-danger">
                              -{classificationDeduction.toFixed(1)} ({section.highestClassificationImpact}%)
                            </span>
                          </span>
                        ) : (
                          <span className="badge bg-secondary">None</span>
                        )}
                      </td>
                      <td>
                        <span className="text-danger fw-bold">-{totalDeductions.toFixed(1)}</span>
                      </td>
                      <td>{section.adjustedScore.toFixed(1)} / {baseScore.toFixed(1)}</td>
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
                } else {
                  // Award mode - existing display
                  const deduction = section.rawScore - section.adjustedScore;
                  
                  return (
                    <tr key={sectionId}>
                      <td>{section.name}</td>
                      <td>{section.rawScore.toFixed(1)} / {section.maxScore}</td>
                      <td>
                        {section.classifications?.major ? (
                          <span className="badge bg-danger">Major ({section.highestClassificationImpact}%)</span>
                        ) : section.classifications?.moderate ? (
                          <span className="badge bg-warning">Moderate ({section.highestClassificationImpact}%)</span>
                        ) : section.classifications?.minor ? (
                          <span className="badge bg-info">Minor ({section.highestClassificationImpact}%)</span>
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
                }
              })}
              
              {/* Overall Summary Row */}
              <tr className="table-active fw-bold">
                <td>Overall</td>
                {isDeductMode ? (
                  <>
                    <td>{formTotalScore}</td>
                    <td>
                      <span className="text-danger">
                        -{mergedScores.overall.totalDeductions || (formTotalScore - mergedScores.overall.rawScore)}
                      </span>
                    </td>
                    <td>
                      <span className="text-danger">
                        -{(mergedScores.overall.rawScore - mergedScores.overall.adjustedScore).toFixed(1)}
                      </span>
                    </td>
                    <td>
                      <span className="text-danger fw-bold">
                        -{((formTotalScore - mergedScores.overall.adjustedScore).toFixed(1))}
                      </span>
                    </td>
                    <td>{mergedScores.overall.adjustedScore.toFixed(1)} / {formTotalScore}</td>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
          <h6 className="mb-2">
            {isDeductMode ? 'How Deduct Scoring Works:' : 'How Classification Impacts Are Applied:'}
          </h6>
          <ul className="mb-0">
            {isDeductMode ? (
              <>
                <li>Each section starts with an equal portion of the total score ({formTotalScore} points).</li>
                <li>Points are deducted for each incorrect answer in that section.</li>
                <li>Classification impacts (minor/moderate/major) apply additional percentage-based deductions.</li>
                <li>The final score shows what remains after all deductions.</li>
              </>
            ) : (
              <>
                <li>When a section contains questions with different classifications, the highest classification is applied.</li>
                <li>The deduction is calculated based on the actual earned points in that section, not the maximum possible.</li>
                <li>For example, if a section has earned 20 points and contains a "moderate" question with a 25% impact, 5 points (25% of 20) will be deducted.</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SectionWiseScores;