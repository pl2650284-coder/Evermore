const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('desktop API stores memories and uploads in SQLite data directory', async (t) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-test-'));
  const frontendDirectory = path.join(dataDirectory, 'frontend');
  const uploadDirectory = path.join(dataDirectory, 'uploads');
  fs.mkdirSync(frontendDirectory);
  fs.writeFileSync(path.join(frontendDirectory, 'index.html'), '<h1>Evermore</h1>');
  fs.writeFileSync(path.join(frontendDirectory, '404.html'), '<h1>Not found</h1>');
  fs.mkdirSync(path.join(frontendDirectory, 'login'));
  fs.writeFileSync(path.join(frontendDirectory, 'login', 'index.html'), '<h1>Login</h1>');

  process.env.DB_PATH = path.join(dataDirectory, 'love-museum.sqlite');
  process.env.UPLOAD_DIR = uploadDirectory;
  process.env.JWT_SECRET = 'only-for-desktop-api-test';
  process.env.ENABLE_S3_SYNC = 'true';

  const { startServer } = require('../server');
  const { closeDatabase, getDatabase } = require('../db/connection');
  const { server, url } = await startServer({
    host: '127.0.0.1',
    port: 0,
    frontendDir: frontendDirectory,
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    closeDatabase();
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  });

  async function request(endpoint, options = {}) {
    const response = await fetch(`${url}${endpoint}`, options);
    const body = await response.json();
    assert.ok(response.ok, `${endpoint}: ${JSON.stringify(body)}`);
    return body;
  }

  async function expectStatus(endpoint, expectedStatus, options = {}) {
    const response = await fetch(`${url}${endpoint}`, options);
    assert.equal(response.status, expectedStatus, endpoint);
    return response;
  }

  const home = await fetch(url);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Evermore/);

  const loginPage = await fetch(`${url}/login/`);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Login/);

  const forbidden = await fetch(`${url}/api/health`, {
    headers: { Origin: 'https://example.invalid' },
  });
  assert.equal(forbidden.status, 403);
  const bootstrapSyncConfiguration = await request('/api/sync/s3/config');
  assert.equal(bootstrapSyncConfiguration.configuration, null);
  await expectStatus('/api/sync/s3/config', 403, {
    headers: { Origin: 'https://example.invalid' },
  });
  await expectStatus('/api/sync/run', 403, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction: 'upload' }),
  });

  const localSession = await request('/api/auth/local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(localSession.user.email, 'local@love-museum.local');
  assert.ok(localSession.token);

  const registered = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password', name: 'Test' }),
  });
  const headers = {
    Authorization: `Bearer ${registered.token}`,
    'Content-Type': 'application/json',
  };

  await expectStatus('/api/sync/s3/config', 401);
  const syncConfiguration = await request('/api/sync/s3/config', { headers });
  assert.equal(syncConfiguration.configuration, null);

  const loggedIn = await request('/api/auth/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
  });
  assert.equal(loggedIn.user.id, registered.user.id);

  const couple = await request('/api/couple', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      partner1_name: 'A',
      partner2_name: 'B',
      start_date: '2026-09-21',
    }),
  });

  const resumedLocalSession = await request('/api/auth/local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(resumedLocalSession.user.id, registered.user.id);

  const updatedCouple = await request(`/api/couple/${couple.couple.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ bio: 'A local memory space' }),
  });
  assert.equal(updatedCouple.couple.bio, 'A local memory space');

  const currentCouple = await request('/api/couple/my', { headers });
  assert.equal(currentCouple.couple.id, couple.couple.id);

  const createdEvent = await request('/api/timeline/events', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'A day together',
      event_date: '2026-09-21',
      location: '陕西省 西安市 雁塔区',
      province: '陕西省',
      city: '西安市',
      district: '雁塔区',
    }),
  });

  await request(`/api/timeline/events/${createdEvent.event.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ location: 'Home' }),
  });

  const events = await request('/api/timeline/events', { headers });
  assert.equal(events.events.length, 1);
  assert.equal(events.events[0].title, 'A day together');
  assert.equal(events.events[0].location, 'Home');

  const form = new FormData();
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WqMAAAAASUVORK5CYII=',
    'base64'
  );
  form.append('file', new Blob([image], { type: 'image/png' }), 'photo.png');

  await expectStatus('/api/upload', 401, {
    method: 'POST',
    body: form,
  });

  const authenticatedForm = new FormData();
  authenticatedForm.append('file', new Blob([image], { type: 'image/png' }), 'photo.png');

  const upload = await request('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${registered.token}` },
    body: authenticatedForm,
  });
  assert.match(upload.url, /^\/uploads\/[^/]+\.png$/);

  const imageResponse = await fetch(`${url}${upload.url}`);
  assert.equal(imageResponse.status, 200);
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), image);

  const photo = await request('/api/photos', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: upload.url, title: 'Our photo' }),
  });
  getDatabase().prepare(
    `UPDATE photos
     SET created_at = ?, taken_at = ?, province = ?, city = ?, district = ?
     WHERE id = ?`
  ).run('2026-09-22 10:00:00', '2026-09-22', '陕西省', '西安市', '雁塔区', photo.photo.id);
  const photos = await request('/api/photos', { headers });
  assert.equal(photos.photos.length, 1);
  assert.equal(photos.photos[0].url, upload.url);

  const annualReport = await request('/api/report/annual?year=2026', { headers });
  assert.deepEqual(annualReport.report.summary, {
    placeCount: 1,
    provinceCount: 1,
    cityCount: 1,
    photoCount: 1,
    eventCount: 1,
    activeDays: 2,
    activeMonths: 1,
  });
  assert.equal(annualReport.report.monthly[8].eventCount, 1);
  assert.equal(annualReport.report.monthly[8].photoCount, 1);
  assert.equal(annualReport.report.busiestMonth.month, 9);
  assert.deepEqual(annualReport.report.topLocations[0], {
    label: '陕西省 · 西安市 · 雁塔区',
    total: 2,
    eventCount: 1,
    photoCount: 1,
  });
  assert.ok(annualReport.report.availableYears.includes(2026));
  await expectStatus('/api/report/annual?year=invalid', 400, { headers });

  await request('/api/photos/tags', {
    method: 'POST',
    headers,
    body: JSON.stringify({ photo_id: photo.photo.id, tag: 'first-trip' }),
  });
  const tags = await request('/api/photos/tags', { headers });
  assert.deepEqual(tags.tags, ['first-trip']);

  const wishlist = await request('/api/wishlist', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Visit a museum', priority: 'high' }),
  });
  assert.equal(wishlist.item.completed, false);
  const completedWishlist = await request(`/api/wishlist/${wishlist.item.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(completedWishlist.item.completed, true);
  await request(`/api/wishlist/${wishlist.item.id}`, { method: 'DELETE', headers });

  const capsule = await request('/api/capsules', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'A note from the past',
      content: 'Hello',
      unlock_date: '2020-01-01',
    }),
  });
  const unlockedCapsule = await request(`/api/capsules/${capsule.capsule.id}/unlock`, {
    method: 'POST',
    headers,
  });
  assert.equal(unlockedCapsule.capsule.is_opened, 1);
  await request(`/api/capsules/${capsule.capsule.id}`, { method: 'DELETE', headers });

  const achievement = await request('/api/achievements/unlock', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      achievement_type: 'first_event',
      title: 'First event',
      description: 'Created the first event',
    }),
  });
  const achievements = await request('/api/achievements', { headers });
  assert.equal(achievements.achievements[0].id, achievement.achievement.id);

  const letter = await request('/api/letters', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sender: 'A', receiver: 'B', title: 'Hello', content: 'I love you' }),
  });
  const updatedLetter = await request(`/api/letters/${letter.letter.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ title: 'Hello again' }),
  });
  assert.equal(updatedLetter.letter.title, 'Hello again');
  await request(`/api/letters/${letter.letter.id}`, { method: 'DELETE', headers });

  const gift = await request('/api/gifts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'A small gift', given_date: '2026-09-21' }),
  });
  const updatedGift = await request(`/api/gifts/${gift.gift.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ description: 'A thoughtful surprise' }),
  });
  assert.equal(updatedGift.gift.description, 'A thoughtful surprise');
  await request(`/api/gifts/${gift.gift.id}`, { method: 'DELETE', headers });

  const ticket = await request('/api/tickets', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Movie night', event_date: '2026-09-22' }),
  });
  const updatedTicket = await request(`/api/tickets/${ticket.ticket.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ venue: 'Cinema' }),
  });
  assert.equal(updatedTicket.ticket.venue, 'Cinema');
  await request(`/api/tickets/${ticket.ticket.id}`, { method: 'DELETE', headers });

  const adminLogin = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Ghjxxj', password: '123456' }),
  });
  const adminStats = await request('/api/admin/stats', {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
  assert.equal(adminStats.stats.userCount, 2);

  const database = getDatabase();
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users').get().count, 2);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM couples').get().count, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM timeline_events').get().count, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM photos').get().count, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM photo_tags').get().count, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM wishlist').get().count, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM capsules').get().count, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM achievements').get().count, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM letters').get().count, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM gifts').get().count, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM tickets').get().count, 0);
  assert.equal(couple.couple.user_id, registered.user.id);
});
