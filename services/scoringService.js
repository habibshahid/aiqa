// services/scoringService.js - Updated section scoring logic

/**
 * Get classification impact percentage
 * @param {string} classification - Classification type (minor, moderate, major)
 * @param {Array} classificationDefinitions - Custom classification definitions
 * @returns {number} Impact percentage as a decimal (0.1 for 10%)
 */
const getClassificationImpact = (classification, classificationDefinitions = []) => {
  // Default impact values
  const defaultImpacts = {
    minor: 0.10,     // 10% impact
    moderate: 0.25,  // 25% impact
    major: 0.50      // 50% impact
  };
  
  // Check for custom definition
  const customDef = classificationDefinitions.find(def => def.type === classification);
  if (customDef && typeof customDef.impactPercentage === 'number') {
    return customDef.impactPercentage / 100; // Convert from percentage to decimal
  }
  
  // Return default value
  return defaultImpacts[classification] || 0;
};

/**
 * Calculate section scores with classification impacts applied at the section level
 * @param {Object} evaluation - Evaluation data
 * @param {Object} qaForm - QA form definition
 * @returns {Object} Section scores and overall score
 */
const calculateSectionScores = (evaluation, qaForm) => {
  if (!evaluation || !qaForm) {
    return {
      sections: {},
      overall: { totalScore: 0, maxScore: 0, percentage: 0 }
    };
  }
  
  // Initialize sections
  const sections = {};
  qaForm.groups.forEach(group => {
    sections[group.id] = {
      name: group.name,
      parameters: [],
      totalScore: 0,
      rawScore: 0,
      adjustedScore: 0,
      maxScore: 0,
      percentage: 0,
      highestClassificationImpact: 0,
      classifications: {
        minor: false,
        moderate: false,
        major: false
      }
    };
  });
  
  // Process each parameter
  let evaluationParams = {};
  if (evaluation.evaluation?.scores?.categories) {
    evaluationParams = evaluation.evaluation.scores.categories;
  } else if (evaluation.parameters) {
    evaluationParams = evaluation.parameters;
  }
  
  // First pass: calculate raw scores and track highest classification in each section
  Object.entries(evaluationParams).forEach(([paramName, paramData]) => {
    // Find parameter definition in form
    const paramDef = qaForm.parameters.find(p => p.name === paramName);
    if (!paramDef) return;
    
    const sectionId = paramDef.group || 'default';
    if (!sections[sectionId]) return;
    
    // Extract score data
    const score = paramData.score || 0;
    const maxScore = paramDef.maxScore || 5;
    const classification = paramDef.classification || 'minor';
    
    // Add to section data
    sections[sectionId].parameters.push({
      name: paramName,
      rawScore: score,
      maxScore: maxScore,
      classification: classification
    });
    
    // Update section raw totals
    sections[sectionId].rawScore += score;
    sections[sectionId].maxScore += maxScore;
    
    // Track classifications present in this section
    sections[sectionId].classifications[classification] = true;
    
    // Track highest classification impact
    const impact = getClassificationImpact(classification, qaForm.classifications);
    if (impact > sections[sectionId].highestClassificationImpact) {
      sections[sectionId].highestClassificationImpact = impact;
    }
  });
  
  // Second pass: apply section-level classification impacts
  Object.values(sections).forEach(section => {
    // Apply the highest classification impact to the entire section
    if (section.classifications.major) {
      // If any parameter is marked as major, apply major impact to entire section
      const majorImpact = getClassificationImpact('major', qaForm.classifications);
      const deduction = section.maxScore * majorImpact;
      section.adjustedScore = Math.max(0, section.rawScore - deduction);
    } else if (section.classifications.moderate) {
      // If any parameter is marked as moderate (and none are major), apply moderate impact
      const moderateImpact = getClassificationImpact('moderate', qaForm.classifications);
      const deduction = section.maxScore * moderateImpact;
      section.adjustedScore = Math.max(0, section.rawScore - deduction);
    } else if (section.classifications.minor) {
      // If any parameter is marked as minor (and none are major/moderate), apply minor impact
      const minorImpact = getClassificationImpact('minor', qaForm.classifications);
      const deduction = section.maxScore * minorImpact;
      section.adjustedScore = Math.max(0, section.rawScore - deduction);
    } else {
      // No classifications, no impact
      section.adjustedScore = section.rawScore;
    }
    
    // Calculate percentage for the section
    section.percentage = section.maxScore > 0 
      ? Math.round((section.adjustedScore / section.maxScore) * 100) 
      : 0;
      
    // Set totalScore to match adjustedScore for consistency
    section.totalScore = section.adjustedScore;
  });
  
  // Calculate overall scores
  const overallRawScore = Object.values(sections).reduce((sum, section) => sum + section.rawScore, 0);
  const overallAdjustedScore = Object.values(sections).reduce((sum, section) => sum + section.adjustedScore, 0);
  const overallMaxScore = Object.values(sections).reduce((sum, section) => sum + section.maxScore, 0);
  const overallPercentage = overallMaxScore > 0 ? Math.round((overallAdjustedScore / overallMaxScore) * 100) : 0;
  
  return {
    sections,
    overall: {
      rawScore: overallRawScore,
      adjustedScore: overallAdjustedScore,
      maxScore: overallMaxScore,
      percentage: overallPercentage
    }
  };
};

module.exports = {
  getClassificationImpact,
  calculateSectionScores
};