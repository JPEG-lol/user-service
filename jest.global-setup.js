const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('\nRunning Jest Global Setup...');

  // Use the same test DB connection details
  const dbPool = new Pool({
    host: process.env.DB_HOST_TEST || 'localhost',
    port: parseInt(process.env.DB_PORT_TEST || '5432', 10),
    user: process.env.DB_USER_TEST || 'postgres',
    password: process.env.DB_PASSWORD_TEST || 'password',
    database: process.env.DB_NAME_TEST || 'users',
  });

  try {
    // Read the init.sql file
    const sql = fs.readFileSync(path.join(__dirname, 'db/init.sql'), 'utf8');
    // Execute the schema creation
    await dbPool.query(sql);
    console.log('Test database schema created successfully.');
  } catch (error) {
    console.error('Failed to create test database schema:', error);
    process.exit(1); // Exit if we can't set up the DB
  } finally {
    await dbPool.end();
  }
};