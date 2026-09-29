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

// 获取时光胶囊列表
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ capsules: [] });
    }

    const [capsules] = await pool.query(
      'SELECT * FROM capsules WHERE couple_id = ? ORDER BY unlock_date DESC',
      [coupleId]
    );

    res.json({ capsules });
  } catch (error) {
    console.error('Get capsules error:', error);
    res.status(500).json({ error: '获取时光胶囊失败' });
  }
});

// 创建时光胶囊
router.post('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { title, content, capsule_type, unlock_date } = req.body;

    if (!title || !unlock_date) {
      return res.status(400).json({ error: '请填写标题和解锁日期' });
    }

    const capsuleId = generateId();

    await pool.query(
      `INSERT INTO capsules (id, couple_id, title, content, capsule_type, unlock_date) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [capsuleId, coupleId, title, content, capsule_type || 'text', unlock_date]
    );

    const [capsules] = await pool.query('SELECT * FROM capsules WHERE id = ?', [capsuleId]);

    res.status(201).json({ capsule: capsules[0] });
  } catch (error) {
    console.error('Create capsule error:', error);
    res.status(500).json({ error: '创建时光胶囊失败' });
  }
});

// 更新时光胶囊
router.put('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;
    const { title, content, capsule_type, unlock_date } = req.body;

    const [existing] = await pool.query(
      'SELECT * FROM capsules WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '时光胶囊不存在或无权访问' });
    }

    await pool.query(
      `UPDATE capsules SET 
       title = COALESCE(?, title),
       content = COALESCE(?, content),
       capsule_type = COALESCE(?, capsule_type),
       unlock_date = COALESCE(?, unlock_date)
       WHERE id = ?`,
      [title, content, capsule_type, unlock_date, id]
    );

    const [capsules] = await pool.query('SELECT * FROM capsules WHERE id = ?', [id]);

    res.json({ capsule: capsules[0] });
  } catch (error) {
    console.error('Update capsule error:', error);
    res.status(500).json({ error: '更新时光胶囊失败' });
  }
});

// 删除时光胶囊
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM capsules WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '时光胶囊不存在或无权访问' });
    }

    await pool.query('DELETE FROM capsules WHERE id = ?', [id]);

    res.json({ message: '时光胶囊已删除' });
  } catch (error) {
    console.error('Delete capsule error:', error);
    res.status(500).json({ error: '删除时光胶囊失败' });
  }
});

// 解锁时光胶囊
router.post('/:id/unlock', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM capsules WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '时光胶囊不存在或无权访问' });
    }

    const capsule = existing[0];

    // 检查是否已解锁
    if (capsule.is_opened) {
      return res.status(400).json({ error: '时光胶囊已经解锁过了' });
    }

    // 检查解锁日期
    const now = new Date();
    const unlockDate = new Date(capsule.unlock_date);
    
    if (now < unlockDate) {
      return res.status(400).json({ error: '还没到解锁日期呢，再等等吧~' });
    }

    // 解锁胶囊
    await pool.query(
      'UPDATE capsules SET is_opened = TRUE, opened_at = NOW() WHERE id = ?',
      [id]
    );

    const [capsules] = await pool.query('SELECT * FROM capsules WHERE id = ?', [id]);

    res.json({ capsule: capsules[0] });
  } catch (error) {
    console.error('Unlock capsule error:', error);
    res.status(500).json({ error: '解锁时光胶囊失败' });
  }
});

module.exports = router;
