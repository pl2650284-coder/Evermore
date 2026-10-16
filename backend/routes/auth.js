const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { generateToken, hashPassword, comparePassword, generateId } = require('../utils');
const { authenticate } = require('../middleware/auth');

// 桌面版使用透明本机会话。保留用户 ID 仅用于关联现有业务数据，
// 不再要求用户创建或输入登录凭据。
router.post('/local', async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT users.id, users.email, users.name, users.avatar_url ' +
      'FROM users LEFT JOIN couples ON couples.user_id = users.id ' +
      'ORDER BY CASE WHEN couples.id IS NULL THEN 1 ELSE 0 END, users.created_at ASC LIMIT 1'
    );

    let user = users[0];
    if (!user) {
      const userId = generateId();
      const email = 'local@love-museum.local';
      const name = '本机用户';
      const password = await hashPassword(generateId());

      await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)',
        [userId, email, password, name]
      );
      user = { id: userId, email, name, avatar_url: null };
    }

    res.json({
      token: generateToken({ id: user.id, email: user.email, name: user.name }),
      user,
    });
  } catch (error) {
    console.error('Local session error:', error);
    res.status(500).json({ error: '初始化本机会话失败' });
  }
});

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    // 检查邮箱是否已存在
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // 创建用户
    const userId = generateId();
    const hashedPassword = await hashPassword(password);

    await pool.query(
      'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)',
      [userId, email, hashedPassword, name]
    );

    // 生成令牌
    const token = generateToken({ id: userId, email, name });

    res.status(201).json({
      token,
      user: { id: userId, email, name }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请填写邮箱和密码' });
    }

    // 查找用户
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const user = users[0];

    // 验证密码
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 生成令牌
    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 登出
router.post('/logout', (req, res) => {
  res.json({ message: '登出成功' });
});

module.exports = router;
