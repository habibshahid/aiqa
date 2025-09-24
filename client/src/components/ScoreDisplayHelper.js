// client/src/components/ScoreDisplayHelper.js - NEW COMPONENT
import React from 'react';

// Unified Score Badge Component
export const ScoreBadge = ({ score, maxScore, percentage, size = 'normal' }) => {
  const sizeClass = size === 'small' ? 'badge-sm' : '';
  const colorClass = percentage >= 80 ? 'success' : 
                     percentage >= 60 ? 'warning' : 'danger';
  
  return (
    <div className={`badge bg-${colorClass} ${sizeClass}`}>
      {score} / {maxScore}
      {size !== 'small' && <small className="d-block">{percentage}%</small>}
    </div>
  );
};

// Scoring Mechanism Badge
export const ScoringBadge = ({ mechanism, size = 'normal' }) => {
  const isDeduct = mechanism === 'deduct';
  const sizeClass = size === 'small' ? 'badge-sm' : '';
  
  return (
    <span className={`badge bg-${isDeduct ? 'warning text-dark' : 'success'} ${sizeClass}`}>
      {isDeduct ? 'Deduct' : 'Award'}
    </span>
  );
};

// Complete Score Display Component
export const ScoreDisplay = ({ 
  evaluation, 
  showMechanism = true, 
  showDeductions = true,
  orientation = 'vertical' // 'vertical' or 'horizontal'
}) => {
  const isDeductMode = evaluation.scoringMechanism === 'deduct';
  
  // Extract score values based on data structure
  const scores = evaluation.sectionScores?.overall || 
                evaluation.evaluation?.scores?.overall || 
                evaluation;
                
  const adjustedScore = scores.adjustedScore || scores.totalScore || 0;
  const maxScore = isDeductMode 
    ? (evaluation.formTotalScore || scores.maxScore || 100)
    : (scores.maxScore || evaluation.maxScore || 100);
  const percentage = scores.percentage || 
                    (maxScore > 0 ? Math.round((adjustedScore / maxScore) * 100) : 0);
  const totalDeductions = evaluation.evaluationData?.evaluation?.totalDeductions || 
                         evaluation.evaluation?.totalDeductions || 0;
  
  if (orientation === 'horizontal') {
    return (
      <div className="d-flex align-items-center gap-2">
        {showMechanism && <ScoringBadge mechanism={evaluation.scoringMechanism} size="small" />}
        <ScoreBadge 
          score={adjustedScore.toFixed(1)} 
          maxScore={maxScore} 
          percentage={percentage} 
          size="small"
        />
        {showDeductions && isDeductMode && totalDeductions > 0 && (
          <small className="text-danger">(-{totalDeductions})</small>
        )}
      </div>
    );
  }
  
  // Vertical orientation (default)
  return (
    <div className="d-flex flex-column align-items-center">
      {showMechanism && (
        <div className="mb-1">
          <ScoringBadge mechanism={evaluation.scoringMechanism} />
        </div>
      )}
      
      <ScoreBadge 
        score={adjustedScore.toFixed(1)} 
        maxScore={maxScore} 
        percentage={percentage} 
      />
      
      {showDeductions && isDeductMode && totalDeductions > 0 && (
        <small className="text-danger mt-1">
          -{totalDeductions} pts deducted
        </small>
      )}
    </div>
  );
};

// Deduction Breakdown Component
export const DeductionBreakdown = ({ evaluation }) => {
  const isDeductMode = evaluation.scoringMechanism === 'deduct';
  if (!isDeductMode) return null;
  
  const totalDeductions = evaluation.evaluationData?.evaluation?.totalDeductions || 0;
  const deductionDetails = evaluation.evaluationData?.evaluation?.deductionDetails || [];
  const classificationImpact = (evaluation.sectionScores?.overall?.rawScore || 0) - 
                              (evaluation.sectionScores?.overall?.adjustedScore || 0);
  
  return (
    <div className="card border-warning">
      <div className="card-header bg-warning text-dark">
        <h6 className="mb-0">
          <i className="bi bi-dash-circle me-2"></i>
          Deduction Breakdown
        </h6>
      </div>
      <div className="card-body">
        <table className="table table-sm mb-0">
          <tbody>
            <tr>
              <td>Starting Score:</td>
              <td className="text-end">{evaluation.formTotalScore || 100}</td>
            </tr>
            <tr>
              <td>Answer Deductions:</td>
              <td className="text-end text-danger">-{totalDeductions}</td>
            </tr>
            {classificationImpact > 0 && (
              <tr>
                <td>Classification Impact:</td>
                <td className="text-end text-danger">-{classificationImpact.toFixed(1)}</td>
              </tr>
            )}
            <tr className="fw-bold">
              <td>Final Score:</td>
              <td className="text-end">
                {evaluation.sectionScores?.overall?.adjustedScore?.toFixed(1) || 0}
              </td>
            </tr>
          </tbody>
        </table>
        
        {deductionDetails.length > 0 && (
          <details className="mt-3">
            <summary className="text-muted small">View detailed deductions</summary>
            <ul className="list-unstyled mt-2 small">
              {deductionDetails.map((detail, idx) => (
                <li key={idx} className="mb-1">
                  <span className="text-muted">{detail.paramName}:</span>
                  <span className="text-danger ms-2">-{detail.deduction}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
};

export default { ScoreDisplay, ScoreBadge, ScoringBadge, DeductionBreakdown };