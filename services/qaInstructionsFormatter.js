// services/qaInstructionsFormatter.js
// Extracted from qaProcessor.js to be reusable

/**
 * Format QA form parameters into instructions for AI evaluation
 * @param {Object} form - QA form data
 * @returns {string} Formatted instructions for AI evaluation
 */
function formatInstructions(form) {
  let instructions = `You are a quality analyst evaluating a ${form.interactionType || 'call center'} interaction.`;

  instructions += 'Based on the following evaluation criteria, please assess the interaction and provide scores:\n\n';

  // Add each parameter with its context
  form.parameters.forEach((param, index) => {
    instructions += `${index + 1}. ${param.label}:\n`;
    instructions += `   Context: ${param.evaluationContext}\n`;
    instructions += `   Max Score: ${param.maxScore}\n`;
    instructions += `   Scoring Type: ${param.scoringType}\n`;
    
    if (param.classification) {
      instructions += `   Classification: ${param.classification}\n`;
    }
    
    instructions += '\n';
  });

  // Add specific instructions for the evaluation response format
  instructions += '\nPlease analyze the interaction and provide:\n';
  instructions += '- A score for each criterion (0 to max score)\n';
  instructions += '- A detailed explanation for each score\n';
  instructions += '- An overall summary of the interaction\n';
  instructions += '- Areas where the agent performed well\n';
  instructions += '- Areas where the agent could improve\n';
  instructions += '- Customer and agent sentiment throughout the interaction\n';

  // Add instructions for text-based interactions
  if (form.interactionType === 'text_conversation') {
    instructions += '\nNote: This is a text-based conversation. Please consider:\n';
    instructions += '- Response time and efficiency\n';
    instructions += '- Clarity and helpfulness of written communication\n';
    instructions += '- Professional tone and language\n';
    instructions += '- Resolution of customer queries through text\n';
  }

  // Add silence period instructions (mainly for calls)
  if (form.interactionType !== 'text_conversation') {
    instructions += 'silencePeriods: identify any periods of silence longer than 3 seconds with their timestamps and duration. It should be in an array with objects containing fromTimeStamp, toTimeStamp, and silenceDuration';
  }

  instructions += 'areasOfImprovements: find the things the agent could have done better. It should be in an array';
  instructions += 'whatTheAgentDidWell: find the areas where the agent did well in the interaction. It should be in an array';
  instructions += 'Please provide your evaluation with a score for each question, along with an explanation of your reasoning. Also include an overall assessment of the interaction.';
  
  // Additional instructions for handling question classifications
  instructions += '\nassign a classification tag to the question response. The classification tags are none, minor, moderate, major. If the instructions have none then do not apply any classification';
  instructions += '\nwhen returning the response do not include the text Question in parameter name, just the label name';
  
  // Add sample response format if available
  if (process.env.AIQA_SAMPLE_RESPONSE) {
    instructions += process.env.AIQA_SAMPLE_RESPONSE;
  }
  
  console.log('Formatted Instructions:', instructions);
  return instructions;
}

module.exports = {
  formatInstructions
};