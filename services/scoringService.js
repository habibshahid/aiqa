// services/scoringService.js - Enhanced with scoring type handling

/**
 * Calculate evaluation scores with proper handling of different scoring types
 * @param {Object} evaluation - The evaluation object
 * @param {String} formId - QA Form ID
 * @returns {Promise<Object>} - Section scores and overall score
 */
const calculateEvaluationScores = async (evaluation, formId) => {
  try {
    if (!evaluation || !formId) {
      return {
        sections: {},
        overall: { 
          rawScore: 0, 
          adjustedScore: 0, 
          maxScore: 0, 
          percentage: 0 
        }
      };
    }

    // Get the QA form to determine groups and classifications
    const { QAForm } = require('../config/mongodb');
    const qaForm = await QAForm.findById(formId);
    
    if (!qaForm) {
      throw new Error(`QA Form not found: ${formId}`);
    }
    
    const scoringMechanism = qaForm.scoringMechanism || 'award';
    const formTotalScore = qaForm.totalScore || 100;

    console.log(`Scoring mechanism: ${scoringMechanism}, Form total score: ${formTotalScore}`);

    // Classification impact definitions from QA form
    const classificationImpacts = {};
    if (qaForm.classifications && Array.isArray(qaForm.classifications)) {
      qaForm.classifications.forEach(classification => {
        classificationImpacts[classification.type] = classification.impactPercentage / 100;
      });
    } else {
      // Default classification impacts
      classificationImpacts.minor = 0.1;    // 10%
      classificationImpacts.moderate = 0.25; // 25%
      classificationImpacts.major = 0.5;    // 50%
      classificationImpacts.none = 0;       // 0%
    }
    
    console.log('Classification impacts:', Object.entries(classificationImpacts)
      .map(([type, impact]) => `${type}: ${(impact * 100).toFixed(0)}%`)
      .join(', '));
    
    // Initialize section scores for each group
    const sectionScores = {};
    let totalDeductions = 0;
    
    if (qaForm.groups && Array.isArray(qaForm.groups)) {
      qaForm.groups.forEach(group => {
        sectionScores[group.id] = {
          name: group.name,
          rawScore: 0,
          maxScore: 0,
          adjustedScore: 0,
          percentage: 0,
          parameters: [],
          classifications: {
            minor: false,
            moderate: false,
            major: false
          },
          highestClassification: null,
          highestClassificationImpact: 0,
          deductions: 0
        };
      });
    } else {
      // Default group if none exists
      sectionScores.default = {
        name: "Default Group",
        rawScore: 0,
        maxScore: 0,
        adjustedScore: 0,
        percentage: 0,
        parameters: [],
        classifications: {
          minor: false,
          moderate: false,
          major: false
        },
        highestClassification: null,
        highestClassificationImpact: 0,
        deductions: 0
      };
    }
    
    // Get evaluation parameters - first try human evaluation, then AI evaluation
    let evaluationParams = {};
    
    if (evaluation.humanEvaluation && evaluation.humanEvaluation.parameters) {
      // Use human evaluation parameters if available
      Object.entries(evaluation.humanEvaluation.parameters).forEach(([key, value]) => {
        // Skip null or undefined values
        if (!value) return;
        
        // Find parameter definition in QA form
        const paramDef = qaForm.parameters.find(p => p.name === key);
        const scoringType = paramDef ? paramDef.scoringType : 'variable';
        const maxScore = paramDef ? paramDef.maxScore || 5 : 5;
        
        // Skip N/A scores
        if (value.humanScore === -1) return;
        
        // Adjust score based on scoring type
        let finalScore = value.humanScore;
        if (finalScore !== undefined && finalScore !== null) {
          if (scoringType === 'binary') {
            // Binary parameters can only be 0 or maxScore
            finalScore = finalScore > (maxScore / 2) ? maxScore : 0;
          } else {
            // Variable parameters can be any value from 0 to maxScore
            finalScore = Math.min(finalScore, maxScore);
          }
        } else {
          finalScore = value.score || 0;
        }
        
        evaluationParams[key] = {
          score: finalScore,
          classification: value.classification || 'none',
          name: key,
          scoringType: scoringType,
          maxScore: maxScore
        };
      });
    }
    
    // If human evaluation parameters didn't exist or were empty, use AI evaluation
    if (Object.keys(evaluationParams).length === 0 && 
        evaluation.evaluation && 
        evaluation.evaluation.scores && 
        evaluation.evaluation.scores.categories) {
      
      Object.entries(evaluation.evaluation.scores.categories).forEach(([key, value]) => {
        // Skip null or undefined values
        if (!value) return;
        
        // Find parameter definition in QA form
        const paramDef = qaForm.parameters.find(p => p.name === key);
        const scoringType = paramDef ? paramDef.scoringType : 'variable';
        const maxScore = paramDef ? paramDef.maxScore || 5 : 5;
        
        // Skip N/A scores
        if (value.score === -1) return;
        
        // Adjust score based on scoring type
        let finalScore = value.score;
        if (scoringType === 'binary') {
          // Binary parameters can only be 0 or maxScore
          finalScore = finalScore > (maxScore / 2) ? maxScore : 0;
        } else {
          // Variable parameters can be any value from 0 to maxScore
          finalScore = Math.min(finalScore, maxScore);
        }
        
        evaluationParams[key] = {
          score: finalScore,
          classification: value.classification || 'none',
          name: key,
          scoringType: scoringType,
          maxScore: maxScore
        };
      });
    }
    
    // Process each parameter
    Object.values(evaluationParams).forEach(paramData => {
      // Skip N/A scores
      if (paramData.score === -1) return;
      
      // Find parameter definition in QA form
      const paramDef = qaForm.parameters.find(p => p.name === paramData.name);
      if (!paramDef) return;
      
      // Get group and max score
      const groupId = paramDef.group || 'default';
      const section = sectionScores[groupId] || sectionScores.default;
      
      if (!section) return;
      
      // Add parameter to section
      if (scoringMechanism === 'award') {
        section.parameters.push({
          name: paramData.name,
          score: paramData.score || 0,
          maxScore: paramData.maxScore,
          classification: paramData.classification || 'none',
          scoringType: paramData.scoringType
        });
      } else if (scoringMechanism === 'deduct') {
        // Negative marking - calculate deductions
        const deduction = paramData.maxScore - paramData.score;
        
        section.parameters.push({
          name: paramData.name,
          score: paramData.score || 0,
          maxScore: paramData.maxScore,
          deduction: deduction,
          classification: paramData.classification || 'none',
          scoringType: paramData.scoringType
        });
        
        section.deductions += deduction;
        totalDeductions += deduction;
      }
      
      // Update raw scores
      section.rawScore += paramData.score || 0;
      section.maxScore += paramData.maxScore;
      
      // Track classifications
      const classification = paramData.classification;
      if (classification && classification !== 'none') {
        section.classifications[classification] = true;
        
        // Check if this is the highest impact classification
        const impact = classificationImpacts[classification] || 0;
        if (!section.highestClassification || 
            impact > (classificationImpacts[section.highestClassification] || 0)) {
          section.highestClassification = classification;
          section.highestClassificationImpact = impact * 100; // Store as percentage
        }
      }
    });
    
    // Calculate adjusted scores based on classification impacts
    let totalRawScore = 0;
    let totalMaxScore = 0;
    let totalAdjustedScore = 0;
    
    if (scoringMechanism === 'award') {
      Object.values(sectionScores).forEach(section => {
        if (section.maxScore === 0) return; // Skip empty sections
        
        // Apply classification impact to calculate adjusted score
        const impact = section.highestClassification ? 
          (classificationImpacts[section.highestClassification] || 0) : 0;
          
        // Calculate deduction
        const deduction = section.rawScore * impact;
        section.adjustedScore = Math.max(0, section.rawScore - deduction);
        
        console.log(`Section ${section.name}: ${section.highestClassification || 'none'} classification (${impact * 100}% impact)`);
        console.log(`  Raw score: ${section.rawScore}, Deduction: ${deduction}, Adjusted: ${section.adjustedScore}`);
        
        // Calculate percentage
        section.percentage = Math.round((section.adjustedScore / section.maxScore) * 100);
        
        // Add to overall totals
        totalRawScore += section.rawScore;
        totalMaxScore += section.maxScore;
        totalAdjustedScore += section.adjustedScore;
      });
    } else if (scoringMechanism === 'deduct') {
      // Negative marking - start with total and deduct
      const sectionsCount = Object.keys(sectionScores).length;
      const sectionBaseScore = formTotalScore / sectionsCount; // Distribute total score evenly
      
      Object.values(sectionScores).forEach(section => {
        // Start with section's portion of total score
        section.maxScore = sectionBaseScore;
        section.rawScore = Math.max(0, sectionBaseScore - section.deductions);
        
        // Apply classification impact on the remaining score
        const impact = section.highestClassification ?
          (classificationImpacts[section.highestClassification] || 0) : 0;
        
        const additionalDeduction = section.rawScore * impact;
        section.adjustedScore = Math.max(0, section.rawScore - additionalDeduction);
        
        console.log(`Section ${section.name} (Deduct mode):`);
        console.log(`  Base score: ${sectionBaseScore}, Deductions: ${section.deductions}`);
        console.log(`  Raw score: ${section.rawScore}, Classification impact: ${additionalDeduction}`);
        console.log(`  Adjusted score: ${section.adjustedScore}`);
        
        section.percentage = Math.round((section.adjustedScore / section.maxScore) * 100);
        
        totalMaxScore = formTotalScore;
      });
      
      // For deduct mode, calculate totals differently
      totalRawScore = Math.max(0, formTotalScore - totalDeductions);
      
      // Apply overall classification impact
      let overallHighestImpact = 0;
      Object.values(sectionScores).forEach(section => {
        if (section.highestClassification) {
          const impact = classificationImpacts[section.highestClassification] || 0;
          overallHighestImpact = Math.max(overallHighestImpact, impact);
        }
      });
      
      const overallClassificationDeduction = totalRawScore * overallHighestImpact;
      totalAdjustedScore = Math.max(0, totalRawScore - overallClassificationDeduction);
    }
      
    // Overall score calculations
    const overallPercentage = totalMaxScore > 0 ? 
      Math.round((totalAdjustedScore / totalMaxScore) * 100) : 0;
    
    console.log('Overall scores:');
    console.log(`  Mechanism: ${scoringMechanism}`);
    console.log(`  Raw score: ${totalRawScore}, Adjusted: ${totalAdjustedScore}, Max: ${totalMaxScore}`);
    console.log(`  Percentage: ${overallPercentage}%`);
    
    return {
      sections: sectionScores,
      overall: {
        rawScore: totalRawScore,
        adjustedScore: totalAdjustedScore,
        maxScore: totalMaxScore,
        percentage: overallPercentage,
        scoringMechanism: scoringMechanism,
        totalDeductions: scoringMechanism === 'deduct' ? totalDeductions : undefined
      }
    };
  } catch (error) {
    console.error('Error calculating evaluation scores:', error);
    throw error;
  }
};

/**
 * Calculate impact of classification on a parameter's score
 * @param {number} score - Original score value
 * @param {number} maxScore - Maximum possible score
 * @param {string} classification - Classification type (minor, moderate, major)
 * @param {Object} impactMap - Map of classification types to impact percentages
 * @returns {number} Adjusted score after applying classification impact
 */
const calculateClassificationImpact = (score, maxScore, classification, impactMap = null) => {
  // Default impact percentages if not provided
  const impacts = impactMap || {
    minor: 0.1,     // 10%
    moderate: 0.25, // 25%
    major: 0.5      // 50%
  };
  
  // No impact for undefined classification or 'none'
  if (!classification || classification === 'none') {
    return score;
  }
  
  // Get impact percentage
  const impact = impacts[classification] || 0;
  
  // Calculate deduction based on score (not max score)
  const deduction = score * impact;
  
  // Return adjusted score (never below 0)
  return Math.max(0, score - deduction);
};

module.exports = {
  calculateEvaluationScores,
  calculateClassificationImpact
};