// routes/qaForms.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { QAForm } = require('../config/mongodb');
const axios = require('axios');

// Get all QA Forms
router.get('/', authenticateToken, async (req, res) => {
  try {
    const forms = await QAForm.find({ isActive: true })
      .sort({ name: 1 });
    res.json(forms);
  } catch (error) {
    console.error('Error fetching QA forms:', error);
    res.status(500).json({ message: 'Error fetching QA forms' });
  }
});

// Get single QA Form
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const form = await QAForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }
    res.json(form);
  } catch (error) {
    console.error('Error fetching QA form:', error);
    res.status(500).json({ message: 'Error fetching QA form' });
  }
});

// Create QA Form
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Extract form data including classifications
    const { 
      name, 
      description, 
      isActive, 
      parameters, 
      groups, 
      classifications,
      moderationRequired
    } = req.body;
    
    // Ensure we have at least one parameter
    if (!parameters || parameters.length === 0) {
      return res.status(400).json({ message: 'At least one parameter is required' });
    }
    
    // Ensure we have at least one group
    if (!groups || groups.length === 0) {
      return res.status(400).json({ message: 'At least one group is required' });
    }
    
    // Validate classifications
    const requiredClassificationTypes = ['minor', 'moderate', 'major'];
    if (classifications) {
      // Make sure all required types are present
      const hasAllTypes = requiredClassificationTypes.every(type => 
        classifications.some(c => c.type === type)
      );
      
      if (!hasAllTypes) {
        return res.status(400).json({ 
          message: 'All classification types (minor, moderate, major) must be provided'
        });
      }
      
      // Validate percentage ranges
      const validPercentages = classifications.every(c => 
        c.impactPercentage >= 0 && c.impactPercentage <= 100
      );
      
      if (!validPercentages) {
        return res.status(400).json({
          message: 'Classification impact percentages must be between 0 and 100'
        });
      }
    }
    
    // Create new QA form with all provided data
    const newForm = new QAForm({
      name,
      description,
      isActive,
      parameters,
      groups,
      classifications: classifications || undefined, // Use default if not provided
      moderationRequired: moderationRequired !== undefined ? moderationRequired : true,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    await newForm.save();
    res.status(201).json(newForm);
  } catch (error) {
    console.error('Error creating QA form:', error);
    res.status(500).json({ message: 'Error creating QA form', error: error.message });
  }
});

// Update QA Form
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Extract form data including classifications
    const { 
      name, 
      description, 
      isActive, 
      parameters, 
      groups, 
      classifications,
      moderationRequired
    } = req.body;
    
    // Ensure we have at least one parameter
    if (!parameters || parameters.length === 0) {
      return res.status(400).json({ message: 'At least one parameter is required' });
    }
    
    // Ensure we have at least one group
    if (!groups || groups.length === 0) {
      return res.status(400).json({ message: 'At least one group is required' });
    }
    
    // Validate classifications
    const requiredClassificationTypes = ['minor', 'moderate', 'major'];
    if (classifications) {
      // Make sure all required types are present
      const hasAllTypes = requiredClassificationTypes.every(type => 
        classifications.some(c => c.type === type)
      );
      
      if (!hasAllTypes) {
        return res.status(400).json({ 
          message: 'All classification types (minor, moderate, major) must be provided'
        });
      }
      
      // Validate percentage ranges
      const validPercentages = classifications.every(c => 
        c.impactPercentage >= 0 && c.impactPercentage <= 100
      );
      
      if (!validPercentages) {
        return res.status(400).json({
          message: 'Classification impact percentages must be between 0 and 100'
        });
      }
    }
    
    // Update the form with all provided data
    const updatedForm = await QAForm.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        isActive,
        parameters,
        groups,
        classifications: classifications || undefined,
        moderationRequired: moderationRequired !== undefined ? moderationRequired : true,
        updatedBy: req.user.id
      },
      { new: true }
    );
    
    if (!updatedForm) {
      return res.status(404).json({ message: 'Form not found' });
    }
    
    res.json(updatedForm);
  } catch (error) {
    console.error('Error updating QA form:', error);
    res.status(500).json({ message: 'Error updating QA form', error: error.message });
  }
});

// Delete QA Form
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const form = await QAForm.findByIdAndDelete(req.params.id);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Error deleting QA form:', error);
    res.status(500).json({ message: 'Error deleting QA form' });
  }
});

/**
 * Route to generate context for QA form parameters using AI
 */
router.post('/generate-context', authenticateToken, async (req, res) => {
  try {
    const { paramName, existingContext, scoringType, maxScore, classification } = req.body;
    
    // Validation
    if (!paramName) {
      return res.status(400).json({ message: 'Parameter name is required' });
    }
    
    // Get the AI context writer URL from environment variables
    const aiContextWriterUrl = process.env.AI_CONTEXT_WRITER;
    
    if (!aiContextWriterUrl) {
      return res.status(500).json({ message: 'AI context writer URL not configured' });
    }
    
    // Build the prompt for the AI
    const prompt = buildPrompt(paramName, existingContext, scoringType, maxScore, classification);
    
    // Make request to the AI service
    const response = await axios.post(aiContextWriterUrl, {
      prompt: prompt,
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Extract context from AI response
    const generatedContext = response.data.context.trim();
    
    if (!generatedContext) {
      return res.status(500).json({ message: 'Failed to generate context from AI response' });
    }
    
    res.json({ context: generatedContext });
  } catch (error) {
    console.error('Error generating context with AI:', error);
    res.status(500).json({ 
      message: 'Error generating context with AI', 
      error: error.message 
    });
  }
});

/**
 * Build a prompt for the AI based on parameter information
 */
function buildPrompt(paramName, existingContext, scoringType, maxScore, classification) {
  // Classification information
  const classificationInfo = {
    none: "No classification (no impact on scoring)",
    minor: "Minor issues (typically deducts 10% of score)",
    moderate: "Moderate issues (typically deducts 25% of score)",
    major: "Major issues (typically deducts 50% of score)"
  };
  
  // Scoring type explanation
  const scoringTypeInfo = scoringType === 'binary'
    ? `Binary scoring (either 0 or ${maxScore} points)`
    : `Variable scoring (0 to ${maxScore} points)`;
  
  // Build the prompt
  let prompt = `Write a detailed evaluation context for a QA form parameter with the following details:
  
- Parameter name: "${paramName}"
- Scoring type: ${scoringTypeInfo}
- Classification: ${classificationInfo[classification] || 'None'}

The context should clearly explain:
1. What the evaluator should look for when assessing this parameter
2. Specific criteria for different score levels
3. Examples of good and bad performance
4. How to handle edge cases

Write in a clear, professional tone suitable for a contact center QA form. Be specific and actionable.`;

  // If there's existing context, ask the AI to improve it
  if (existingContext) {
    prompt += `\n\nHere is the existing context that needs improvement:\n"${existingContext}"\n\nPlease rewrite and enhance this context to be more comprehensive, specific, and helpful for evaluators. Keep any valuable information from the original context but improve clarity, completeness, and actionable guidance.`;
  }
  
  return prompt;
}

router.post('/:id/clone', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;
    
    // Validate new name
    if (!newName || newName.trim() === '') {
      return res.status(400).json({ message: 'New form name is required' });
    }
    
    // Find the original form
    const originalForm = await QAForm.findById(id);
    if (!originalForm) {
      return res.status(404).json({ message: 'Form not found' });
    }
    
    // Create a clone by copying the data
    const clonedForm = new QAForm({
      name: newName,
      description: `Clone of ${originalForm.name}: ${originalForm.description}`,
      isActive: true,
      moderationRequired: originalForm.moderationRequired,
      parameters: originalForm.parameters,
      groups: originalForm.groups,
      classifications: originalForm.classifications,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    await clonedForm.save();
    res.status(201).json(clonedForm);
  } catch (error) {
    console.error('Error cloning QA form:', error);
    res.status(500).json({ message: 'Error cloning QA form', error: error.message });
  }
});

// Export QA Form
router.get('/:id/export', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the form
    const form = await QAForm.findById(id);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }
    
    // Format the form for export (remove MongoDB-specific fields)
    const exportedForm = {
      name: form.name,
      description: form.description,
      isActive: form.isActive,
      moderationRequired: form.moderationRequired,
      parameters: form.parameters,
      groups: form.groups,
      classifications: form.classifications
    };
    
    // Return the exported form
    res.json(exportedForm);
  } catch (error) {
    console.error('Error exporting QA form:', error);
    res.status(500).json({ message: 'Error exporting QA form', error: error.message });
  }
});

// Import QA Form
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const formData = req.body;
    
    // Validate form data
    if (!formData || !formData.name || !formData.parameters || !formData.groups) {
      return res.status(400).json({ message: 'Invalid form data. Required fields: name, parameters, groups' });
    }
    
    // Check if a form with this name already exists
    const existingForm = await QAForm.findOne({ name: formData.name });
    if (existingForm) {
      return res.status(409).json({ message: 'A form with this name already exists' });
    }
    
    // Create the new form
    const newForm = new QAForm({
      name: formData.name,
      description: formData.description || '',
      isActive: formData.isActive !== undefined ? formData.isActive : true,
      moderationRequired: formData.moderationRequired !== undefined ? formData.moderationRequired : true,
      parameters: formData.parameters,
      groups: formData.groups,
      classifications: formData.classifications || [
        { type: 'none', impactPercentage: 0, description: 'No impact' },
        { type: 'minor', impactPercentage: 10, description: 'Minor impact (10%)' },
        { type: 'moderate', impactPercentage: 25, description: 'Moderate impact (25%)' },
        { type: 'major', impactPercentage: 50, description: 'Major impact (50%)' }
      ],
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    await newForm.save();
    res.status(201).json(newForm);
  } catch (error) {
    console.error('Error importing QA form:', error);
    res.status(500).json({ message: 'Error importing QA form', error: error.message });
  }
});

module.exports = router;