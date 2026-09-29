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

// 获取照片列表
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ photos: [] });
    }

    const [photos] = await pool.query(
      'SELECT * FROM photos WHERE couple_id = ? ORDER BY taken_at DESC, created_at DESC',
      [coupleId]
    );

    res.json({ photos });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: '获取照片列表失败' });
  }
});

// 上传照片
router.post('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { url, title, description, taken_at, location, province, city, district, is_favorite } = req.body;

    if (!url) {
      return res.status(400).json({ error: '请提供照片URL' });
    }

    const photoId = generateId();

    await pool.query(
      `INSERT INTO photos (id, couple_id, url, title, description, taken_at, location, province, city, district, is_favorite) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [photoId, coupleId, url, title, description, taken_at, location, province, city, district, is_favorite || false]
    );

    const [photos] = await pool.query('SELECT * FROM photos WHERE id = ?', [photoId]);

    res.status(201).json({ photo: photos[0] });
  } catch (error) {
    console.error('Create photo error:', error);
    res.status(500).json({ error: '创建照片失败' });
  }
});

// 删除照片
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    // 验证权限
    const [existing] = await pool.query(
      'SELECT * FROM photos WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '照片不存在或无权访问' });
    }

    await pool.query('DELETE FROM photos WHERE id = ?', [id]);

    res.json({ message: '照片已删除' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: '删除照片失败' });
  }
});

// 获取标签列表
router.get('/tags', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ tags: [] });
    }

    const [tags] = await pool.query(
      `SELECT DISTINCT pt.tag, COUNT(*) as count 
       FROM photo_tags pt 
       JOIN photos p ON pt.photo_id = p.id 
       WHERE p.couple_id = ? 
       GROUP BY pt.tag 
       ORDER BY count DESC`,
      [coupleId]
    );

    res.json({ tags: tags.map(t => t.tag) });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: '获取标签列表失败' });
  }
});

// 创建标签
router.post('/tags', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { photo_id, tag } = req.body;

    if (!photo_id || !tag) {
      return res.status(400).json({ error: '请提供照片ID和标签' });
    }

    // 验证照片权限
    const [existing] = await pool.query(
      'SELECT * FROM photos WHERE id = ? AND couple_id = ?',
      [photo_id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '照片不存在或无权访问' });
    }

    const tagId = generateId();

    await pool.query(
      'INSERT INTO photo_tags (id, photo_id, tag) VALUES (?, ?, ?)',
      [tagId, photo_id, tag]
    );

    res.status(201).json({ id: tagId, photo_id, tag });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: '创建标签失败' });
  }
});

module.exports = router;
