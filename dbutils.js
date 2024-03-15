const mysql = require('mysql');
require('dotenv').config(); // Load environment variables from .env file

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Adjust according to your requirements
  queueLimit: 0, // Unlimited queueing
});

module.exports.pool = pool;
