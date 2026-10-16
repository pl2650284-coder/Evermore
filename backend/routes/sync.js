const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getDatabase } = require('../db/connection');
const { SyncError, createSyncService } = require('../sync/s3-sync');

const router = express.Router();
const syncService = createSyncService();

function authenticateOrDesktopBootstrap(req, res, next) {
  if (req.app.locals.enableS3Sync !== true) {
    return res.status(404).json({ error: '对象存储同步仅在桌面版中可用' });
  }
  const hasUsers = getDatabase().prepare('SELECT 1 FROM users LIMIT 1').get();
  if (!hasUsers) {
    req.syncBootstrap = true;
    return next();
  }
  return authenticate(req, res, next);
}

function requireLocalOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    const { hostname } = new URL(origin);
    if (['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
      return next();
    }
  } catch {
    // 统一返回禁止访问，不暴露解析细节。
  }
  return res.status(403).json({ error: 'Forbidden origin' });
}

function handleError(error, res) {
  if (error instanceof SyncError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error('Sync error:', error);
  return res.status(500).json({ error: '同步服务发生未知错误', code: 'SYNC_FAILED' });
}

router.use(requireLocalOrigin, authenticateOrDesktopBootstrap);

router.get('/s3/config', async (req, res) => {
  try {
    res.json({ configuration: syncService.getPublicConfiguration() });
  } catch (error) {
    handleError(error, res);
  }
});

router.put('/s3/config', async (req, res) => {
  try {
    const configuration = await syncService.saveConfiguration(req.body || {});
    res.json({ configuration });
  } catch (error) {
    handleError(error, res);
  }
});

router.get('/status', async (req, res) => {
  try {
    res.json(await syncService.getStatus());
  } catch (error) {
    handleError(error, res);
  }
});

router.post('/run', async (req, res) => {
  try {
    const requestedDirection = req.body?.direction || 'auto';
    if (req.syncBootstrap && requestedDirection === 'upload') {
      throw new SyncError(
        'RESTORE_ONLY',
        '新设备初始化期间只能从云端恢复；请先注册或登录后再上传本机数据。',
        403
      );
    }
    const direction = req.syncBootstrap ? 'download' : requestedDirection;
    res.json(await syncService.run(direction));
  } catch (error) {
    handleError(error, res);
  }
});

module.exports = router;
