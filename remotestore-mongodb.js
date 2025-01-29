const update = require('./update');
const nodemailer = require('nodemailer');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODBNEW_URI;

const app = express();
const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on the port ${port}`);
});

async function initializeWhatsAppClient() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    sendNotification(`WhatsApp connection was lost. Reason`);

    // Initialize MongoDB store
    const store = new MongoStore({ mongoose: mongoose });
    //console.log(store);

    const client = new Client({
      authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000, // Backup every 5 minutes
        dataPath: './session',
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      },
      restartOnAuthFail: true,
    });

    client.on('remote_session_saved', () => {
      console.log('Session data saved remotely');
    });

    // Remove the separate session checking function
    let sessionRestored = false;

    client.on('qr', (qr) => {
      // Only generate QR if no existing session was found
      //sendEmail();
      if (!sessionRestored) {
        console.log('Generating QR code');
        qrcode.generate(qr, { small: true });
        console.log('Please scan the QR code to connect');
      }
    });

    client.on('authenticated', (msg) => {
      console.log('Authenticated', msg);
      sessionRestored = true;
    });

    client.on('auth_failure', (msg) => {
      console.error('AUTHENTICATION FAILURE', msg);
      sessionRestored = false;
    });

    client.on('disconnected', (reason) => {
      console.log('Client was logged out', reason);
      client.destroy();
      initializeWhatsAppClient(); // Reinitialize the client
    });

    client.on('ready', () => {
      console.log('Client is ready!');
      if (sessionRestored) {
        console.log('Restored existing session successfully');
      }
    });

    client.on('message', async (msg) => {
      console.log(msg);
    });

    // Initialize the client
    client.initialize();

    // Rest of your existing code remains the same...

    return client;
  } catch (error) {
    console.error('Initialization error:', error);
    throw error;
  }
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'tech@thepack.in',
    pass: 'ThisIsATechAccount!@#',
  },
});

function sendNotification(message) {
  const mailOptions = {
    from: 'tech@thepack.in',
    to: 'tech@thepack.in',
    subject: 'WhatsApp Connection Disruption',
    text: message,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

// async function getWhatsAppSession(id) {
//   const client = new Client({
//     authStrategy: new RemoteAuth({
//       clientId: id,
//       store: store,
//     }),
//     puppeteer: {
//       headless: true,
//       args: [
//         '--no-sandbox',
//         '--disable-gpu',
//         '--disable-setuid-sandbox',
//         '--disable-dev-shm-usage',
//       ],
//     },
//     restartOnAuthFail: true,
//   });

//   client.on('ready', () => {
//     console.log('Client session restored!');
//   });

//   client.on('qr', (qr) => {
//     console.log('Generating QR code');
//     qrcode.generate(qr, { small: true });
//     console.log('Please scan the QR code to connect');
//   });

//   client.initialize();
// }

// Start the client

async function sendBubbleApiRequest(payload) {
  try {
    const response = await axios.post(process.env.BUBBLE_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${process.env.BUBBLE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Bubble API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
}

// Example with specific payload
async function sendEmail(emailData) {
  try {
    const result = await sendBubbleApiRequest(emailData);
    console.log('Email sent via Bubble API:', result);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

// Usage example
sendEmail({
  email: 'tech@thepack.in,shobhit@thepack.in',
});

initializeWhatsAppClient().catch(console.error);
