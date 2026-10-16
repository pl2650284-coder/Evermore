const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { createMediaStore } = require('../storage/media-store');

const router = express.Router();
const uploadDirectory = process.env.UPLOAD_DIR || './uploads';
const mediaStore = createMediaStore();

fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => callback(null, uploadDirectory),
    filename: (req, file, callback) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      callback(null, uniqueName);
    },
  }),
  fileFilter: (req, file, callback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm/;
    const validExtension = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const validMimeType = allowedTypes.test(file.mimetype);
    if (!validExtension || !validMimeType) {
      return callback(new Error('只支持图片和视频文件'));
    }
    return callback(null, true);
  },
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
  },
});

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  try {
    const cloudMedia = await mediaStore.upload(req.file);
    const url = cloudMedia?.url || `/uploads/${req.file.filename}`;
    if (cloudMedia) fs.rmSync(req.file.path, { force: true });

    return res.json({
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      storage: cloudMedia ? 'object' : 'local',
    });
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    console.error('Upload error:', error);
    return res.status(502).json({ error: '上传到对象存储失败，本地临时文件已清理' });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error.message === '只支持图片和视频文件') {
    return res.status(400).json({ error: error.message });
  }
  return next(error);
});

module.exports = router;
