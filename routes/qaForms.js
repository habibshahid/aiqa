// routes/qaForms.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { QAForm } = require('../config/mongodb');

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

module.exports = router;