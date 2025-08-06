const update = require('./update');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const safeWords = ['fuck', 'poop'];
const NOTIFICATION_NUMBER = '918050798672';

const app = express();
const port = 3000;

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

client.on('message', async (msg) => {
  const contact_name = (await msg.getContact()).pushname;
  const contact_info = [];

  let chat = await msg.getChat();
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const messageLowerCase = msg.body.toLowerCase();

  // Check if message contains any safe words
  const containsSafeWord = safeWords.some((word) =>
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
      await client.sendMessage(`${NOTIFICATION_NUMBER}@c.us`, notificationMsg);
      console.log('Alert notification sent successfully');
    } catch (error) {
      console.error('Error sending alert notification:', error);
    }
  }

  //Get Links sent from user
  let matches = [];
  let url;
  while ((url = urlRegex.exec(msg.body)) !== null) {
    matches.push(url[0]);
  }

  // Get Contact Info sent from user
  if (msg.type === 'vcard' || msg.type === 'multi_vcard') {
    const vcards = msg.vCards;
    vcards.forEach((vcard) => {
      // Extract name from vCard
      const nameMatch = vcard.match(/FN:(.*)\n/);
      const name = nameMatch ? nameMatch[1] : '';

      // Extract phone number from vCard
      const phoneMatch = vcard.match(/TEL;.*:(.*)/);
      const phoneNumber = phoneMatch ? phoneMatch[1] : '';

      contact_info.push(
        name.replace(/['"]/g, '') + ' ' + phoneNumber.replace(/['"]/g, ''),
      );
    });
  }

  if (chat.isGroup && chat.name.toLowerCase().includes('pack')) {
    const localDate = new Date(msg.timestamp * 1000);
    const offset = localDate.getTimezoneOffset() * 60000;
    const localDateTime = new Date(localDate.getTime() - offset);
    const formattedDate = localDateTime
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    const data = {
      GroupName: chat.name,
      Phone: msg.author.substring(0, msg.author.length - 5),
      Message: msg.body,
      CreatedDate: new Date(),
      UserName: contact_name,
      Links: matches.length > 0 ? matches.join(',') : null,
      V4CardInfo: contact_info.length > 0 ? contact_info.join() : null,
    };

    console.log(data);
  }
});

//client.initialize();

app.get('/get-groups', async (req, res) => {
  //console.log('inside get-groups');
  try {
    const chats = await client.getChats();
    const groups = chats.filter((chat) => chat.isGroup);
    if (groups.length === 0) {
      res.status(404).send('No groups found.');
    } else {
      const groupList = groups
        .filter((group) => group.name.toLowerCase().includes('pack'))
        .map((group) => ({
          id: group.id._serialized,
          name: group.name,
        }));

      //   const groupList = groups.map((group) => ({
      //     id: group.id._serialized,
      //     name: group.name,
      //   }));
      res.json(groupList);
    }
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).send('An error occurred while fetching groups.');
  }
});

// Endpoint to add a user to a specific group
app.post('/add-to-group', express.json(), async (req, res) => {
  const { groupId, phoneNumber } = req.body;

  if (!groupId || !phoneNumber) {
    return res.status(400).send('groupId and phoneNumber are required.');
  }

  try {
    const chat = await client.getChatById(groupId);
    await chat.addParticipants([`${phoneNumber}@c.us`]);
    res.send(`User ${phoneNumber} added to group ${chat.name}.`);
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).send(`Failed to add participant: ${error.message}`);
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
