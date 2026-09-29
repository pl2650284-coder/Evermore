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

// 获取时间轴事件
router.get('/events', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.json({ events: [] });
    }

    const [events] = await pool.query(
      'SELECT * FROM timeline_events WHERE couple_id = ? ORDER BY event_date DESC',
      [coupleId]
    );

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: '获取时间轴事件失败' });
  }
});

// 创建时间轴事件
router.post('/events', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { title, description, event_date, location, province, city, district, image_url, event_type } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({ error: '请填写标题和日期' });
    }

    const eventId = generateId();

    await pool.query(
      `INSERT INTO timeline_events (id, couple_id, title, description, event_date, location, province, city, district, image_url, event_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, coupleId, title, description, event_date, location, province, city, district, image_url, event_type || 'memory']
    );

    const [events] = await pool.query('SELECT * FROM timeline_events WHERE id = ?', [eventId]);

    res.status(201).json({ event: events[0] });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: '创建时间轴事件失败' });
  }
});

// 更新时间轴事件
router.put('/events/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;
    const { title, description, event_date, location, province, city, district, image_url, event_type } = req.body;

    // 验证权限
    const [existing] = await pool.query(
      'SELECT * FROM timeline_events WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '事件不存在或无权访问' });
    }

    await pool.query(
      `UPDATE timeline_events SET 
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       event_date = COALESCE(?, event_date),
       location = COALESCE(?, location),
       province = COALESCE(?, province),
       city = COALESCE(?, city),
       district = COALESCE(?, district),
       image_url = COALESCE(?, image_url),
       event_type = COALESCE(?, event_type)
       WHERE id = ?`,
      [title, description, event_date, location, province, city, district, image_url, event_type, id]
    );

    const [events] = await pool.query('SELECT * FROM timeline_events WHERE id = ?', [id]);

    res.json({ event: events[0] });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: '更新时间轴事件失败' });
  }
});

// 删除时间轴事件
router.delete('/events/:id', authenticate, async (req, res) => {
  try {
    const coupleId = await getCoupleId(req.user.id);
    
    if (!coupleId) {
      return res.status(400).json({ error: '请先创建情侣空间' });
    }

    const { id } = req.params;

    // 验证权限
    const [existing] = await pool.query(
      'SELECT * FROM timeline_events WHERE id = ? AND couple_id = ?',
      [id, coupleId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '事件不存在或无权访问' });
    }

    await pool.query('DELETE FROM timeline_events WHERE id = ?', [id]);

    res.json({ message: '事件已删除' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: '删除时间轴事件失败' });
  }
});

module.exports = router;
