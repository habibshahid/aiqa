// scripts/fixGroupsPermissions.js
require('dotenv').config();
const db = require('../config/database');

async function fixGroupsPermissions() {
  try {
    // Define default permissions for each group
    const groups = [
      {
        name: 'Admin',
        description: 'Full system access',
        permissions: JSON.stringify({
          dashboard: { read: true, write: true },
          contacts: { read: true, write: true },
          settings: { read: true, write: true },
          users: { read: true, write: true }
        })
      },
      {
        name: 'Agent',
        description: 'Standard agent access',
        permissions: JSON.stringify({
          dashboard: { read: true },
          contacts: { read: true, write: true }
        })
      }
    ];

    // Update or insert each group
    for (const group of groups) {
      await db.query(`
        INSERT INTO groups (name, description, permissions) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        description = VALUES(description),
        permissions = VALUES(permissions)
      `, [group.name, group.description, group.permissions]);

      console.log(`Updated permissions for group: ${group.name}`);
    }

    // Verify permissions are properly stored
    const [updatedGroups] = await db.query('SELECT * FROM groups');
    console.log('\nVerifying group permissions:');
    updatedGroups.forEach(group => {
      console.log(`\nGroup: ${group.name}`);
      console.log('Permissions:', group.permissions);
      try {
        const parsed = JSON.parse(group.permissions);
        console.log('Parsed successfully:', parsed);
      } catch (e) {
        console.error('Parse error for group:', group.name, e);
      }
    });

    console.log('\nGroups permissions updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error updating groups:', error);
    process.exit(1);
  }
}

fixGroupsPermissions();