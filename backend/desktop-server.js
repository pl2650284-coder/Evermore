const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const dataDirectory = path.resolve(
  process.env.LOVE_MUSEUM_DATA_DIR || path.join(__dirname, 'data')
);
const frontendDirectory = path.resolve(
  process.env.FRONTEND_DIR || path.join(__dirname, '..', 'out')
);

fs.mkdirSync(dataDirectory, { recursive: true });
const uploadDirectory = path.join(dataDirectory, 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

function getJwtSecret() {
  const secretPath = path.join(dataDirectory, 'secret.key');

  if (fs.existsSync(secretPath)) {
    const existingSecret = fs.readFileSync(secretPath, 'utf8').trim();
    if (existingSecret) {
      return existingSecret;
    }
  }

  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, secret, 'utf8');
  return secret;
}

process.env.DB_PATH = process.env.DB_PATH || path.join(dataDirectory, 'love-museum.sqlite');
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || uploadDirectory;
process.env.JWT_SECRET = process.env.JWT_SECRET || getJwtSecret();

const { startServer } = require('./server');
const { closeDatabase } = require('./db/connection');

let server;

async function stop() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
  }
  closeDatabase();
}

async function main() {
  const started = await startServer({
    host: '127.0.0.1',
    port: Number(process.env.PORT || 38489),
    frontendDir: process.env.FRONTEND_DIR ? frontendDirectory : undefined,
  });

  server = started.server;
  console.log(`Love Museum local API running at ${started.url}`);
}

process.once('SIGINT', async () => {
  await stop();
  process.exit(0);
});
process.once('SIGTERM', async () => {
  await stop();
  process.exit(0);
});

main().catch(async (error) => {
  console.error('Failed to start Love Museum local API:', error);
  await stop();
  process.exitCode = 1;
});
