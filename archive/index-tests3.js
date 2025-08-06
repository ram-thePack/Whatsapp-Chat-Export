// const { AwsS3Store, S3Client } = require('./src/AwsS3Store');
// const { Client, RemoteAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
// require('dotenv').config();

// const s3 = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
//   httpOptions: {
//     timeout: 600000, // 10 minutes <-- increase this value for large file uploads
//   },
// });

// const store = new AwsS3Store({
//   bucketName: process.env.S3_BUCKET_NAME,
//   remoteDataPath: 'example/dir',
//   s3Client: s3,
// });

// const client = new Client({
//   authStrategy: new RemoteAuth({
//     clientId: 'session-123',
//     dataPath: './.wwebjs_auth',
//     store: store,
//     backupSyncIntervalMs: 600000, // in milliseconds (10 minutes) <-- decrease this value if you want to test the backup feature
//   }),
// });

// client.on('qr', (qr) => {
//   // Generate and scan this code with your phone
//   console.log('QR RECEIVED', qr);
//   qrcode.generate(qr, { small: true });
// });

// client.once('ready', () => {
//   console.log('Client is ready!');

//   // trigger whatsapp client is started and ready
// });

// client.on('message', (msg) => {
//   if (msg.body == '!ping') {
//     msg.reply('pong');
//   }
// });

// // it will done early (so use event 'ready' listener to know when the whatsapp client is ready & started)
// client.initialize();

//---------------------------------

const { AwsS3Store, S3Client } = require('./src/AwsS3Store');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

const safeWords = ['fuck', 'poop'];
const NOTIFICATION_NUMBER = '918050798672@c.us';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  httpOptions: {
    timeout: 600000,
  },
});

const store = new AwsS3Store({
  bucketName: process.env.S3_BUCKET_NAME,
  remoteDataPath: 'example/dir',
  s3Client: s3,
});

const clientId = 'session-123';

// Enhanced session checking
async function checkAndValidateS3Session(clientId) {
  try {
    // Use sessionExists method if available
    const sessionExists = await store.sessionExists(clientId);
    console.log('Session existence check:', sessionExists);
    return sessionExists;
  } catch (error) {
    console.error('Error checking session:', error);
    return false;
  }
}

const client = new Client({
  authStrategy: new RemoteAuth({
    clientId: clientId,
    dataPath: './.wwebjs_auth',
    store: store,
    backupSyncIntervalMs: 600000,
  }),
});

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.on('authenticated', async (session) => {
  console.log('Authentication successful, saving session');
  // try {
  //   // Adjust save method if needed based on actual implementation
  //   await store.save(session);
  //   console.log('Session saved successfully');
  // } catch (error) {
  //   console.error('Failed to save session:', error);
  // }
});

client.on('auth_failure', async (msg) => {
  console.error('Authentication failed:', msg);

  // Remove invalid session from S3

  // try {
  //   await store.delete(clientId);
  //   console.log('Removed invalid session from S3');
  // } catch (deleteError) {
  //   console.error('Failed to delete invalid session:', deleteError);
  // }
});

async function initializeWhatsAppClient() {
  try {
    const sessionExists = await checkAndValidateS3Session(clientId);

    if (sessionExists) {
      console.log('Existing session detected. Attempting restoration.');
    } else {
      console.log('No valid session found. Scan QR code to authenticate.');
    }

    client.initialize();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

client.on('message', async (msg) => {
  const contact_name = (await msg.getContact()).pushname;
  let chat = await msg.getChat();
  console.log(msg.body);

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

initializeWhatsAppClient();

// async unCompressSession(compressedSessionPath) {
//     console.log("inside unCompressSession");
//     await new Promise((resolve, reject) => {
//         const zip = new AdmZip(compressedSessionPath);
//         zip.extractAllToAsync(this.userDataDir, true, false, (err) => {
//             if (err) {
//                 reject(err);
//             } else {
//                 resolve();
//             }
//         });
//     });
//     await fs.promises.unlink(compressedSessionPath);
// }
