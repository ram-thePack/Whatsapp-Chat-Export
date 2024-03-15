const dbUtils = require('./dbutils');
const mysql = require('mysql');
require('dotenv').config();

// Export a function to insert data into the database
module.exports.insertData = function (newData, callback) {
  dbUtils.pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      return;
    }
    const sqlquery = 'INSERT INTO WhatsAppExport SET ?';
    console.log('Query = ', sqlquery);
    console.log('Data= ', newData);

    // Insert data into the table
    connection.query(
      'INSERT INTO WhatsAppExport SET ?',
      newData,
      (insertErr, results) => {
        // Release the connection back to the pool
        connection.release();

        if (insertErr) {
          console.error('Error inserting record:', insertErr);
          return;
        }
        console.log('Record inserted successfully:', results);
      },
    );
  });
};
