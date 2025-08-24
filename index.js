const update = require('./update');
const bptest = require('./bptest');
const analyzeMsg = require('./utils/analyzeMessage');
const bubAPIs = require('./utils/bubbleAPIs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 3000;

const safeWords = [
  'fuck',
  'asshole',
  'murder',
  'killer',
  'fundraising',
  'funding',
  'funds',
  'mating',
  'breeding',
];

const messageQueue = [];
const BATCH_INTERVAL = 15000; // 15 seconds

const formattedDate = (() => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return d.toISOString().replace(
    'Z',
    `${offset <= 0 ? '+' : '-'}${Math.floor(Math.abs(offset) / 60)
      .toString()
      .padStart(2, '0')}:${(Math.abs(offset) % 60)
      .toString()
      .padStart(2, '0')}`,
  );
})();

const formattedDateSt = new Date().toISOString().split('T')[0];
const formattedDateEd = new Date().toISOString().slice(0, 19).replace('T', ' ');

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

setInterval(() => {
  if (messageQueue.length > 0) {
    const batch = messageQueue.splice(0, messageQueue.length);
    update.insertBatchData('WhatsAppExport', batch);
  }
}, BATCH_INTERVAL);

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
  bubAPIs.sendEmail({
    email: 'tech@thepack.in,shobhit@thepack.in',
  });
  console.log('Client was logged out', reason);
});

client.on('change_state', (reason) => {
  console.log('Client state was changed: ', reason);
});

process.on('uncaughtException', (error, origin) => {
  bubAPIs.sendEmail({
    email: 'tech@thepack.in,shobhit@thepack.in',
  });
  console.log('----- Uncaught exception -----');
  console.log(error);
  console.log('----- Exception origin -----');
  console.log(origin);
});

process.on('unhandledRejection', (reason, promise) => {
  bubAPIs.sendEmail({
    email: 'tech@thepack.in,shobhit@thepack.in',
  });
  console.log('----- Unhandled Rejection at -----');
  console.log(promise);
  console.log('----- Reason -----');
  console.log(reason);
});

client.on('ready', () => {
  console.log('Client is ready!');
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
  }
});

client.on('message', async (msg) => {
  const contact_name = (await msg.getContact()).pushname;
  const contact_info = [];

  let chat = await msg.getChat();

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  //Get Links sent from user
  let matches = [];
  let url;
  while ((url = urlRegex.exec(msg.body)) !== null) {
    matches.push(url[0]);
  }

  //Quert to KAi
  if (
    chat.name.toLowerCase() == 'testing pack' ||
    chat.name.toLowerCase() == 'community moderation' ||
    chat.name.toLowerCase() == 'thepack.in alpha'
  ) {
    if (msg.body.toLowerCase().includes('@askkai')) {
      console.log('Query to KAi received, Query= ' + msg.body);
      const isNutrition = false;
      const ingredients = '';
      let userChat = '';

      (async () => {
        const message = msg.body;

        // 1. Analyze the message
        const { isNutrition, ingredients } = await analyzeMsg.analyzeMessage(
          message,
        );
        console.log('Is Nutrition Question:', isNutrition);
        console.log('Ingredients:', ingredients);

        // 2. If valid, query Botpress
        if (isNutrition && ingredients) {
          const repMsg = await bptest.fetchBotpressData(ingredients);

          // 3. Reply only if data found
          if (repMsg && repMsg !== '') {
            userChat = 'User: ' + message + '\nBot: ' + repMsg;
            msg.reply(
              `${repMsg}\n\nTo know more, chat with KAi https://wa.me/917760400141/?text=Hi%20Kai`,
            );
            const data = {
              UserName: contact_name,
              Phone: msg?.author
                ? msg.author.substring(0, msg.author.length - 5)
                : '',
              Messages: userChat,
              Source: 'WAGS',
              StartTime: formattedDate,
              EndTime: formattedDate,
              StartDate: formattedDateSt,
              NewStartDate: formattedDateEd,
            };

            update.insertData('KaiChatLogs', data, (err, results) => {
              if (err) {
                console.error('Error inserting data:', err);
                return;
              }
              console.log('Data inserted successfully:', results);
            });
          } else {
            userChat = 'User: ' + message;
            const data = {
              UserName: contact_name,
              Phone: msg?.author
                ? msg.author.substring(0, msg.author.length - 5)
                : '',
              Messages: userChat,
              FailedQuestions: ingredients,
              Source: 'WAGS',
            };

            update.insertData('KaiChatLogs', data, (err, results) => {
              if (err) {
                console.error('Error inserting data:', err);
                return;
              }
              console.log('Data inserted successfully:', results);
            });
          }
        }
      })();
    }
  }

  const messageLowerCase = msg.body.toLowerCase();

  // Check if message contains any safe words
  const containsSafeWord = safeWords.find((word) =>
    messageLowerCase.includes(word.toLowerCase()),
  );

  if (
    containsSafeWord !== undefined &&
    chat.name.toLowerCase().includes('pack')
  ) {
    bubAPIs.sendAlert({
      keyword: containsSafeWord,
      message: messageLowerCase,
      from: msg?.author ? msg.author.substring(0, msg.author.length - 5) : '',
      group: `${chat.name}`,
      time: new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }),
    });
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
      Phone: msg?.author ? msg.author.substring(0, msg.author.length - 5) : '',
      Message: msg.body,
      CreatedDate: new Date(),
      UserName: contact_name,
      Links: matches.length > 0 ? matches.join(',') : null,
      V4CardInfo: contact_info.length > 0 ? contact_info.join() : null,
    };

    if (msg.body.length >= 0 || matches.length > 0 || contact_info.length > 0) {
      // Commented instant push to DB logic
      // update.insertData('WhatsAppExport', data, (err, results) => {
      //   if (err) {
      //     console.error('Error inserting data:', err);
      //     return;
      //   }
      //   console.log('Data inserted successfully:', results);
      // });
      messageQueue.push(data);
    }
  }
});

app.get('/get-groups', async (req, res) => {
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
