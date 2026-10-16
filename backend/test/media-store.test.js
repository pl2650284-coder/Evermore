const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createMediaStore, MEDIA_PREFIX } = require('../storage/media-store');

async function bodyToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

class FakeS3Client {
  constructor() {
    this.objects = new Map();
    this.getCount = 0;
  }

  async send(command) {
    if (command.constructor.name === 'PutObjectCommand') {
      this.objects.set(command.input.Key, {
        body: await bodyToBuffer(command.input.Body),
        contentType: command.input.ContentType,
      });
      return {};
    }
    if (command.constructor.name === 'GetObjectCommand') {
      this.getCount += 1;
      const object = this.objects.get(command.input.Key);
      if (!object) throw new Error('missing object');
      return { Body: Buffer.from(object.body), ContentType: object.contentType };
    }
    throw new Error(`Unexpected command: ${command.constructor.name}`);
  }

  destroy() {}
}

test('media store uploads to object storage and caches downloads', async (t) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-media-test-'));
  const uploadPath = path.join(dataDirectory, 'temporary.png');
  const content = Buffer.from('cloud-media-content');
  fs.writeFileSync(uploadPath, content);

  const configuration = { bucket: 'test-bucket' };
  const client = new FakeS3Client();
  const store = createMediaStore({
    loadConfiguration: () => configuration,
    createClient: () => client,
    resolveDataDirectory: () => dataDirectory,
  });

  t.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));

  const uploaded = await store.upload({
    path: uploadPath,
    originalname: 'photo.png',
    mimetype: 'image/png',
    size: content.length,
  });
  assert.ok(uploaded.key.startsWith(`${MEDIA_PREFIX}/`));
  assert.match(uploaded.url, /^\/api\/media\/[A-Za-z0-9_-]+$/);
  assert.deepEqual(client.objects.get(uploaded.key).body, content);

  const id = uploaded.url.split('/').pop();
  const firstRead = await store.get(id);
  assert.equal(firstRead.cached, false);
  assert.equal(firstRead.contentType, 'image/png');
  assert.deepEqual(fs.readFileSync(firstRead.path), content);

  const secondRead = await store.get(id);
  assert.equal(secondRead.cached, true);
  assert.equal(client.getCount, 1);
});

test('media store returns null when object storage is not configured', async () => {
  const store = createMediaStore({ loadConfiguration: () => null });
  const result = await store.upload({ originalname: 'photo.png' });
  assert.equal(result, null);
});

test('media store rejects invalid public media identifiers', () => {
  const store = createMediaStore();
  assert.throws(
    () => store.decodeMediaId(Buffer.from('other-prefix/photo.png').toString('base64url')),
    (error) => error.status === 400
  );
});

test('media cache removes least recently used files above its limit', (t) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-cache-test-'));
  const cacheDirectory = path.join(dataDirectory, 'media-cache');
  fs.mkdirSync(cacheDirectory);
  const older = path.join(cacheDirectory, 'older.bin');
  const newer = path.join(cacheDirectory, 'newer.bin');
  fs.writeFileSync(older, Buffer.alloc(8));
  fs.writeFileSync(newer, Buffer.alloc(8));
  const oldTime = new Date(Date.now() - 60_000);
  fs.utimesSync(older, oldTime, oldTime);

  const store = createMediaStore({ resolveDataDirectory: () => dataDirectory });
  store.trimCache(8);

  assert.equal(fs.existsSync(older), false);
  assert.equal(fs.existsSync(newer), true);
  t.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));
});

test('media cache limit is saved locally and trims existing files', (t) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-cache-settings-test-'));
  const cacheDirectory = path.join(dataDirectory, 'media-cache');
  fs.mkdirSync(cacheDirectory);
  const largeFile = path.join(cacheDirectory, 'large.bin');
  fs.closeSync(fs.openSync(largeFile, 'w'));
  fs.truncateSync(largeFile, 101 * 1024 * 1024);

  const store = createMediaStore({ resolveDataDirectory: () => dataDirectory });
  const status = store.setCacheLimitBytes(100 * 1024 * 1024);

  assert.equal(status.limitBytes, 100 * 1024 * 1024);
  assert.equal(status.usedBytes, 0);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(dataDirectory, 'media-settings.json'), 'utf8')),
    { cacheLimitBytes: 100 * 1024 * 1024 }
  );
  store.setCacheLimitBytes(500 * 1024 * 1024);
  assert.equal(store.cacheStatus().limitBytes, 500 * 1024 * 1024);
  t.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));
});
