const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { S3Client } = require('@aws-sdk/client-s3');
const { getDatabasePath } = require('../db/connection');

class ObjectStorageError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ObjectStorageError';
    this.code = code;
    this.status = status;
  }
}

function resolveDataDirectory() {
  return path.resolve(
    process.env.LOVE_MUSEUM_DATA_DIR || path.dirname(getDatabasePath())
  );
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ObjectStorageError(
      'CONFIGURATION_UNAVAILABLE',
      '本机密钥不可用，无法读取对象存储配置。',
      500
    );
  }
  return crypto.createHash('sha256').update(`love-museum-s3\0${secret}`).digest();
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
    throw new ObjectStorageError(
      'CONFIGURATION_UNAVAILABLE',
      '无法读取本机对象存储配置，请重新填写并保存。',
      500
    );
  }
}

function loadConfiguration() {
  const filePath = path.join(resolveDataDirectory(), 's3-sync.enc.json');
  if (!fs.existsSync(filePath)) return null;
  return decryptConfiguration(fs.readFileSync(filePath, 'utf8'));
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

module.exports = {
  ObjectStorageError,
  createClient,
  loadConfiguration,
  resolveDataDirectory,
};
