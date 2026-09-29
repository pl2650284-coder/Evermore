const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.UPLOAD_DIR) {
  process.env.UPLOAD_DIR = path.join(__dirname, 'uploads');
}

const express = require('express');
const cors = require('cors');
const { testConnection } = require('./db/connection');
const { migrate } = require('./db/migrate');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const coupleRoutes = require('./routes/couple');
const timelineRoutes = require('./routes/timeline');
const photosRoutes = require('./routes/photos');
const wishlistRoutes = require('./routes/wishlist');
const capsulesRoutes = require('./routes/capsules');
const achievementsRoutes = require('./routes/achievements');
const lettersRoutes = require('./routes/letters');
const giftsRoutes = require('./routes/gifts');
const ticketsRoutes = require('./routes/tickets');
const uploadRoutes = require('./routes/upload');

function createApp({ frontendDir } = {}) {
  const app = express();

  if (frontendDir) {
    app.use((req, res, next) => {
      const origin = req.get('origin');
      if (origin && origin !== `http://${req.get('host')}`) {
        return res.status(403).json({ error: 'Forbidden origin' });
      }
      return next();
    });
  } else {
    app.use(cors());
  }
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(process.env.UPLOAD_DIR));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '服务器运行正常' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/couple', coupleRoutes);
  app.use('/api/timeline', timelineRoutes);
  app.use('/api/photos', photosRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/capsules', capsulesRoutes);
  app.use('/api/achievements', achievementsRoutes);
  app.use('/api/letters', lettersRoutes);
  app.use('/api/gifts', giftsRoutes);
  app.use('/api/tickets', ticketsRoutes);
  app.use('/api/upload', uploadRoutes);

  if (frontendDir) {
    app.use(express.static(frontendDir));
  }

  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: '服务器内部错误' });
  });

  app.use((req, res) => {
    const isServiceRequest = req.path.startsWith('/api/') || req.path.startsWith('/uploads/');
    if (frontendDir && !isServiceRequest && req.accepts('html')) {
      return res.status(404).sendFile(path.join(frontendDir, '404.html'));
    }

    return res.status(404).json({ error: 'Not found' });
  });

  return app;
}

async function startServer(options = {}) {
  const port = options.port ?? Number(process.env.PORT || 3001);
  const host = options.host || process.env.HOST || '127.0.0.1';

  await migrate();

  if (!(await testConnection())) {
    throw new Error('SQLite database is unavailable');
  }

  const app = createApp({ frontendDir: options.frontendDir });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);

    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      const url = `http://${host}:${actualPort}`;

      process.env.PORT = String(actualPort);
      console.log(`Love Museum server running at ${url}`);
      resolve({ app, server, port: actualPort, url });
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
  });
}

module.exports = { createApp, startServer };
