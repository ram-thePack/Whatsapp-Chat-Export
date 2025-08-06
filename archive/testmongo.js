const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODBNEW_URI; // Replace with your actual connection string

async function testMongoDBConnection() {
  try {
    // Connect to MongoDB
    console.log(process.env.MONGODBNEW_URI);
    await mongoose.connect(process.env.MONGODBNEW_URI);

    console.log('Successfully connected to MongoDB!');

    // Optional: Check connection state
    console.log('Connection State:', mongoose.connection.readyState);
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

    // Optional: Get server information
    const admin = mongoose.connection.db.admin();
    const serverInfo = await admin.serverStatus();
    console.log('Server Version:', serverInfo.version);

    // Close the connection
    await mongoose.connection.close();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);

    // Detailed error diagnosis
    if (error.name === 'MongoError') {
      console.error('Specific MongoDB Error:', error.code);
    }
  }
}

testMongoDBConnection();
