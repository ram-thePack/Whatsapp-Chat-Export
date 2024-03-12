// var http = require('http');

// //create a server object:
// http
//   .createServer(function (req, res) {
//     res.write('Hello World'); //write a response to the client
//     res.end(); //end the response
//   })
//   .listen(80); //the server object listens on port 80

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on the port ${port}`);
});

const AllSessionsObject = {};
//const client = new Client();
const client = new Client({
  puppeteer: {
    headless: false, //make it as true when running on AWS EC2
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
  if (chat.isGroup) {
    const date = new Date(msg.timestamp * 1000)
      .toISOString()
      .replace(/T/, ' ')
      .replace(/\..+/, '');
    console.log(chat.name);
    console.log(msg.author.substring(0, msg.author.length - 5));
    console.log(date);
    console.log(msg.body);
  }
});

client.initialize();
