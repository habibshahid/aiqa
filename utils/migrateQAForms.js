// scripts/migrateQAForms.js
require('dotenv').config();
const mongoose = require('mongoose');
const { QAForm } = require('../config/mongodb');

/**
 * Migrates existing QA forms to include groups and classifications
 */
async function migrateQAForms() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected');

    // Get all QA forms
    const forms = await QAForm.find({});
    console.log(`Found ${forms.length} QA forms to migrate`);

    // Migrate each form
    for (const form of forms) {
      // Check if the form already has groups
      if (!form.groups || form.groups.length === 0) {
        // Create a default group
        form.groups = [{ id: 'default', name: 'Default Group' }];
        
        // Assign all parameters to the default group and add classification
        if (form.parameters && form.parameters.length > 0) {
          form.parameters = form.parameters.map(param => ({
            ...param,
            group: 'default',
            classification: 'minor' // Default classification
          }));
        }
        
        // Save the updated form
        await form.save();
        console.log(`Migrated form: ${form.name}`);
      } else {
        console.log(`Form already has groups: ${form.name}`);
      }
      
      // Ensure all parameters have a classification
      let needsUpdate = false;
      
      if (form.parameters && form.parameters.length > 0) {
        form.parameters.forEach(param => {
          if (!param.classification) {
            param.classification = 'minor';
            needsUpdate = true;
          }
        });
        
        if (needsUpdate) {
          await form.save();
          console.log(`Added classifications to form: ${form.name}`);
        }
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the migration
migrateQAForms();