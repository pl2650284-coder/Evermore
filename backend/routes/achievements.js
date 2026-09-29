const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../utils');

// 获取用户的情侣 ID
async function getCoupleId(userId) {
  const [couples] = await pool.query(
    'SELECT id FROM couples WHERE user_id = ?',
    [userId]
  );
  return couples.length > 0 ? couples[0].id : null;
}

// 获取成就列表
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ achievements: [] });
    }

    const [achievements] = await pool.query(
      'SELECT * FROM achievements WHERE couple_id = ? ORDER BY unlocked_at DESC',
      [coupleId]
    );

    res.json({ achievements });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: '获取成就失败' });
  }
});

// 解锁成就
router.post('/unlock', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { achievement_type, title, description } = req.body;

    if (!achievement_type || !title) {
      return res.status(400).json({ error: '请填写成就类型和标题' });
    }

    // 检查是否已解锁该成就
    const [existing] = await pool.query(
      'SELECT * FROM achievements WHERE couple_id = ? AND achievement_type = ?',
      [coupleId, achievement_type]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '该成就已经解锁过了' });
    }

    const achievementId = generateId();

    await pool.query(
      `INSERT INTO achievements (id, couple_id, achievement_type, title, description) 
       VALUES (?, ?, ?, ?, ?)`,
      [achievementId, coupleId, achievement_type, title, description]
    );

    const [achievements] = await pool.query('SELECT * FROM achievements WHERE id = ?', [achievementId]);

    res.status(201).json({ achievement: achievements[0] });
  } catch (error) {
    console.error('Unlock achievement error:', error);
    res.status(500).json({ error: '解锁成就失败' });
  }
});

module.exports = router;
