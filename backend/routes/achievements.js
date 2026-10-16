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

function serializeAchievement(achievement) {
  return { ...achievement, is_custom: Boolean(achievement.is_custom) };
}

function definitionError({ title, description, icon }) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 80) {
    return '请填写 1 至 80 字的成就标题';
  }
  if (description != null && (typeof description !== 'string' || description.length > 500)) {
    return '成就说明不能超过 500 字';
  }
  if (typeof icon !== 'string' || !icon.trim() || icon.length > 16) {
    return '请选择有效的成就图标';
  }
}

// 获取成就列表
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ achievements: [] });
    }

    const [achievements] = await pool.query(
      'SELECT * FROM achievements WHERE couple_id = ? ORDER BY unlocked_at DESC, rowid DESC',
      [coupleId]
    );

    res.json({ achievements: achievements.map(serializeAchievement) });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: '获取成就失败' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    if (!coupleId) return res.status(400).json({ error: '请先创建情侣空间' });

    const { title, description = null, icon = '🏆' } = req.body || {};
    const error = definitionError({ title, description, icon });
    if (error) return res.status(400).json({ error });

    const id = generateId();
    await pool.query(
      `INSERT INTO achievements (id, couple_id, achievement_type, title, description, icon, is_custom, unlocked_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NULL)`,
      [id, coupleId, `custom_${id}`, title.trim(), description?.trim() || null, icon.trim()]
    );
    const [achievements] = await pool.query('SELECT * FROM achievements WHERE id = ?', [id]);
    res.status(201).json({ achievement: serializeAchievement(achievements[0]) });
  } catch (error) {
    console.error('Create achievement error:', error);
    res.status(500).json({ error: '创建成就失败' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    const [existing] = await pool.query(
      'SELECT * FROM achievements WHERE id = ? AND couple_id = ? AND is_custom = 1',
      [req.params.id, coupleId]
    );
    if (!existing.length) return res.status(404).json({ error: '未找到自定义成就' });

    const updates = req.body || {};
    const definition = { ...existing[0], ...updates };
    const error = definitionError(definition);
    if (error) return res.status(400).json({ error });
    if (updates.unlocked !== undefined && typeof updates.unlocked !== 'boolean') {
      return res.status(400).json({ error: '完成状态必须是布尔值' });
    }
    const unlockedAt = updates.unlocked === undefined
      ? existing[0].unlocked_at
      : updates.unlocked ? existing[0].unlocked_at || new Date().toISOString() : null;

    await pool.query(
      'UPDATE achievements SET title = ?, description = ?, icon = ?, unlocked_at = ? WHERE id = ? AND couple_id = ? AND is_custom = 1',
      [definition.title.trim(), definition.description?.trim() || null, definition.icon.trim(), unlockedAt, req.params.id, coupleId]
    );
    const [achievements] = await pool.query('SELECT * FROM achievements WHERE id = ?', [req.params.id]);
    res.json({ achievement: serializeAchievement(achievements[0]) });
  } catch (error) {
    console.error('Update achievement error:', error);
    res.status(500).json({ error: '更新成就失败' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    const [result] = await pool.query(
      'DELETE FROM achievements WHERE id = ? AND couple_id = ? AND is_custom = 1',
      [req.params.id, coupleId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: '未找到自定义成就' });
    res.json({ message: '成就已删除' });
  } catch (error) {
    console.error('Delete achievement error:', error);
    res.status(500).json({ error: '删除成就失败' });
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

    res.status(201).json({ achievement: serializeAchievement(achievements[0]) });
  } catch (error) {
    console.error('Unlock achievement error:', error);
    res.status(500).json({ error: '解锁成就失败' });
  }
});

module.exports = router;
