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
    const newForm = new QAForm({
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    await newForm.save();
    res.status(201).json(newForm);
  } catch (error) {
    console.error('Error creating QA form:', error);
    res.status(500).json({ message: 'Error creating QA form' });
  }
});

// Update QA Form
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updatedForm = await QAForm.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
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
    res.status(500).json({ message: 'Error updating QA form' });
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