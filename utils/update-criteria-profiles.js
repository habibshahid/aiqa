const migration_addChannelsToCriteriaProfiles = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Update all existing criteria profiles to include empty channels array
    const result = await db.collection('criteriaprofiles').updateMany(
      { channels: { $exists: false } },
      { $set: { channels: [] } }
    );
    
    console.log(`Updated ${result.modifiedCount} criteria profiles with channels field`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
};