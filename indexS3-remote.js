const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();
const { Readable } = require('stream');

const os = require('os');
const path = require('path');

// Use a temporary directory for backups
const tempBackupPath = path.join(os.tmpdir(), 'whatsapp-backup');

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// WhatsApp Client Configuration
function createWhatsAppClient() {
  const CLIENT_ID = process.env.WHATSAPP_CLIENT_ID || 'default_client';
  const S3_BUCKET = process.env.S3_BUCKET_NAME;

  const store = {
    async save(session) {
      const params = {
        Bucket: S3_BUCKET,
        Key: `whatsapp_sessions/${CLIENT_ID}.json`,
        Body: JSON.stringify(session),
        ContentType: 'application/json',
      };

      try {
        await s3Client.send(new PutObjectCommand(params));
        console.log('Session saved to S3');
      } catch (error) {
        console.error('Error saving session to S3:', error);
      }
    },
    async retrieve() {
      const params = {
        Bucket: S3_BUCKET,
        Key: `whatsapp_sessions/${CLIENT_ID}.json`,
      };

      try {
        const data = await s3Client.send(new GetObjectCommand(params));
        const bodyContents = await streamToString(data.Body);
        return JSON.parse(bodyContents);
      } catch (error) {
        if (error.name === 'NoSuchKey') {
          console.log('No existing session found');
          return null;
        }
        console.error('Error retrieving session from S3:', error);
      }
    },
    async sessionExists() {
      const params = {
        Bucket: S3_BUCKET,
        Key: `whatsapp_sessions/${CLIENT_ID}.json`,
      };

      try {
        await s3Client.send(new GetObjectCommand(params));
        return true;
      } catch (error) {
        if (error.name === 'NoSuchKey') {
          return false;
        }
        console.error('Error checking session existence in S3:', error);
        throw error;
      }
    },
    async extract() {
      try {
        const session = await this.retrieve();
        if (session) {
          console.log('Session extracted from S3');
          return session;
        }
        console.log('No session to extract');
        return null;
      } catch (error) {
        console.error('Error extracting session from S3:', error);
        throw error;
      }
    },
  };

  const client = new Client({
    authStrategy: new RemoteAuth({
      clientId: CLIENT_ID,
      store: store,
      dataPath: './.wwebjs_auth',
      //backupPath: './RemoteAuth-default_client.zip',
      backupSyncIntervalMs: 60000, // Minimum 1 minute
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    },
  });

  // Modify QR code event to conditionally show QR
  client.on('qr', async (qr) => {
    const sessionExists = await store.sessionExists();
    if (!sessionExists) {
      console.log('QR RECEIVED');
      qrcode.generate(qr, { small: true });
    } else {
      console.log('Existing session found. Attempting to restore...');
    }
  });

  client.on('remote_session_saved', () => {
    console.log('Session saved to S3 Bucket');
  });

  client.on('authenticated', () => {
    console.log('Authenticated successfully');
  });

  client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
  });

  client.on('ready', () => {
    console.log('Client is ready!');
  });

  client.on('message', async (msg) => {
    console.log(msg.body);
  });

  return client;
}

// Helper function to convert stream to string
const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });

// Initialize the client
const client = createWhatsAppClient();
client.initialize();

// Optional: Error handling for process
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { client };
