const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function s3Error(name, statusCode) {
  const error = new Error(name);
  error.name = name;
  error.$metadata = { httpStatusCode: statusCode };
  return error;
}

async function bodyToBuffer(body) {
  if (Buffer.isBuffer(body) || body instanceof Uint8Array || typeof body === 'string') {
    return Buffer.from(body);
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

class FakeS3Client {
  constructor() {
    this.objects = new Map();
    this.nextEtag = 1;
  }

  async send(command) {
    const input = command.input;
    switch (command.constructor.name) {
      case 'HeadBucketCommand':
        return {};
      case 'HeadObjectCommand': {
        const object = this.objects.get(input.Key);
        if (!object) throw s3Error('NotFound', 404);
        return { ContentLength: object.body.length, ETag: object.etag };
      }
      case 'GetObjectCommand': {
        const object = this.objects.get(input.Key);
        if (!object) throw s3Error('NoSuchKey', 404);
        return { Body: Buffer.from(object.body), ETag: object.etag };
      }
      case 'PutObjectCommand': {
        const existing = this.objects.get(input.Key);
        if (input.IfNoneMatch === '*' && existing) {
          throw s3Error('PreconditionFailed', 412);
        }
        if (input.IfMatch && existing?.etag !== input.IfMatch) {
          throw s3Error('PreconditionFailed', 412);
        }
        const object = {
          body: await bodyToBuffer(input.Body),
          etag: `"fake-${this.nextEtag++}"`,
        };
        this.objects.set(input.Key, object);
        return { ETag: object.etag };
      }
      default:
        throw new Error(`Unexpected command: ${command.constructor.name}`);
    }
  }

  destroy() {}
}

test('S3 sync uploads, detects changes, restores, and reports conflicts', async (t) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-s3-test-'));
  const databasePath = path.join(dataDirectory, 'love-museum.sqlite');
  const uploadDirectory = path.join(dataDirectory, 'uploads');
  fs.mkdirSync(uploadDirectory);

  process.env.LOVE_MUSEUM_DATA_DIR = dataDirectory;
  process.env.DB_PATH = databasePath;
  process.env.UPLOAD_DIR = uploadDirectory;
  process.env.JWT_SECRET = 's3-sync-test-local-encryption-key';

  const { getDatabase, closeDatabase } = require('../db/connection');
  const { migrate } = require('../db/migrate');
  const { MANIFEST_KEY, createSyncService } = require('../sync/s3-sync');
  const s3 = new FakeS3Client();
  const service = createSyncService({
    clientFactory: () => s3,
    dataDirectory: () => dataDirectory,
    databasePath: () => databasePath,
    uploadDirectory: () => uploadDirectory,
  });

  t.after(() => {
    closeDatabase();
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  });

  await migrate();
  getDatabase().prepare(
    'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)'
  ).run('user-1', 'sync@example.com', 'password-hash', 'Before sync');
  fs.writeFileSync(path.join(uploadDirectory, 'photo.png'), Buffer.from('original-photo'));

  const configuration = await service.saveConfiguration({
    endpoint: 'https://objects.example.com',
    region: 'auto',
    bucket: 'love-museum-test',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  });
  assert.deepEqual(configuration, {
    endpoint: 'https://objects.example.com',
    region: 'auto',
    bucket: 'love-museum-test',
    accessKeyIdHint: 'test••••-key',
  });
  const encryptedConfiguration = fs.readFileSync(
    path.join(dataDirectory, 's3-sync.enc.json'),
    'utf8'
  );
  assert.doesNotMatch(encryptedConfiguration, /test-access-key|test-secret-key/);

  assert.equal((await service.getStatus()).state, 'upload-needed');
  const uploaded = await service.run('auto');
  assert.equal(uploaded.direction, 'upload');
  assert.ok(s3.objects.has(MANIFEST_KEY));
  assert.equal((await service.getStatus()).state, 'synced');

  getDatabase().prepare('UPDATE users SET name = ? WHERE id = ?').run('Local edit', 'user-1');
  fs.writeFileSync(path.join(uploadDirectory, 'local-only.txt'), 'remove on restore');
  assert.equal((await service.getStatus()).state, 'upload-needed');

  const downloaded = await service.run('download');
  assert.equal(downloaded.direction, 'download');
  assert.equal(
    getDatabase().prepare('SELECT name FROM users WHERE id = ?').get('user-1').name,
    'Before sync'
  );
  assert.equal(fs.readFileSync(path.join(uploadDirectory, 'photo.png'), 'utf8'), 'original-photo');
  assert.equal(fs.existsSync(path.join(uploadDirectory, 'local-only.txt')), false);
  assert.ok(fs.readdirSync(path.join(dataDirectory, 'sync-recovery')).length > 0);
  assert.equal((await service.getStatus()).state, 'synced');

  getDatabase().prepare('UPDATE users SET name = ? WHERE id = ?').run('Keep after failed restore', 'user-1');
  fs.writeFileSync(path.join(uploadDirectory, 'keep-after-failure.txt'), 'keep me');
  const originalCpSync = fs.cpSync;
  fs.cpSync = (source, destination, ...args) => {
    if (destination === uploadDirectory) {
      throw new Error('simulated upload restore failure');
    }
    return originalCpSync(source, destination, ...args);
  };
  try {
    await assert.rejects(
      service.run('download'),
      (error) => error.code === 'LOCAL_RESTORE_FAILED'
    );
  } finally {
    fs.cpSync = originalCpSync;
  }
  assert.equal(
    getDatabase().prepare('SELECT name FROM users WHERE id = ?').get('user-1').name,
    'Keep after failed restore'
  );
  assert.equal(
    fs.readFileSync(path.join(uploadDirectory, 'keep-after-failure.txt'), 'utf8'),
    'keep me'
  );

  getDatabase().prepare('UPDATE users SET name = ? WHERE id = ?').run('Another local edit', 'user-1');
  const manifestObject = s3.objects.get(MANIFEST_KEY);
  const manifest = JSON.parse(manifestObject.body.toString('utf8'));
  manifest.revision = 'other-device-revision';
  manifest.dataFingerprint = 'a'.repeat(64);
  s3.objects.set(MANIFEST_KEY, {
    body: Buffer.from(JSON.stringify(manifest)),
    etag: `"fake-${s3.nextEtag++}"`,
  });

  assert.equal((await service.getStatus()).state, 'conflict');
  await assert.rejects(
    service.run('auto'),
    (error) => error.code === 'SYNC_CONFLICT' && error.status === 409
  );
  assert.equal((await service.run('upload')).direction, 'upload');
  assert.equal((await service.getStatus()).state, 'synced');
});

test('S3 configuration rejects invalid input and failed connection tests', async (t) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-s3-config-test-'));
  process.env.JWT_SECRET = 's3-sync-test-local-encryption-key';

  const { createSyncService } = require('../sync/s3-sync');
  const service = createSyncService({
    clientFactory: () => ({
      async send() {
        throw new Error('access denied');
      },
      destroy() {},
    }),
    dataDirectory: () => dataDirectory,
  });

  t.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));

  await assert.rejects(
    service.saveConfiguration({}),
    (error) => error.code === 'INVALID_CONFIGURATION'
  );
  await assert.rejects(
    service.saveConfiguration({
      endpoint: 'https://objects.example.com',
      region: 'auto',
      bucket: 'love-museum-test',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    }),
    (error) => error.code === 'S3_CONNECTION_FAILED'
  );
  assert.equal(fs.existsSync(path.join(dataDirectory, 's3-sync.enc.json')), false);
});
