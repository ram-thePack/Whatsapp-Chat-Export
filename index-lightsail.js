const update = require('./update');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 3000;

const safeWords = ['fuck', 'poop', 'asshole'];
const NOTIFICATION_NUMBER = '911234567890@c.us';

app.listen(port, () => {
  console.log(`Server listening on the port ${port}`);
});

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'YOUR_CLIENT_ID',
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  },
});

client.on('qr', (qr) => {
  console.log('Generating QR code');
  qrcode.generate(qr, { small: true });
});

console.log('After QR');

client.on('authenticated', (msg) => {
  console.log('Authenticated', msg);
});

client.on('auth_failure', (msg) => {
  console.error('AUTHENTICATION FAILURE', msg);
});

client.on('disconnected', (reason) => {
  sendEmail({
    email: 'tech@thepack.in,shobhit@thepack.in',
  });
  console.log('Client was logged out', reason);
});

client.on('ready', () => {
  console.log('Client is ready!');
});

process.on('uncaughtException', (error, origin) => {
  sendEmail({
    email: 'tech@thepack.in,shobhit@thepack.in',
  });
  console.log('----- Uncaught exception -----');
  console.log(error);
  console.log('----- Exception origin -----');
  console.log(origin);
});

process.on('unhandledRejection', (reason, promise) => {
  sendEmail({
    email: 'tech@thepack.in,shobhit@thepack.in',
  });
  console.log('----- Unhandled Rejection at -----');
  console.log(promise);
  console.log('----- Reason -----');
  console.log(reason);
});

client.initialize();

const groupNames = new Map();

// Function to fetch group name
const getGroupName = async (groupId) => {
  if (groupNames.has(groupId)) {
    return groupNames.get(groupId);
  } else {
    // Fetch the group name from WhatsApp Web
    const chat1 = await client.getChatById(groupId);
    const groupName = chat1 ? chat1.name : 'Unknown Group';
    groupNames.set(groupId, groupName);
    return groupName;
  }
};

client.on('group_join', async (notification) => {
  // User has joined or been added to the group.
  const groupName = await getGroupName(notification.chatId);
  //console.log(groupName);
  if (groupName.toLowerCase().includes('pack')) {
    const data = {
      GroupName: groupName,
      Phone: notification.id.participant.substring(0, 12),
      Type: 'Joined',
      Date: new Date(),
    };

    update.insertData('GroupStats', data, (err, results) => {
      if (err) {
        console.error('Error inserting data:', err);
        return;
      }
      console.log('Data inserted successfully:', results);
    });
  }
});

client.on('group_leave', async (notification) => {
  // User has left or been kicked from the group.
  const groupName = await getGroupName(notification.chatId);
  if (groupName.toLowerCase().includes('pack')) {
    const data = {
      GroupName: groupName,
      Phone: notification.id.participant.substring(0, 12),
      Type: 'Left',
      Date: new Date(),
    };

    update.insertData('GroupStats', data, (err, results) => {
      if (err) {
        console.error('Error inserting data:', err);
        return;
      }
      console.log('Data inserted successfully:', results);
    });
    //console.log('User left group:', groupName);
  }
});

client.on('message', async (msg) => {
  const contact_name = (await msg.getContact()).pushname;
  const contact_info = [];

  let chat = await msg.getChat();
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const messageLowerCase = msg.body.toLowerCase();

  // Check if message contains any safe words
  const containsSafeWord = safeWords.some((word) =>
    //msg.body.toLowerCase().includes(word.toLowerCase()),
    messageLowerCase.includes(word.toLowerCase()),
  );

  if (containsSafeWord) {
    // Format notification message
    const notificationMsg =
      `⚠️ Alert: Safe word detected!\n\n` +
      `From: ${contact_name}\n` +
      `Phone: ${msg.author.substring(0, msg.author.length - 5)} \n` +
      `Group: ${chat.name}\n` +
      `Message: ${msg.body}`;

    try {
      // Send notification to the specified number
      await client.sendMessage(NOTIFICATION_NUMBER, notificationMsg);
      console.log('Alert notification sent successfully');
      // console.log(NOTIFICATION_NUMBER);
      // console.log(notificationMsg);
    } catch (error) {
      console.error('Error sending alert notification:', error);
    }
  }
});

//Send alert email
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

async function sendEmail(emailData) {
  try {
    const result = await sendBubbleApiRequest(emailData);
    console.log('Email sent via Bubble API:', result);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}
