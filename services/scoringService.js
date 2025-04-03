// services/scoringService.js
const calculateSectionScores = (evaluation, qaForm) => {
  if (!evaluation || !qaForm) {
    return {
      sections: {},
      overall: { totalScore: 0, maxScore: 0, percentage: 0 }
    };
  }
  
  // Get classification definitions from the form
  const classificationImpacts = {};
  qaForm.classifications.forEach(classification => {
    classificationImpacts[classification.type] = classification.impactPercentage / 100;
  });

  // Initialize sections based on groups
  const sections = {};
  qaForm.groups.forEach(group => {
    sections[group.id] = {
      name: group.name,
      parameters: [],
      rawScore: 0,
      maxScore: 0,
      adjustedScore: 0,
      percentage: 0,
      highestClassification: null,
      classificationImpact: 0
    };
  });

  // Process each parameter
  let evaluationParams = evaluation.evaluation?.scores?.categories || {};
  
  // First pass: collect parameter details and calculate raw scores
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
      score: score,
      maxScore: maxScore,
      classification: classification
    });

    // Update section raw totals
    sections[sectionId].rawScore += score;
    sections[sectionId].maxScore += maxScore;

    // Track highest classification impact for the section
    const currentClassificationImpact = classificationImpacts[classification] || 0;
    if (!sections[sectionId].highestClassification || 
        currentClassificationImpact > classificationImpacts[sections[sectionId].highestClassification]) {
      sections[sectionId].highestClassification = classification;
      sections[sectionId].classificationImpact = currentClassificationImpact;
    }
  });

  // Second pass: apply classification impacts
  let overallRawScore = 0;
  let overallMaxScore = 0;
  let overallAdjustedScore = 0;

  Object.values(sections).forEach(section => {
    // Apply classification impact
    const impact = section.classificationImpact;
    const deduction = section.rawScore * impact;
    section.adjustedScore = Math.max(0, section.rawScore - deduction);
    
    // Calculate percentage
    section.percentage = section.maxScore > 0 
      ? Math.round((section.adjustedScore / section.maxScore) * 100) 
      : 0;

    // Accumulate overall scores
    overallRawScore += section.rawScore;
    overallMaxScore += section.maxScore;
    overallAdjustedScore += section.adjustedScore;
  });

  // Calculate overall percentage
  const overallPercentage = overallMaxScore > 0 
    ? Math.round((overallAdjustedScore / overallMaxScore) * 100) 
    : 0;

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
  calculateSectionScores
};