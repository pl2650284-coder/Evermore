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

// 获取愿望清单
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);

    if (!coupleId) {
      return res.json({ items: [] });
    }

    const [items] = await pool.query(
      'SELECT * FROM wishlist WHERE couple_id = ? ORDER BY created_at DESC',
      [coupleId]
    );

    // 添加 completed 字段供前端使用
    const itemsWithCompleted = items.map((item) => ({
      ...item,
      completed: item.status === 'completed',
    }));

    res.json({ items: itemsWithCompleted });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ error: '获取愿望清单失败' });
  }
});

// 创建愿望清单项目
router.post('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { title, description, category, priority, target_date } = req.body;

    if (!title) {
      return res.status(400).json({ error: '请填写愿望标题' });
    }

    const itemId = generateId();

    await pool.query(
      `INSERT INTO wishlist (id, couple_id, title, description, category, priority, target_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [itemId, coupleId, title, description, category, priority || 'medium', target_date]
    );

    const [items] = await pool.query('SELECT * FROM wishlist WHERE id = ?', [itemId]);

    // 返回时添加 completed 字段
    const newItem = {
      ...items[0],
      completed: items[0].status === 'completed',
    };

    res.status(201).json({ item: newItem });
  } catch (error) {
    console.error('Create wishlist item error:', error);
    res.status(500).json({ error: '创建愿望清单失败' });
  }
});

// 更新愿望清单项目
router.put('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);

    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;
    const { title, description, category, priority, status, target_date, completed, completed_at } = req.body;

    const [existing] = await pool.query(
      'SELECT * FROM wishlist WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '项目不存在或无权访问' });
    }

    // 简单直接处理：只更新 status 和 completed_at
    let newStatus = existing[0].status;
    let newCompletedAt = existing[0].completed_at;

    if (completed === true) {
      newStatus = 'completed';
      newCompletedAt = new Date();
    } else if (completed === false) {
      newStatus = 'pending';
      newCompletedAt = null;
    }

    await pool.query(
      'UPDATE wishlist SET status = ?, completed_at = ? WHERE id = ?',
      [newStatus, newCompletedAt, id]
    );

    const [items] = await pool.query('SELECT * FROM wishlist WHERE id = ?', [id]);

    res.json({
      item: {
        ...items[0],
        completed: items[0].status === 'completed',
      }
    });
  } catch (error) {
    console.error('Update wishlist item error:', error);
    res.status(500).json({ error: '更新愿望清单失败' });
  }
});

// 删除愿望清单项目
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM wishlist WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '项目不存在或无权访问' });
    }

    await pool.query('DELETE FROM wishlist WHERE id = ?', [id]);

    res.json({ message: '愿望已删除' });
  } catch (error) {
    console.error('Delete wishlist item error:', error);
    res.status(500).json({ error: '删除愿望失败' });
  }
});

module.exports = router;
