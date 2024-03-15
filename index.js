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
    args: ['--no-sandbox','--disable-gpu'],
  },
  authStrategy: new LocalAuth({
    clientId: 'YOUR_CLIENT_ID',
  }),
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('AUTHENTICATED');
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.on('message', async (msg) => {
  let chat = await msg.getChat();
  if (chat.isGroup && chat.name.toLowerCase().includes("pack")) {
    const date = new Date(msg.timestamp * 1000).toLocaleString();
    console.log(chat.name);
    console.log(msg.author.substring(0, msg.author.length - 5));
    console.log(date);
    console.log(msg.body);
  }
});

client.initialize();
