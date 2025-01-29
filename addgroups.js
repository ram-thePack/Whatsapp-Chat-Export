const update = require('./update');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const port = 3000;

//const MONGODB_URI = process.env.MONGODB_URI;

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
  console.log('Client was logged out', reason);
});

client.on('ready', async () => {
  console.log('Client is ready!');

  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);
  if (groups.length == 0) {
    console.log('You have no group yet.');
  } else {
    let groupsMsg = '*All active groups listed below:*\n\n';
    groups.forEach((group, i) => {
      groupsMsg += `ID: ${group.id._serialized}\nName: ${group.name}\n\n`;
    });
    console.log(groupsMsg);
  }

  // Example: Adding a participant to the first group in the list
  const groupToEdit = groups[1]; // Selecting the first group
  const participantId = '919632310910@c.us'; // Participant's phone number (include country code)

  try {
    await groupToEdit.addParticipants([participantId]);
    console.log(`Participant added to group: ${groupToEdit.name}`);
  } catch (error) {
    console.log(`Failed to add participant: ${error.message}`);
  }
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
  }
});

client.on('group_leave', async (notification) => {
  const groupName = await getGroupName(notification.chatId);
  if (groupName.toLowerCase().includes('pack')) {
    const data = {
      GroupName: groupName,
      Phone: notification.id.participant.substring(0, 12),
      Type: 'Left',
      Date: new Date(),
    };
  }
});

client.on('message', async (msg) => {
  const contact_name = (await msg.getContact()).pushname;
  const contact_info = [];

  let chat = await msg.getChat();
  // let msginfo = await msg.getInfo();
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

    // if (msg.body.length >= 0 || matches.length > 0 || contact_info.length > 0) {
    //   update.insertData('WhatsAppExport', data, (err, results) => {
    //     if (err) {
    //       console.error('Error inserting data:', err);
    //       return;
    //     }
    //     console.log('Data inserted successfully:', results);
    //   });
    // }
  }
});

app.get('/get-groups', async (req, res) => {
  console.log('inside get-groups');
  try {
    const chats = await client.getChats();
    const groups = chats.filter((chat) => chat.isGroup);
    if (groups.length === 0) {
      res.status(404).send('No groups found.');
    } else {
      const groupList = await Promise.all(
        groups
          .filter((group) => group.name.toLowerCase().includes('pack'))
          .map(async (group) => {
            const inviteCode = await group.getInviteCode();
            return {
              id: group.id._serialized,
              name: group.name,
              invite_code: 'https://chat.whatsapp.com/' + inviteCode,
            };
          }),
      );

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
