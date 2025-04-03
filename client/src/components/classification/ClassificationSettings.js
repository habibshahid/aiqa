// src/components/classification/ClassificationSettings.js
import React, { useState, useEffect } from 'react';

const ClassificationSettings = ({ classifications, onChange }) => {
  // Create local state for each classification to manage UI updates
  const [localClassifications, setLocalClassifications] = useState(classifications || [
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
  ]);

  // When local settings change, notify parent
  useEffect(() => {
    if (onChange) {
      onChange(localClassifications);
    }
  }, [localClassifications, onChange]);

  // Safely parse number input
  const parseNumber = (value) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Handle percentage change
  const handlePercentageChange = (type, value) => {
    const newValue = Math.max(0, Math.min(100, parseNumber(value)));
    
    setLocalClassifications(prev => 
      prev.map(item => 
        item.type === type ? { ...item, impactPercentage: newValue } : item
      )
    );
  };

  // Handle description change
  const handleDescriptionChange = (type, value) => {
    setLocalClassifications(prev => 
      prev.map(item => 
        item.type === type ? { ...item, description: value } : item
      )
    );
  };

  return (
    <div className="card mb-4">
      <div className="card-header bg-light">
        <h5 className="card-title mb-0">Classification Impact Settings</h5>
      </div>
      <div className="card-body">
        <p className="text-muted mb-3">
          Define how different classifications impact scoring. The percentage values represent 
          the portion of points deducted from the entire section when any question in that section 
          has the specified classification.
        </p>
        
        {localClassifications.map((classification) => (
          <div key={classification.type} className="row mb-4">
            <div className="col-12">
              <h6 className="text-capitalize">{classification.type} Classification</h6>
            </div>
            <div className="col-md-3">
              <label className="form-label">Impact Percentage</label>
              <div className="input-group">
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  max="100"
                  value={classification.impactPercentage}
                  onChange={(e) => handlePercentageChange(classification.type, e.target.value)}
                />
                <span className="input-group-text">%</span>
              </div>
              <small className="form-text text-muted">
                % of points deducted from the section
              </small>
            </div>
            <div className="col-md-9">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-control"
                value={classification.description}
                onChange={(e) => handleDescriptionChange(classification.type, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClassificationSettings;