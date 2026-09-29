const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { generateToken, comparePassword, generateId } = require('../utils');
const { authenticateAdmin } = require('../middleware/auth');

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码' });
    }

    // 查找管理员
    const [admins] = await pool.query(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const admin = admins[0];

    // 验证密码
    const isValid = await comparePassword(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成令牌
    const token = generateToken(
      { id: admin.id, username: admin.username, name: admin.name },
      true
    );

    res.json({
      token,
      user: {
        id: admin.id,
        email: admin.username,
        name: admin.name
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: '管理员登录失败' });
  }
});

// 获取统计数据
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [coupleCount] = await pool.query('SELECT COUNT(*) as count FROM couples');
    const [photoCount] = await pool.query('SELECT COUNT(*) as count FROM photos');
    const [eventCount] = await pool.query('SELECT COUNT(*) as count FROM timeline_events');

    res.json({
      stats: {
        userCount: userCount[0].count,
        coupleCount: coupleCount[0].count,
        photoCount: photoCount[0].count,
        eventCount: eventCount[0].count
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 获取所有用户
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.created_at,
              (SELECT COUNT(*) FROM couples c WHERE c.user_id = u.id) AS couple_count
       FROM users u
       ORDER BY u.created_at DESC`
    );

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 获取所有情侣
router.get('/couples', authenticateAdmin, async (req, res) => {
  try {
    const [couples] = await pool.query(
      `SELECT c.*, u.email AS user_email, u.name AS user_name,
              (SELECT COUNT(*) FROM photos p WHERE p.couple_id = c.id) AS photo_count,
              (SELECT COUNT(*) FROM timeline_events e WHERE e.couple_id = c.id) AS event_count
       FROM couples c
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`
    );

    res.json({ couples });
  } catch (error) {
    console.error('Get couples error:', error);
    res.status(500).json({ error: '获取情侣列表失败' });
  }
});

// 删除用户
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    res.json({ message: '用户已删除' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 删除情侣
router.delete('/couples/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM couples WHERE id = ?', [id]);
    
    res.json({ message: '情侣已删除' });
  } catch (error) {
    console.error('Delete couple error:', error);
    res.status(500).json({ error: '删除情侣失败' });
  }
});

module.exports = router;
