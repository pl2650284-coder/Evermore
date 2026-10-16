const express = require('express');
const { authenticate } = require('../middleware/auth');
const { createMediaStore } = require('../storage/media-store');

const router = express.Router();
const mediaStore = createMediaStore();

router.get('/cache/settings', authenticate, (req, res) => {
  return res.json(mediaStore.cacheStatus());
});

router.put('/cache/settings', authenticate, (req, res) => {
  try {
    return res.json(mediaStore.setCacheLimitBytes(req.body?.limitBytes));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || '保存缓存设置失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const media = await mediaStore.get(req.params.id);
    if (media.contentType) res.type(media.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    return res.sendFile(media.path);
  } catch (error) {
    const status = error.status || 502;
    if (status >= 500) console.error('Read cloud media error:', error);
    return res.status(status).json({ error: '读取云端媒体失败' });
  }
});

module.exports = router;
