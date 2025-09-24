// client/src/components/ScoringPreview.js - NEW COMPONENT
import React from 'react';

const ScoringPreview = ({ formData }) => {
  // Calculate totals
  const parametersByGroup = {};
  let totalMaxScore = 0;
  
  formData.parameters.forEach(param => {
    const groupId = param.group || 'default';
    if (!parametersByGroup[groupId]) {
      parametersByGroup[groupId] = {
        name: formData.groups.find(g => g.id === groupId)?.name || 'Default Group',
        parameters: [],
        maxScore: 0
      };
    }
    parametersByGroup[groupId].parameters.push(param);
    parametersByGroup[groupId].maxScore += param.maxScore || 5;
    totalMaxScore += param.maxScore || 5;
  });
  
  // Example scores for preview (70% performance)
  const examplePercentage = 0.7;
  const exampleEarnedScore = Math.round(totalMaxScore * examplePercentage);
  const exampleDeductions = totalMaxScore - exampleEarnedScore;
  
  return (
    <div className="card border-info">
      <div className="card-header bg-info text-white">
        <h6 className="mb-0">
          <i className="bi bi-calculator me-2"></i>
          Scoring Preview
        </h6>
      </div>
      <div className="card-body">
        <h6>Current Configuration:</h6>
        <ul className="mb-3">
          <li>Scoring Mode: <strong>{formData.scoringMechanism === 'award' ? 'Award Points' : 'Deduct Points'}</strong></li>
          <li>Total Questions: <strong>{formData.parameters.length}</strong></li>
          <li>Maximum Possible Points: <strong>{totalMaxScore}</strong></li>
          {formData.scoringMechanism === 'deduct' && (
            <li>Starting Score: <strong>{formData.totalScore}</strong></li>
          )}
        </ul>
        
        <h6>Example Calculation (70% Performance):</h6>
        <div className="table-responsive">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Group</th>
                <th>Questions</th>
                <th>Max Score</th>
                {formData.scoringMechanism === 'award' ? (
                  <th>Earned (70%)</th>
                ) : (
                  <th>Deductions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {Object.entries(parametersByGroup).map(([groupId, group]) => {
                const earned = Math.round(group.maxScore * examplePercentage);
                const deducted = group.maxScore - earned;
                return (
                  <tr key={groupId}>
                    <td>{group.name}</td>
                    <td>{group.parameters.length}</td>
                    <td>{group.maxScore}</td>
                    <td>
                      {formData.scoringMechanism === 'award' ? (
                        <span className="text-success">+{earned}</span>
                      ) : (
                        <span className="text-danger">-{deducted}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td colSpan="3">Final Score:</td>
                <td>
                  {formData.scoringMechanism === 'award' ? (
                    <span className="text-success">{exampleEarnedScore}/{totalMaxScore} (70%)</span>
                  ) : (
                    <span>
                      {formData.totalScore - exampleDeductions}/{formData.totalScore} 
                      ({Math.round(((formData.totalScore - exampleDeductions) / formData.totalScore) * 100)}%)
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div className={`alert ${formData.scoringMechanism === 'award' ? 'alert-success' : 'alert-warning'} mb-0 mt-3`}>
          <small>
            <strong>Note:</strong> 
            {formData.scoringMechanism === 'award' 
              ? ' In Award mode, agents accumulate points. Lower scores indicate poorer performance.'
              : ' In Deduct mode, agents start with full marks. Even small mistakes result in deductions, making this mode stricter.'}
          </small>
        </div>
      </div>
    </div>
  );
};

export default ScoringPreview;