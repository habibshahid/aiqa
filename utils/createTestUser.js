// scripts/createTestUser.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function createAndVerifyTestUser() {
  // Create the connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'contact_center'
  });

  try {
    // User details
    const testUser = {
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User'
    };

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(testUser.password, salt);

    // First, delete existing user if any
    const deleteQuery = `DELETE FROM users WHERE username = '${testUser.username}'`;
    await connection.execute(deleteQuery);
    console.log('Cleaned up existing user if any');

    // Insert new user
    const insertQuery = `
      INSERT INTO users (username, email, password, first_name, last_name, is_active) 
      VALUES ('${testUser.username}', '${testUser.email}', '${hashedPassword}', 
              '${testUser.firstName}', '${testUser.lastName}', true)
    `;
    await connection.execute(insertQuery);
    console.log('Inserted new user');

    // Verify the user was created
    const [users] = await connection.execute(
      `SELECT id, username, email, is_active FROM users WHERE username = '${testUser.username}'`
    );

    if (users.length === 0) {
      throw new Error('User not found after creation!');
    }

    // Test password
    const [userWithPassword] = await connection.execute(
      `SELECT password FROM users WHERE username = '${testUser.username}'`
    );
    
    const isValid = await bcrypt.compare(testUser.password, userWithPassword[0].password);

    console.log('User created successfully:', {
      userId: users[0].id,
      username: users[0].username,
      email: users[0].email,
      isActive: users[0].is_active,
      passwordValid: isValid
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

// Run the function
createAndVerifyTestUser();