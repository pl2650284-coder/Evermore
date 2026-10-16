const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Config = require('../sync/s3-config');

const MEDIA_PREFIX = 'love-museum/v1/media';
const DEFAULT_CACHE_BYTES = 500 * 1024 * 1024;
const MIN_CACHE_BYTES = 100 * 1024 * 1024;
const MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024;

function createMediaStore(options = {}) {
  const loadConfiguration = options.loadConfiguration || s3Config.loadConfiguration;
  const createClient = options.createClient || s3Config.createClient;
  const resolveDataDirectory = options.resolveDataDirectory || s3Config.resolveDataDirectory;

  function cacheDirectory() {
    return path.join(resolveDataDirectory(), 'media-cache');
  }

  function settingsPath() {
    return path.join(resolveDataDirectory(), 'media-settings.json');
  }

  function cacheLimitBytes() {
    const environmentValue = Number(process.env.MEDIA_CACHE_MAX_BYTES);
    if (Number.isSafeInteger(environmentValue) && environmentValue > 0) {
      return environmentValue;
    }
    try {
      const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
      const configured = Number(saved.cacheLimitBytes);
      if (Number.isSafeInteger(configured) && configured >= MIN_CACHE_BYTES && configured <= MAX_CACHE_BYTES) {
        return configured;
      }
    } catch {
      // Missing or invalid local settings use the default.
    }
    return DEFAULT_CACHE_BYTES;
  }

  function objectKey(filename) {
    const extension = path.extname(filename).toLowerCase();
    return `${MEDIA_PREFIX}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${extension}`;
  }

  function mediaUrl(key) {
    return `/api/media/${Buffer.from(key, 'utf8').toString('base64url')}`;
  }

  function decodeMediaId(id) {
    const key = Buffer.from(id, 'base64url').toString('utf8');
    if (!key.startsWith(`${MEDIA_PREFIX}/`) || key.includes('..') || key.includes('\\')) {
      const error = new Error('Invalid media key');
      error.status = 400;
      throw error;
    }
    return key;
  }

  function cachePath(key) {
    const extension = path.extname(key).toLowerCase();
    const filename = `${crypto.createHash('sha256').update(key).digest('hex')}${extension}`;
    return path.join(cacheDirectory(), filename);
  }

  function trimCache(limit = cacheLimitBytes()) {
    const directory = cacheDirectory();
    if (!fs.existsSync(directory)) return;
    const files = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const absolutePath = path.join(directory, entry.name);
        const stat = fs.statSync(absolutePath);
        return { absolutePath, size: stat.size, lastAccess: stat.atimeMs || stat.mtimeMs };
      })
      .sort((left, right) => left.lastAccess - right.lastAccess);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (total <= limit) break;
      fs.rmSync(file.absolutePath, { force: true });
      total -= file.size;
    }
  }

  function cacheStatus() {
    const directory = cacheDirectory();
    const files = fs.existsSync(directory)
      ? fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile())
      : [];
    const usedBytes = files.reduce((total, entry) => {
      return total + fs.statSync(path.join(directory, entry.name)).size;
    }, 0);
    return { limitBytes: cacheLimitBytes(), usedBytes, fileCount: files.length };
  }

  function setCacheLimitBytes(value) {
    const limitBytes = Number(value);
    if (!Number.isSafeInteger(limitBytes) || limitBytes < MIN_CACHE_BYTES || limitBytes > MAX_CACHE_BYTES) {
      const error = new Error('缓存大小必须在 100MB 到 5GB 之间');
      error.status = 400;
      throw error;
    }
    fs.mkdirSync(resolveDataDirectory(), { recursive: true });
    fs.writeFileSync(
      settingsPath(),
      JSON.stringify({ cacheLimitBytes: limitBytes }, null, 2),
      'utf8'
    );
    trimCache(limitBytes);
    return cacheStatus();
  }

  async function bodyToBuffer(body) {
    if (Buffer.isBuffer(body) || body instanceof Uint8Array || typeof body === 'string') {
      return Buffer.from(body);
    }
    const chunks = [];
    for await (const chunk of body || []) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async function upload(file) {
    const configuration = loadConfiguration();
    if (!configuration) return null;
    const client = createClient(configuration);
    const key = objectKey(file.originalname);
    try {
      await client.send(new PutObjectCommand({
        Bucket: configuration.bucket,
        Key: key,
        Body: fs.createReadStream(file.path),
        ContentLength: file.size,
        ContentType: file.mimetype,
      }));
      return { key, url: mediaUrl(key) };
    } finally {
      client.destroy?.();
    }
  }

  async function get(id) {
    const key = decodeMediaId(id);
    const destination = cachePath(key);
    if (fs.existsSync(destination)) {
      const now = new Date();
      fs.utimesSync(destination, now, now);
      return { path: destination, contentType: null, cached: true };
    }

    const configuration = loadConfiguration();
    if (!configuration) {
      const error = new Error('Object storage is not configured');
      error.status = 503;
      throw error;
    }
    const client = createClient(configuration);
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: configuration.bucket,
        Key: key,
      }));
      const content = await bodyToBuffer(response.Body);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(temporary, content, { flag: 'wx' });
      fs.renameSync(temporary, destination);
      trimCache();
      return { path: destination, contentType: response.ContentType || null, cached: false };
    } finally {
      client.destroy?.();
    }
  }

  return { cacheStatus, decodeMediaId, get, setCacheLimitBytes, trimCache, upload };
}

module.exports = {
  DEFAULT_CACHE_BYTES,
  MAX_CACHE_BYTES,
  MEDIA_PREFIX,
  MIN_CACHE_BYTES,
  createMediaStore,
};
