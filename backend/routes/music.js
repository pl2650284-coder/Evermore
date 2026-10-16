const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);

router.use((req, res, next) => {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    const hostname = new URL(origin).hostname;
    if (hostname === '127.0.0.1' || hostname === 'localhost') return next();
  } catch {
    // Invalid origins are rejected below.
  }
  return res.status(403).json({ error: 'Forbidden origin' });
});

function resolveMusicFile(folder, fileName) {
  const root = path.resolve(folder);
  const file = path.resolve(root, fileName);
  if (path.dirname(file) !== root || !AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase())) {
    const error = new Error('Invalid music file');
    error.status = 400;
    throw error;
  }
  return file;
}

router.get('/library', (req, res) => {
  try {
    const requestedFolder = String(req.query.folder || '');
    if (!requestedFolder) return res.status(400).json({ error: '请选择音乐文件夹。' });
    const folder = path.resolve(requestedFolder);
    if (!fs.statSync(folder).isDirectory()) throw new Error('Not a directory');
    const tracks = fs.readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN', { numeric: true }))
      .map((entry) => ({
        name: path.parse(entry.name).name,
        path: path.join(folder, entry.name),
        url: `/api/music/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(entry.name)}`,
      }));
    return res.json({ folder, tracks });
  } catch {
    return res.status(400).json({ error: '无法读取该音乐文件夹，请重新选择。' });
  }
});

router.get('/file', (req, res) => {
  try {
    const file = resolveMusicFile(String(req.query.folder || ''), String(req.query.name || ''));
    if (!fs.statSync(file).isFile()) throw new Error('Not a file');
    res.set('Cache-Control', 'no-store');
    return res.sendFile(file);
  } catch (error) {
    return res.status(error.status || 404).json({ error: '音乐文件不存在。' });
  }
});

module.exports = router;
