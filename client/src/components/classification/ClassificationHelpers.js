// Components for better classification selection and explanation
import React from 'react';
import { Info } from 'lucide-react';

// Classification Info Tooltip Component
const ClassificationInfo = () => {
  return (
    <div className="card border-info mt-3">
      <div className="card-header bg-info bg-opacity-10">
        <h6 className="card-title mb-0 d-flex align-items-center">
          <Info size={16} className="me-2" />
          Understanding Classification Impact
        </h6>
      </div>
      <div className="card-body">
        <p className="text-muted mb-1">
          Classifications determine how severely a question affects the overall score when issues are found:
        </p>
        <ul className="mb-0">
          <li>
            <strong className="text-info">Minor</strong>: Small issues with minimal impact on quality (10% score deduction)
          </li>
          <li>
            <strong className="text-warning">Moderate</strong>: Significant issues affecting quality (25% score deduction)
          </li>
          <li>
            <strong className="text-danger">Major</strong>: Critical issues with substantial impact (50% score deduction)
          </li>
        </ul>
      </div>
    </div>
  );
};

// Enhanced Classification Select Component with clear visuals
const ClassificationSelect = ({ value, onChange, disabled = false }) => {
  const classificationOptions = [
    { value: 'minor', label: 'Minor', color: 'info', impact: 10 },
    { value: 'moderate', label: 'Moderate', color: 'warning', impact: 25 },
    { value: 'major', label: 'Major', color: 'danger', impact: 50 }
  ];
  
  return (
    <div>
      <div className="mb-2">
        <div className="d-flex gap-2">
          {classificationOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className={`btn ${value === option.value 
                ? `btn-${option.color}` 
                : `btn-outline-${option.color}`}`}
              onClick={() => onChange({ target: { value: option.value } })}
              disabled={disabled}
            >
              {option.label}
              <span className="ms-1 badge bg-light text-dark">-{option.impact}%</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Also maintain the regular select for accessibility */}
      <select
        className="form-select"
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label="Question classification"
      >
        {classificationOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label} (-{option.impact}% impact)
          </option>
        ))}
      </select>
    </div>
  );
};

// Usage example in QAFormEditor.js:
/*
<div className="col-md-2">
  <label className="form-label">Classification</label>
  <ClassificationSelect
    value={param.classification || 'minor'}
    onChange={(e) => handleParameterChange(paramIndex, 'classification', e.target.value)}
    disabled={false}
  />
</div>

// Add this near the top of your form or in a help section
<ClassificationInfo />
*/

export { ClassificationInfo, ClassificationSelect };