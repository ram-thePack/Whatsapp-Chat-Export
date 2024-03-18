const update = require('./update');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on the port ${port}`);
});

const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  },
  authStrategy: new LocalAuth({
    clientId: 'YOUR_CLIENT_ID',
  }),
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('Authenticated');
});

client.on('ready', () => {
  console.log('Client is ready!');
});

const groupNames = new Map();

// Function to fetch group name
const getGroupName = async (groupId) => {
  if (groupNames.has(groupId)) {
    return groupNames.get(groupId);
  } else {
    // Fetch the group name from WhatsApp Web
    //console.log('inside else', groupId);
    const chat1 = await client.getChatById(groupId);
    //console.log(chat1.name);
    const groupName = chat1 ? chat1.name : 'Unknown Group';
    groupNames.set(groupId, groupName);
    return groupName;
  }
};

client.on('group_join', async (notification) => {
  // User has joined or been added to the group.
  const groupName = await getGroupName(notification.chatId);
  if (groupName.toLowerCase().includes('pack')) {
    // console.log(
    //   'User joined group:',
    //   groupName,
    //   ' Phone: ',
    //   notification.id.participant.substring(0, 12),
    // );

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
  //console.log('LEAVE', notification);
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

      contact_info.push(name + ' ' + phoneNumber);
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
      Links: matches.length > 0 ? matches : null,
      V4CardInfo: contact_info.length > 0 ? contact_info : null,
    };

    update.insertData('WhatsAppExport', data, (err, results) => {
      if (err) {
        console.error('Error inserting data:', err);
        return;
      }
      console.log('Data inserted successfully:', results);
    });
  }
});

client.initialize();
