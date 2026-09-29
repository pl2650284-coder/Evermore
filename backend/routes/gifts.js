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

// 获取礼物列表
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ gifts: [] });
    }

    const [gifts] = await pool.query(
      'SELECT * FROM gifts WHERE couple_id = ? ORDER BY given_date DESC, created_at DESC',
      [coupleId]
    );

    res.json({ gifts });
  } catch (error) {
    console.error('Get gifts error:', error);
    res.status(500).json({ error: '获取礼物失败' });
  }
});

// 创建礼物
router.post('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    // 兼容两种字段名
    const { name, description, gift_type, occasion, given_date, image_url, is_special,
            title, given_by, given_to, category } = req.body;

    const finalName = name || title;
    const finalGiftType = gift_type || category;
    const finalGivenBy = given_by || '我';
    const finalGivenTo = given_to || 'TA';

    if (!finalName) {
      return res.status(400).json({ error: '请填写礼物名称' });
    }

    const giftId = generateId();

    await pool.query(
      `INSERT INTO gifts (id, couple_id, name, description, gift_type, occasion, given_date, image_url, is_special)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [giftId, coupleId, finalName, description, finalGiftType, occasion, given_date, image_url, is_special || false]
    );

    const [gifts] = await pool.query('SELECT * FROM gifts WHERE id = ?', [giftId]);

    res.status(201).json({ gift: gifts[0] });
  } catch (error) {
    console.error('Create gift error:', error);
    res.status(500).json({ error: '创建礼物失败' });
  }
});

// 更新礼物
router.put('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);

    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;
    // 兼容两种字段名
    const { name, description, gift_type, occasion, given_date, image_url, is_special,
            title, given_by, given_to, category } = req.body;

    const finalName = name || title;
    const finalGiftType = gift_type || category;

    const [existing] = await pool.query(
      'SELECT * FROM gifts WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '礼物不存在或无权访问' });
    }

    await pool.query(
      `UPDATE gifts SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       gift_type = COALESCE(?, gift_type),
       occasion = COALESCE(?, occasion),
       given_date = COALESCE(?, given_date),
       image_url = COALESCE(?, image_url),
       is_special = COALESCE(?, is_special)
       WHERE id = ?`,
      [finalName, description, finalGiftType, occasion, given_date, image_url, is_special, id]
    );

    const [gifts] = await pool.query('SELECT * FROM gifts WHERE id = ?', [id]);

    res.json({ gift: gifts[0] });
  } catch (error) {
    console.error('Update gift error:', error);
    res.status(500).json({ error: '更新礼物失败' });
  }
});

// 删除礼物
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM gifts WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '礼物不存在或无权访问' });
    }

    await pool.query('DELETE FROM gifts WHERE id = ?', [id]);

    res.json({ message: '礼物已删除' });
  } catch (error) {
    console.error('Delete gift error:', error);
    res.status(500).json({ error: '删除礼物失败' });
  }
});

module.exports = router;
