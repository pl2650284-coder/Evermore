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

// 获取信件列表
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ letters: [] });
    }

    const [letters] = await pool.query(
      'SELECT * FROM letters WHERE couple_id = ? ORDER BY created_at DESC',
      [coupleId]
    );

    res.json({ letters });
  } catch (error) {
    console.error('Get letters error:', error);
    res.status(500).json({ error: '获取信件失败' });
  }
});

// 创建信件
router.post('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);

    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    // 兼容两种字段名
    const { sender, receiver, title, content, letter_type, is_draft, from_partner, to_partner, written_date, image_url } = req.body;

    const finalSender = sender || from_partner;
    const finalReceiver = receiver || to_partner;

    if (!finalSender || !content) {
      return res.status(400).json({ error: '请填写发件人和内容' });
    }

    const letterId = generateId();

    await pool.query(
      `INSERT INTO letters (id, couple_id, sender, receiver, title, content, letter_type, is_draft, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [letterId, coupleId, finalSender, finalReceiver, title, content, letter_type || 'love', is_draft || false, image_url]
    );

    const [letters] = await pool.query('SELECT * FROM letters WHERE id = ?', [letterId]);

    res.status(201).json({ letter: letters[0] });
  } catch (error) {
    console.error('Create letter error:', error);
    res.status(500).json({ error: '创建信件失败' });
  }
});

// 更新信件
router.put('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);

    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;
    // 兼容两种字段名
    const { sender, receiver, title, content, letter_type, is_draft, from_partner, to_partner, written_date, image_url } = req.body;

    const finalSender = sender || from_partner;
    const finalReceiver = receiver || to_partner;

    const [existing] = await pool.query(
      'SELECT * FROM letters WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '信件不存在或无权访问' });
    }

    await pool.query(
      `UPDATE letters SET
       sender = COALESCE(?, sender),
       receiver = COALESCE(?, receiver),
       title = COALESCE(?, title),
       content = COALESCE(?, content),
       letter_type = COALESCE(?, letter_type),
       is_draft = COALESCE(?, is_draft),
       image_url = COALESCE(?, image_url)
       WHERE id = ?`,
      [finalSender, finalReceiver, title, content, letter_type, is_draft, image_url, id]
    );

    const [letters] = await pool.query('SELECT * FROM letters WHERE id = ?', [id]);

    res.json({ letter: letters[0] });
  } catch (error) {
    console.error('Update letter error:', error);
    res.status(500).json({ error: '更新信件失败' });
  }
});

// 删除信件
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM letters WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '信件不存在或无权访问' });
    }

    await pool.query('DELETE FROM letters WHERE id = ?', [id]);

    res.json({ message: '信件已删除' });
  } catch (error) {
    console.error('Delete letter error:', error);
    res.status(500).json({ error: '删除信件失败' });
  }
});

module.exports = router;
