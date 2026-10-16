const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);

async function getCoupleId(userId) {
  const [couples] = await pool.query(
    'SELECT id FROM couples WHERE user_id = ?',
    [userId]
  );
  return couples.length > 0 ? couples[0].id : null;
}

function getMonthIndex(date) {
  const match = String(date || '').match(/^\d{4}-(0[1-9]|1[0-2])/);
  return match ? Number(match[1]) - 1 : -1;
}

function getLocation(record) {
  const parts = [record.province, record.city, record.district]
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const uniqueParts = [...new Set(parts)];
  const location = String(record.location || '').trim();

  if (uniqueParts.length > 0) {
    return {
      key: uniqueParts.join('|'),
      label: uniqueParts.join(' · '),
      province: String(record.province || '').trim(),
      city: String(record.city || '').trim(),
    };
  }

  if (!location) {
    return null;
  }

  return { key: `location:${location}`, label: location, province: '', city: '' };
}

function createEmptyReport(year, availableYears = [year]) {
  return {
    year,
    availableYears,
    summary: {
      placeCount: 0,
      provinceCount: 0,
      cityCount: 0,
      photoCount: 0,
      eventCount: 0,
      activeDays: 0,
      activeMonths: 0,
    },
    monthly: MONTH_LABELS.map((label, index) => ({
      month: index + 1,
      label,
      eventCount: 0,
      photoCount: 0,
      total: 0,
    })),
    topLocations: [],
    busiestMonth: null,
  };
}

router.get('/annual', authenticate, async (req, res) => {
  try {
    const requestedYear = req.query.year ?? new Date().getFullYear();
    const year = Number(requestedYear);

    if (!Number.isInteger(year) || year < 1000 || year > 9999) {
      return res.status(400).json({ error: '年份格式无效' });
    }

    const coupleId = await getCoupleId(req.user.id);
    if (!coupleId) {
      return res.json({ report: createEmptyReport(year) });
    }

    const yearText = String(year);
    const [events] = await pool.query(
      `SELECT id, title, event_date, location, province, city, district
       FROM timeline_events
       WHERE couple_id = ? AND substr(event_date, 1, 4) = ?`,
      [coupleId, yearText]
    );
    const [uploadedPhotos] = await pool.query(
      `SELECT id, title, created_at
       FROM photos
       WHERE couple_id = ? AND substr(created_at, 1, 4) = ?`,
      [coupleId, yearText]
    );
    const [annualPhotoLocations] = await pool.query(
      `SELECT id, title, taken_at, created_at, location, province, city, district
       FROM photos
       WHERE couple_id = ?
         AND substr(COALESCE(NULLIF(taken_at, ''), created_at), 1, 4) = ?`,
      [coupleId, yearText]
    );
    const [eventYears] = await pool.query(
      `SELECT DISTINCT substr(event_date, 1, 4) AS year
       FROM timeline_events
       WHERE couple_id = ? AND length(event_date) >= 4`,
      [coupleId]
    );
    const [photoYears] = await pool.query(
      `SELECT DISTINCT substr(created_at, 1, 4) AS year
       FROM photos
       WHERE couple_id = ? AND length(created_at) >= 4`,
      [coupleId]
    );
    const [photoTakenYears] = await pool.query(
      `SELECT DISTINCT substr(COALESCE(NULLIF(taken_at, ''), created_at), 1, 4) AS year
       FROM photos
       WHERE couple_id = ?`,
      [coupleId]
    );

    const availableYears = [...new Set([
      yearText,
      ...eventYears.map(row => row.year),
      ...photoYears.map(row => row.year),
      ...photoTakenYears.map(row => row.year),
    ])]
      .filter(value => /^\d{4}$/.test(String(value)))
      .map(Number)
      .sort((a, b) => b - a);

    const report = createEmptyReport(year, availableYears);
    const activeDays = new Set();

    for (const event of events) {
      const monthIndex = getMonthIndex(event.event_date);
      if (monthIndex >= 0) {
        report.monthly[monthIndex].eventCount += 1;
      }
      if (event.event_date) activeDays.add(String(event.event_date).slice(0, 10));
    }

    for (const photo of uploadedPhotos) {
      const monthIndex = getMonthIndex(photo.created_at);
      if (monthIndex >= 0) {
        report.monthly[monthIndex].photoCount += 1;
      }
      if (photo.created_at) activeDays.add(String(photo.created_at).slice(0, 10));
    }

    const locations = new Map();
    const provinces = new Set();
    const cities = new Set();

    const addLocation = (record, kind) => {
      const location = getLocation(record);
      if (!location) return;

      const current = locations.get(location.key) || {
        label: location.label,
        total: 0,
        eventCount: 0,
        photoCount: 0,
      };
      current.total += 1;
      current.eventCount += kind === 'event' ? 1 : 0;
      current.photoCount += kind === 'photo' ? 1 : 0;
      locations.set(location.key, current);
      if (location.province) provinces.add(location.province);
      if (location.city) cities.add(location.city);
    };

    events.forEach(event => addLocation(event, 'event'));
    annualPhotoLocations.forEach(photo => addLocation(photo, 'photo'));

    report.monthly.forEach(item => {
      item.total = item.eventCount + item.photoCount;
    });
    report.summary = {
      placeCount: locations.size,
      provinceCount: provinces.size,
      cityCount: cities.size,
      photoCount: uploadedPhotos.length,
      eventCount: events.length,
      activeDays: activeDays.size,
      activeMonths: report.monthly.filter(item => item.total > 0).length,
    };
    report.topLocations = [...locations.values()]
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'zh-CN'))
      .slice(0, 8);
    report.busiestMonth = report.monthly.reduce((busiest, item) => {
      if (item.total === 0) return busiest;
      return !busiest || item.total > busiest.total ? item : busiest;
    }, null);

    return res.json({ report });
  } catch (error) {
    console.error('Get annual report error:', error);
    return res.status(500).json({ error: '获取年度报告失败' });
  }
});

module.exports = router;
