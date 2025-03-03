// routes/criteriaProfiles.js
const express = require('express');
const router = express.Router();
const { CriteriaProfile } = require('../config/mongodb');
const { authenticateToken } = require('../middleware/auth');

// Get all profiles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const profiles = await CriteriaProfile.find({})
      .sort({ createdAt: -1 });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profiles' });
  }
});

// Get single profile
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const profile = await CriteriaProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// Create profile
router.post('/', authenticateToken, async (req, res) => {
  try {
    const newProfile = new CriteriaProfile({
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    await newProfile.save();
    res.status(201).json(newProfile);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error creating profile' });
  }
});

// Update profile
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updatedProfile = await CriteriaProfile.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user.id
      },
      { new: true }
    );
    if (!updatedProfile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(updatedProfile);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Delete profile
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const profile = await CriteriaProfile.findByIdAndDelete(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting profile' });
  }
});

module.exports = router;