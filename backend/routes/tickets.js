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

// 获取门票列表
router.get('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ tickets: [] });
    }

    const [tickets] = await pool.query(
      'SELECT * FROM tickets WHERE couple_id = ? ORDER BY event_date DESC, created_at DESC',
      [coupleId]
    );

    res.json({ tickets });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: '获取门票失败' });
  }
});

// 创建门票
router.post('/', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    // 兼容两种字段名
    const { event_name, venue, event_date, ticket_type, seat_info, image_url, notes,
            title, location, category, description } = req.body;

    const finalEventName = event_name || title;
    const finalVenue = venue || location;
    const finalTicketType = ticket_type || category;
    const finalNotes = notes || description;

    if (!finalEventName || !event_date) {
      return res.status(400).json({ error: '请填写活动名称和日期' });
    }

    const ticketId = generateId();

    await pool.query(
      `INSERT INTO tickets (id, couple_id, event_name, venue, event_date, ticket_type, seat_info, image_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, coupleId, finalEventName, finalVenue, event_date, finalTicketType, seat_info, image_url, finalNotes]
    );

    const [tickets] = await pool.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);

    res.status(201).json({ ticket: tickets[0] });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: '创建门票失败' });
  }
});

// 更新门票
router.put('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);

    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;
    // 兼容两种字段名
    const { event_name, venue, event_date, ticket_type, seat_info, image_url, notes,
            title, location, category, description } = req.body;

    const finalEventName = event_name || title;
    const finalVenue = venue || location;
    const finalTicketType = ticket_type || category;
    const finalNotes = notes || description;

    const [existing] = await pool.query(
      'SELECT * FROM tickets WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '门票不存在或无权访问' });
    }

    await pool.query(
      `UPDATE tickets SET
       event_name = COALESCE(?, event_name),
       venue = COALESCE(?, venue),
       event_date = COALESCE(?, event_date),
       ticket_type = COALESCE(?, ticket_type),
       seat_info = COALESCE(?, seat_info),
       image_url = COALESCE(?, image_url),
       notes = COALESCE(?, notes)
       WHERE id = ?`,
      [finalEventName, finalVenue, event_date, finalTicketType, seat_info, image_url, finalNotes, id]
    );

    const [tickets] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);

    res.json({ ticket: tickets[0] });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: '更新门票失败' });
  }
});

// 删除门票
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM tickets WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '门票不存在或无权访问' });
    }

    await pool.query('DELETE FROM tickets WHERE id = ?', [id]);

    res.json({ message: '门票已删除' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ error: '删除门票失败' });
  }
});

module.exports = router;
