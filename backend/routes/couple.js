const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../utils');

// 获取当前用户的情侣空间
router.get('/my', authenticate, async (req, res) => {
  try {
    const [couples] = await pool.query(
      'SELECT * FROM couples WHERE user_id = ?',
      [req.user.id]
    );

    if (couples.length === 0) {
      return res.json({ couple: null });
    }

    res.json({ couple: couples[0] });
  } catch (error) {
    console.error('Get couple error:', error);
    res.status(500).json({ error: '获取情侣空间失败' });
  }
});

// 创建情侣空间
router.post('/', authenticate, async (req, res) => {
  try {
    const { partner1_name, partner2_name, start_date, bio, province, city, district } = req.body;

    if (!partner1_name || !partner2_name || !start_date) {
      return res.status(400).json({ error: '请填写必填字段' });
    }

    // 检查是否已有情侣空间
    const [existing] = await pool.query(
      'SELECT id FROM couples WHERE user_id = ?',
      [req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '已存在情侣空间，请更新而不是创建' });
    }

    const coupleId = generateId();

    await pool.query(
      `INSERT INTO couples (id, user_id, partner1_name, partner2_name, start_date, bio, province, city, district) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [coupleId, req.user.id, partner1_name, partner2_name, start_date, bio, province, city, district]
    );

    const [couples] = await pool.query('SELECT * FROM couples WHERE id = ?', [coupleId]);

    res.status(201).json({ couple: couples[0] });
  } catch (error) {
    console.error('Create couple error:', error);
    res.status(500).json({ error: '创建情侣空间失败' });
  }
});

// 更新情侣空间
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { partner1_name, partner2_name, start_date, hero_image_url, bio, province, city, district } = req.body;

    // 验证权限
    const [existing] = await pool.query(
      'SELECT * FROM couples WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '情侣空间不存在或无权访问' });
    }

    await pool.query(
      `UPDATE couples SET 
       partner1_name = COALESCE(?, partner1_name),
       partner2_name = COALESCE(?, partner2_name),
       start_date = COALESCE(?, start_date),
       hero_image_url = COALESCE(?, hero_image_url),
       bio = COALESCE(?, bio),
       province = COALESCE(?, province),
       city = COALESCE(?, city),
       district = COALESCE(?, district)
       WHERE id = ?`,
      [partner1_name, partner2_name, start_date, hero_image_url, bio, province, city, district, id]
    );

    const [couples] = await pool.query('SELECT * FROM couples WHERE id = ?', [id]);

    res.json({ couple: couples[0] });
  } catch (error) {
    console.error('Update couple error:', error);
    res.status(500).json({ error: '更新情侣空间失败' });
  }
});

module.exports = router;
