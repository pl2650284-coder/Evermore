const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { backup, DatabaseSync } = require('node:sqlite');
const {
  S3Client,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  closeDatabase,
  getDatabase,
  getDatabasePath,
} = require('../db/connection');

const ROOT_KEY = 'love-museum/v1';
const MANIFEST_KEY = `${ROOT_KEY}/manifest.json`;
const FORMAT_VERSION = 1;
const DATABASE_SCHEMA_VERSION = 1;
const MAX_MANIFEST_SIZE = 1024 * 1024;

class SyncError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.status = status;
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeValue(value) {
  if (typeof value === 'bigint') {
    return { bigint: value.toString() };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { base64: Buffer.from(value).toString('base64') };
  }
  return value;
}

function databaseFingerprint(database) {
  const hash = crypto.createHash('sha256');
  const tables = database.prepare(
    `SELECT name FROM sqlite_schema
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`
  ).all();
  let contentRowCount = 0;

  for (const { name } of tables) {
    const identifier = quoteIdentifier(name);
    const columns = database.prepare(`PRAGMA table_info(${identifier})`).all();
    const columnNames = columns.map((column) => column.name);
    const orderBy = columnNames.map(quoteIdentifier).join(', ');
    const rows = database.prepare(
      `SELECT * FROM ${identifier}${orderBy ? ` ORDER BY ${orderBy}` : ''}`
    ).all();

    if (!['admins', 'users'].includes(name)) {
      contentRowCount += rows.length;
    }
    hash.update(JSON.stringify({
      table: name,
      columns: columnNames,
      rows: rows.map((row) => columnNames.map((column) => normalizeValue(row[column]))),
    }));
  }

  return { hash: hash.digest('hex'), contentRowCount };
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function listFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = [];
  async function visit(directory, prefix = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(absolutePath);
        files.push({
          path: relativePath,
          absolutePath,
          size: stat.size,
          sha256: await hashFile(absolutePath),
        });
      }
    }
  }

  await visit(root);
  return files;
}

async function localSnapshotInfo(database, uploadDirectory) {
  const databaseInfo = databaseFingerprint(database);
  const files = await listFiles(uploadDirectory);
  const fingerprint = crypto.createHash('sha256');
  fingerprint.update(databaseInfo.hash);
  for (const file of files) {
    fingerprint.update(JSON.stringify([file.path, file.size, file.sha256]));
  }

  return {
    fingerprint: fingerprint.digest('hex'),
    isEmpty: databaseInfo.contentRowCount === 0 && files.length === 0,
    files,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
  };
}

function validateConfiguration(input) {
  const configuration = {
    endpoint: String(input.endpoint || '').trim(),
    region: String(input.region || '').trim(),
    bucket: String(input.bucket || '').trim(),
    accessKeyId: String(input.accessKeyId || '').trim(),
    secretAccessKey: String(input.secretAccessKey || '').trim(),
  };

  if (Object.values(configuration).some((value) => !value)) {
    throw new SyncError('INVALID_CONFIGURATION', '请填写 Endpoint、Region、Bucket name、AK 和 SK。');
  }

  let endpoint;
  try {
    endpoint = new URL(configuration.endpoint);
  } catch {
    throw new SyncError('INVALID_CONFIGURATION', 'Endpoint 不是有效的网址。');
  }
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new SyncError('INVALID_CONFIGURATION', 'Endpoint 只支持 HTTP 或 HTTPS。');
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new SyncError('INVALID_CONFIGURATION', 'Endpoint 不能包含账号、查询参数或片段。');
  }
  if (configuration.bucket.includes('/')) {
    throw new SyncError('INVALID_CONFIGURATION', 'Bucket name 不能包含斜杠。');
  }

  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '');
  configuration.endpoint = endpoint.toString().replace(/\/$/, '');
  return configuration;
}

function targetHash(configuration) {
  return sha256(JSON.stringify([
    configuration.endpoint,
    configuration.region,
    configuration.bucket,
    configuration.accessKeyId,
  ]));
}

function publicConfiguration(configuration) {
  if (!configuration) {
    return null;
  }
  const key = configuration.accessKeyId;
  return {
    endpoint: configuration.endpoint,
    region: configuration.region,
    bucket: configuration.bucket,
    accessKeyIdHint: key.length <= 8 ? '••••••••' : `${key.slice(0, 4)}••••${key.slice(-4)}`,
  };
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new SyncError('CONFIGURATION_UNAVAILABLE', '本机密钥不可用，无法保存对象存储配置。', 500);
  }
  return crypto.createHash('sha256').update(`love-museum-s3\0${secret}`).digest();
}

function encryptConfiguration(configuration) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(configuration), 'utf8'),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

function decryptConfiguration(serialized) {
  try {
    const encrypted = JSON.parse(serialized);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(encrypted.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8'));
  } catch {
    throw new SyncError(
      'CONFIGURATION_UNAVAILABLE',
      '无法读取本机对象存储配置，请重新填写并保存。',
      500
    );
  }
}

function writeJsonAtomic(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, typeof value === 'string' ? value : JSON.stringify(value, null, 2), {
    encoding: 'utf8',
    mode,
  });
  fs.renameSync(temporaryPath, filePath);
}

function isMissingObject(error) {
  return error?.$metadata?.httpStatusCode === 404
    || ['NoSuchKey', 'NotFound'].includes(error?.name);
}

function isPreconditionFailure(error) {
  return error?.$metadata?.httpStatusCode === 412 || error?.name === 'PreconditionFailed';
}

async function collectBody(body, limit = Infinity) {
  const chunks = [];
  let size = 0;
  if (body == null) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body) || body instanceof Uint8Array || typeof body === 'string') {
    const buffer = Buffer.from(body);
    if (buffer.length > limit) {
      throw new SyncError('INVALID_REMOTE_DATA', '云端清单过大，已拒绝读取。');
    }
    return buffer;
  }
  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) {
      throw new SyncError('INVALID_REMOTE_DATA', '云端清单过大，已拒绝读取。');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function writeBodyToFile(body, destination, expected) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const file = await fs.promises.open(destination, 'wx');
  const hash = crypto.createHash('sha256');
  let size = 0;

  try {
    if (body == null) {
      throw new SyncError('INVALID_REMOTE_DATA', '云端对象内容为空，未替换本机数据。');
    }
    const source = (Buffer.isBuffer(body) || body instanceof Uint8Array || typeof body === 'string')
      ? [body]
      : body;
    for await (const chunk of source) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > expected.size) {
        throw new SyncError('INVALID_REMOTE_DATA', '云端对象大小与清单不一致，未替换本机数据。');
      }
      hash.update(buffer);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesWritten } = await file.write(
          buffer,
          offset,
          buffer.length - offset,
          null
        );
        if (bytesWritten === 0) {
          throw new Error('Unable to write downloaded object');
        }
        offset += bytesWritten;
      }
    }
  } finally {
    await file.close();
  }

  const digest = hash.digest('hex');
  if (size !== expected.size || digest !== expected.sha256) {
    fs.rmSync(destination, { force: true });
    throw new SyncError('INVALID_REMOTE_DATA', '云端对象校验失败，未替换本机数据。');
  }
}

function validateManifest(manifest) {
  if (!manifest || manifest.formatVersion !== FORMAT_VERSION || manifest.app !== 'love-museum') {
    throw new SyncError('INVALID_REMOTE_DATA', '云端数据不是可识别的 Evermore 同步快照。');
  }
  if (manifest.databaseSchemaVersion > DATABASE_SCHEMA_VERSION) {
    throw new SyncError('APP_UPDATE_REQUIRED', '云端数据来自更新版本，请先升级 Evermore。', 409);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(manifest.revision || '')
    || !manifest.database
    || !Array.isArray(manifest.files)) {
    throw new SyncError('INVALID_REMOTE_DATA', '云端同步清单不完整。');
  }

  const objects = [manifest.database, ...manifest.files];
  for (const object of objects) {
    if (!object.key?.startsWith(`${ROOT_KEY}/`)
      || !Number.isSafeInteger(object.size)
      || object.size < 0
      || !/^[a-f0-9]{64}$/.test(object.sha256 || '')) {
      throw new SyncError('INVALID_REMOTE_DATA', '云端同步清单包含无效对象。');
    }
  }

  const seenPaths = new Set();
  for (const file of manifest.files) {
    const normalized = path.posix.normalize(file.path || '');
    if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.startsWith('/')
      || normalized.includes('\\') || seenPaths.has(normalized)) {
      throw new SyncError('INVALID_REMOTE_DATA', '云端同步清单包含不安全的文件路径。');
    }
    file.path = normalized;
    seenPaths.add(normalized);
  }
  return manifest;
}

function createClient(configuration) {
  return new S3Client({
    endpoint: configuration.endpoint,
    region: configuration.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
}

function resolveDataDirectory() {
  return path.resolve(
    process.env.LOVE_MUSEUM_DATA_DIR || path.dirname(getDatabasePath())
  );
}

function resolveUploadDirectory() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(resolveDataDirectory(), 'uploads'));
}

function assertSafeReplacementPath(target, label) {
  const resolved = path.resolve(target);
  if (resolved === path.parse(resolved).root) {
    throw new SyncError('UNSAFE_LOCAL_PATH', `${label} 路径不安全，已停止同步。`, 500);
  }
  return resolved;
}

function createSyncService(options = {}) {
  const clientFactory = options.clientFactory || createClient;
  const paths = {
    dataDirectory: options.dataDirectory || resolveDataDirectory,
    uploadDirectory: options.uploadDirectory || resolveUploadDirectory,
    databasePath: options.databasePath || getDatabasePath,
  };
  let activeOperation = null;

  function configurationPath() {
    return path.join(paths.dataDirectory(), 's3-sync.enc.json');
  }

  function statePath() {
    return path.join(paths.dataDirectory(), 's3-sync-state.json');
  }

  function loadConfiguration() {
    const filePath = configurationPath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return validateConfiguration(decryptConfiguration(fs.readFileSync(filePath, 'utf8')));
  }

  function loadState() {
    try {
      return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    } catch {
      return null;
    }
  }

  function saveState(state) {
    writeJsonAtomic(statePath(), state);
  }

  async function exclusive(action) {
    if (activeOperation) {
      throw new SyncError('SYNC_BUSY', '另一个同步任务正在进行，请稍后再试。', 409);
    }
    activeOperation = Promise.resolve().then(action);
    try {
      return await activeOperation;
    } finally {
      activeOperation = null;
    }
  }

  async function readRemoteManifest(client, configuration) {
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: configuration.bucket,
        Key: MANIFEST_KEY,
      }));
      const body = await collectBody(response.Body, MAX_MANIFEST_SIZE);
      let manifest;
      try {
        manifest = JSON.parse(body.toString('utf8'));
      } catch {
        throw new SyncError('INVALID_REMOTE_DATA', '云端同步清单不是有效的 JSON。');
      }
      return { manifest: validateManifest(manifest), etag: response.ETag };
    } catch (error) {
      if (isMissingObject(error)) {
        return null;
      }
      if (error instanceof SyncError) {
        throw error;
      }
      throw new SyncError('S3_UNAVAILABLE', '无法读取对象存储，请检查网络和 S3 配置。', 502);
    }
  }

  function getPublicConfiguration() {
    return publicConfiguration(loadConfiguration());
  }

  async function saveConfiguration(input) {
    return exclusive(async () => {
      const configuration = validateConfiguration(input);
      const client = clientFactory(configuration);
      try {
        await client.send(new HeadBucketCommand({ Bucket: configuration.bucket }));
      } catch {
        throw new SyncError(
          'S3_CONNECTION_FAILED',
          '连接失败，请检查 Endpoint、Region、Bucket name、AK、SK 及桶权限。'
        );
      } finally {
        client.destroy?.();
      }

      let previous = null;
      try {
        previous = loadConfiguration();
      } catch (error) {
        if (error.code !== 'CONFIGURATION_UNAVAILABLE') throw error;
      }
      writeJsonAtomic(configurationPath(), encryptConfiguration(configuration));
      if (!previous || targetHash(previous) !== targetHash(configuration)) {
        fs.rmSync(statePath(), { force: true });
      }
      return publicConfiguration(configuration);
    });
  }

  function determineStatus(local, remote, state, currentTargetHash) {
    if (!remote) {
      return local.isEmpty ? 'remote-empty' : 'upload-needed';
    }
    if (remote.manifest.dataFingerprint === local.fingerprint) {
      return 'synced';
    }
    if (local.isEmpty && (!state || state.targetHash !== currentTargetHash)) {
      return 'download-needed';
    }
    if (!state || state.targetHash !== currentTargetHash) {
      return 'conflict';
    }

    const localChanged = local.fingerprint !== state.localFingerprint;
    const remoteChanged = remote.manifest.revision !== state.remoteRevision;
    if (localChanged && remoteChanged) return 'conflict';
    if (localChanged) return 'upload-needed';
    if (remoteChanged) return 'download-needed';
    return 'conflict';
  }

  async function inspectInternal(configuration) {
    const client = clientFactory(configuration);
    try {
      const [local, remote] = await Promise.all([
        localSnapshotInfo(getDatabase(), paths.uploadDirectory()),
        readRemoteManifest(client, configuration),
      ]);
      const state = loadState();
      const currentTargetHash = targetHash(configuration);
      const status = determineStatus(local, remote, state, currentTargetHash);
      return { client, configuration, local, remote, state, currentTargetHash, status };
    } catch (error) {
      client.destroy?.();
      throw error;
    }
  }

  function statusResponse(inspected) {
    const { local, remote, state, status } = inspected;
    return {
      state: status,
      local: {
        isEmpty: local.isEmpty,
        fileCount: local.files.length,
        totalBytes: local.totalBytes,
      },
      remote: remote ? {
        revision: remote.manifest.revision,
        createdAt: remote.manifest.createdAt,
        fileCount: remote.manifest.files.length,
        totalBytes: remote.manifest.files.reduce((total, file) => total + file.size, 0)
          + remote.manifest.database.size,
      } : null,
      lastSyncedAt: state?.lastSyncedAt || null,
    };
  }

  async function getStatus() {
    return exclusive(async () => {
      const configuration = loadConfiguration();
      if (!configuration) {
        return { state: 'unconfigured', local: null, remote: null, lastSyncedAt: null };
      }
      const inspected = await inspectInternal(configuration);
      try {
        if (inspected.status === 'synced') {
          const lastSyncedAt = inspected.state?.targetHash === inspected.currentTargetHash
            && inspected.state?.remoteRevision === inspected.remote.manifest.revision
            && inspected.state?.localFingerprint === inspected.local.fingerprint
            ? inspected.state.lastSyncedAt
            : new Date().toISOString();
          inspected.state = {
            targetHash: inspected.currentTargetHash,
            remoteRevision: inspected.remote.manifest.revision,
            localFingerprint: inspected.local.fingerprint,
            lastSyncedAt,
          };
          saveState(inspected.state);
        }
        return statusResponse(inspected);
      } finally {
        inspected.client.destroy?.();
      }
    });
  }

  async function objectExists(client, configuration, key, size) {
    try {
      const response = await client.send(new HeadObjectCommand({
        Bucket: configuration.bucket,
        Key: key,
      }));
      return response.ContentLength === size;
    } catch (error) {
      if (isMissingObject(error)) {
        return false;
      }
      throw new SyncError('S3_UNAVAILABLE', '无法检查云端对象，请检查桶权限。', 502);
    }
  }

  async function createDatabaseSnapshot() {
    const dataDirectory = paths.dataDirectory();
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporaryDirectory = fs.mkdtempSync(path.join(dataDirectory, '.sync-upload-'));
    const snapshotPath = path.join(temporaryDirectory, 'love-museum.sqlite');
    const uploadDirectory = path.join(temporaryDirectory, 'uploads');
    await backup(getDatabase(), snapshotPath);
    if (fs.existsSync(paths.uploadDirectory())) {
      fs.cpSync(paths.uploadDirectory(), uploadDirectory, { recursive: true });
    } else {
      fs.mkdirSync(uploadDirectory);
    }
    return { temporaryDirectory, snapshotPath, uploadDirectory };
  }

  async function push(inspected) {
    const { client, configuration, remote, currentTargetHash } = inspected;
    const revision = crypto.randomUUID();
    const snapshot = await createDatabaseSnapshot();
    try {
      const snapshotDatabase = new DatabaseSync(snapshot.snapshotPath, { readOnly: true });
      let local;
      try {
        local = await localSnapshotInfo(snapshotDatabase, snapshot.uploadDirectory);
      } finally {
        snapshotDatabase.close();
      }
      const databaseStat = fs.statSync(snapshot.snapshotPath);
      const databaseHash = await hashFile(snapshot.snapshotPath);

      for (const file of local.files) {
        const key = `${ROOT_KEY}/files/${file.sha256}`;
        if (!(await objectExists(client, configuration, key, file.size))) {
          await client.send(new PutObjectCommand({
            Bucket: configuration.bucket,
            Key: key,
            Body: fs.createReadStream(file.absolutePath),
            ContentLength: file.size,
            ContentType: 'application/octet-stream',
          }));
        }
        file.key = key;
      }

      const databaseKey = `${ROOT_KEY}/snapshots/${revision}/love-museum.sqlite`;
      await client.send(new PutObjectCommand({
        Bucket: configuration.bucket,
        Key: databaseKey,
        Body: fs.createReadStream(snapshot.snapshotPath),
        ContentLength: databaseStat.size,
        ContentType: 'application/vnd.sqlite3',
      }));

      const manifest = {
        app: 'love-museum',
        formatVersion: FORMAT_VERSION,
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        revision,
        createdAt: new Date().toISOString(),
        dataFingerprint: local.fingerprint,
        database: {
          key: databaseKey,
          size: databaseStat.size,
          sha256: databaseHash,
        },
        files: local.files.map((file) => ({
          path: file.path,
          key: file.key,
          size: file.size,
          sha256: file.sha256,
        })),
      };
      const manifestBody = JSON.stringify(manifest);

      try {
        await client.send(new PutObjectCommand({
          Bucket: configuration.bucket,
          Key: MANIFEST_KEY,
          Body: manifestBody,
          ContentLength: Buffer.byteLength(manifestBody),
          ContentType: 'application/json',
          ...(remote?.etag ? { IfMatch: remote.etag } : { IfNoneMatch: '*' }),
        }));
      } catch (error) {
        if (isPreconditionFailure(error)) {
          throw new SyncError(
            'SYNC_CONFLICT',
            '云端数据在同步期间已被另一台设备更新，请刷新状态后重试。',
            409
          );
        }
        throw error;
      }

      const lastSyncedAt = new Date().toISOString();
      saveState({
        targetHash: currentTargetHash,
        remoteRevision: revision,
        localFingerprint: local.fingerprint,
        lastSyncedAt,
      });
      return { direction: 'upload', revision, lastSyncedAt };
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw new SyncError('S3_UPLOAD_FAILED', '上传同步数据失败，请检查网络和桶写入权限。', 502);
    } finally {
      fs.rmSync(snapshot.temporaryDirectory, { recursive: true, force: true });
    }
  }

  async function downloadObject(client, configuration, object, destination) {
    let response;
    try {
      response = await client.send(new GetObjectCommand({
        Bucket: configuration.bucket,
        Key: object.key,
      }));
    } catch {
      throw new SyncError('S3_DOWNLOAD_FAILED', '下载云端同步对象失败，请检查桶读取权限。', 502);
    }
    await writeBodyToFile(response.Body, destination, object);
  }

  async function replaceLocalData(stagingDatabase, stagingUploads, revision) {
    const databasePath = assertSafeReplacementPath(paths.databasePath(), '数据库');
    const uploadDirectory = assertSafeReplacementPath(paths.uploadDirectory(), '上传目录');
    const recoveryRoot = path.join(paths.dataDirectory(), 'sync-recovery');
    fs.mkdirSync(recoveryRoot, { recursive: true });
    const recoveryDirectory = fs.mkdtempSync(
      path.join(recoveryRoot, `${new Date().toISOString().replaceAll(':', '-')}-${revision}-`)
    );

    const databaseFiles = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];
    const movedDatabaseFiles = [];
    let uploadsMoved = false;
    let allDatabaseFilesMoved = false;
    let databaseCopyStarted = false;
    let uploadsCopyStarted = false;
    closeDatabase();
    try {
      for (const filePath of databaseFiles) {
        if (fs.existsSync(filePath)) {
          const recoveryFile = path.join(recoveryDirectory, path.basename(filePath));
          fs.renameSync(filePath, recoveryFile);
          movedDatabaseFiles.push({ filePath, recoveryFile });
        }
      }
      allDatabaseFilesMoved = true;
      if (fs.existsSync(uploadDirectory)) {
        fs.renameSync(uploadDirectory, path.join(recoveryDirectory, 'uploads'));
        uploadsMoved = true;
      }

      fs.mkdirSync(path.dirname(databasePath), { recursive: true });
      databaseCopyStarted = true;
      fs.copyFileSync(stagingDatabase, databasePath);
      uploadsCopyStarted = true;
      fs.cpSync(stagingUploads, uploadDirectory, { recursive: true });

      const result = getDatabase().prepare('PRAGMA integrity_check').get();
      if (result.integrity_check !== 'ok') {
        throw new Error('SQLite integrity check failed');
      }
      const { migrate } = require('../db/migrate');
      await migrate();
      return recoveryDirectory;
    } catch (error) {
      closeDatabase();
      let rollbackError = null;
      try {
        if (allDatabaseFilesMoved && databaseCopyStarted) {
          for (const filePath of databaseFiles) {
            fs.rmSync(filePath, { force: true });
          }
        }
        if (uploadsCopyStarted) {
          fs.rmSync(uploadDirectory, { recursive: true, force: true });
        }
        for (const { filePath, recoveryFile } of movedDatabaseFiles.reverse()) {
          if (!fs.existsSync(filePath) && fs.existsSync(recoveryFile)) {
            fs.renameSync(recoveryFile, filePath);
          }
        }
        const recoveryUploads = path.join(recoveryDirectory, 'uploads');
        if (uploadsMoved && !fs.existsSync(uploadDirectory) && fs.existsSync(recoveryUploads)) {
          fs.renameSync(recoveryUploads, uploadDirectory);
        }
      } catch (restoreError) {
        rollbackError = restoreError;
      }
      try {
        getDatabase();
      } catch (reopenError) {
        rollbackError ||= reopenError;
      }
      if (rollbackError) {
        throw new SyncError(
          'LOCAL_RESTORE_FAILED',
          `替换本机数据失败，恢复副本保留在 ${recoveryDirectory}。`,
          500
        );
      }
      throw new SyncError('LOCAL_RESTORE_FAILED', '替换本机数据失败，原数据已恢复。', 500);
    }
  }

  async function pull(inspected) {
    const { client, configuration, remote, currentTargetHash } = inspected;
    if (!remote) {
      throw new SyncError('REMOTE_EMPTY', '对象存储中还没有可下载的同步数据。', 404);
    }

    const manifest = remote.manifest;
    const dataDirectory = paths.dataDirectory();
    fs.mkdirSync(dataDirectory, { recursive: true });
    const stagingDirectory = fs.mkdtempSync(path.join(dataDirectory, '.sync-download-'));
    const stagingDatabase = path.join(stagingDirectory, 'love-museum.sqlite');
    const stagingUploads = path.join(stagingDirectory, 'uploads');
    fs.mkdirSync(stagingUploads);

    try {
      await downloadObject(client, configuration, manifest.database, stagingDatabase);
      for (const file of manifest.files) {
        const destination = path.join(stagingUploads, ...file.path.split('/'));
        await downloadObject(client, configuration, file, destination);
      }

      const stagedDatabase = new DatabaseSync(stagingDatabase, { readOnly: true });
      let stagedInfo;
      try {
        const integrity = stagedDatabase.prepare('PRAGMA integrity_check').get();
        if (integrity.integrity_check !== 'ok') {
          throw new SyncError('INVALID_REMOTE_DATA', '云端数据库完整性校验失败。');
        }
        stagedInfo = await localSnapshotInfo(stagedDatabase, stagingUploads);
      } finally {
        stagedDatabase.close();
      }
      if (stagedInfo.fingerprint !== manifest.dataFingerprint) {
        throw new SyncError('INVALID_REMOTE_DATA', '云端快照内容与清单不一致，未替换本机数据。');
      }

      const recoveryDirectory = await replaceLocalData(
        stagingDatabase,
        stagingUploads,
        manifest.revision
      );
      const restored = await localSnapshotInfo(getDatabase(), paths.uploadDirectory());
      const lastSyncedAt = new Date().toISOString();
      saveState({
        targetHash: currentTargetHash,
        remoteRevision: manifest.revision,
        localFingerprint: restored.fingerprint,
        lastSyncedAt,
      });
      return {
        direction: 'download',
        revision: manifest.revision,
        lastSyncedAt,
        recoveryCreated: Boolean(recoveryDirectory),
      };
    } finally {
      fs.rmSync(stagingDirectory, { recursive: true, force: true });
    }
  }

  async function run(direction = 'auto') {
    if (!['auto', 'upload', 'download'].includes(direction)) {
      throw new SyncError('INVALID_DIRECTION', '不支持的同步方向。');
    }
    return exclusive(async () => {
      const configuration = loadConfiguration();
      if (!configuration) {
        throw new SyncError('NOT_CONFIGURED', '请先填写并保存 S3 配置。');
      }
      const inspected = await inspectInternal(configuration);
      try {
        let selectedDirection = direction;
        if (direction === 'auto') {
          if (inspected.status === 'synced') {
            const lastSyncedAt = inspected.state?.targetHash === inspected.currentTargetHash
              && inspected.state?.remoteRevision === inspected.remote.manifest.revision
              && inspected.state?.localFingerprint === inspected.local.fingerprint
              ? inspected.state.lastSyncedAt
              : new Date().toISOString();
            saveState({
              targetHash: inspected.currentTargetHash,
              remoteRevision: inspected.remote.manifest.revision,
              localFingerprint: inspected.local.fingerprint,
              lastSyncedAt,
            });
            return { direction: 'none', lastSyncedAt };
          }
          if (inspected.status === 'conflict') {
            throw new SyncError(
              'SYNC_CONFLICT',
              '本机和云端都存在不同修改，请明确选择保留本机或云端数据。',
              409
            );
          }
          selectedDirection = inspected.status === 'download-needed' ? 'download' : 'upload';
        }
        return selectedDirection === 'download' ? pull(inspected) : push(inspected);
      } finally {
        inspected.client.destroy?.();
      }
    });
  }

  return {
    getPublicConfiguration,
    getStatus,
    run,
    saveConfiguration,
  };
}

module.exports = {
  MANIFEST_KEY,
  SyncError,
  createSyncService,
};
