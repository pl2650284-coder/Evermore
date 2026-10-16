const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('custom achievements preserve legacy data and support an isolated, persistent lifecycle', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-achievements-'));
  process.env.DB_PATH = path.join(directory, 'love-museum.sqlite');
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  process.env.JWT_SECRET = 'achievement-test-secret';
  const { startServer } = require('../server');
  const { getDatabase, closeDatabase } = require('../db/connection');
  const { migrate } = require('../db/migrate');
  let { server, url } = await startServer({ port: 0 });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    closeDatabase();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function request(endpoint, method = 'GET', headers = {}, body, status = 200) {
    const response = await fetch(url + endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, status, `${method} ${endpoint}: ${JSON.stringify(result)}`);
    return result;
  }

  async function register(name, withSpace = true) {
    const { token } = await request('/api/auth/register', 'POST', {}, {
      email: `${name}@example.com`, password: 'test-password', name,
    }, 201);
    const headers = { Authorization: `Bearer ${token}` };
    if (withSpace) {
      await request('/api/couple', 'POST', headers, {
        partner1_name: name, partner2_name: 'Partner', start_date: '2026-01-01',
      }, 201);
    }
    return headers;
  }

  const owner = await register('owner');
  const legacy = (await request('/api/achievements/unlock', 'POST', owner, {
    achievement_type: 'first_event', title: '第一个纪念日', description: '添加第一个时间线事件',
  }, 201)).achievement;

  // Recreate the old table shape before checking that migration preserves its rows.
  for (const name of ['icon', 'is_custom']) {
    if (getDatabase().prepare('PRAGMA table_info(achievements)').all().some((column) => column.name === name)) {
      getDatabase().exec(`ALTER TABLE achievements DROP COLUMN ${name}`);
    }
  }
  await migrate();
  await migrate();
  const migrated = (await request('/api/achievements', 'GET', owner)).achievements[0];
  assert.equal(migrated.id, legacy.id);
  assert.equal(migrated.unlocked_at, legacy.unlocked_at);
  assert.equal(migrated.is_custom, false);
  assert.equal(migrated.icon, '🏆');

  await request('/api/achievements', 'POST', {}, { title: '测试' }, 401);
  const noSpace = await register('no-space', false);
  await request('/api/achievements', 'POST', noSpace, { title: '测试' }, 400);
  assert.deepEqual((await request('/api/achievements', 'GET', noSpace)).achievements, []);

  for (const input of [
    {}, { title: '   ' }, { title: 12 }, { title: 'a'.repeat(81) },
    { title: '测试', description: 'a'.repeat(501) }, { title: '测试', icon: 'a'.repeat(17) },
    { title: '测试', description: {} }, { title: '测试', icon: null },
  ]) {
    await request('/api/achievements', 'POST', owner, input, 400);
  }

  const created = (await request('/api/achievements', 'POST', owner, {
    title: ' 一起看日出 ', description: ' 去海边迎接新的一天 ', icon: '🌅',
  }, 201)).achievement;
  assert.equal(created.title, '一起看日出');
  assert.equal(created.description, '去海边迎接新的一天');
  assert.equal(created.icon, '🌅');
  assert.equal(created.is_custom, true);
  assert.equal(created.unlocked_at, null);
  assert.notEqual(created.achievement_type, 'first_event');

  const endpoint = `/api/achievements/${created.id}`;
  const completed = (await request(endpoint, 'PUT', owner, { unlocked: true })).achievement;
  assert.ok(completed.unlocked_at);
  const edited = (await request(endpoint, 'PUT', owner, {
    title: '海边的第一场日出', description: null, icon: '💕',
  })).achievement;
  assert.equal(edited.title, '海边的第一场日出');
  assert.equal(edited.description, null);
  assert.equal(edited.unlocked_at, completed.unlocked_at);
  const repeated = (await request(endpoint, 'PUT', owner, { unlocked: true })).achievement;
  assert.equal(repeated.unlocked_at, completed.unlocked_at);
  const pending = (await request(endpoint, 'PUT', owner, { unlocked: false })).achievement;
  assert.equal(pending.unlocked_at, null);
  await request(endpoint, 'PUT', owner, { unlocked: 'yes' }, 400);
  await request(endpoint, 'PUT', owner, { title: '' }, 400);
  await request(endpoint, 'PUT', owner, { unlocked: true });

  const other = await register('other');
  assert.deepEqual((await request('/api/achievements', 'GET', other)).achievements, []);
  await request(endpoint, 'PUT', other, { title: 'Other title' }, 404);
  await request(endpoint, 'DELETE', other, undefined, 404);
  await request(`/api/achievements/${legacy.id}`, 'PUT', owner, { title: 'Changed' }, 404);
  await request(`/api/achievements/${legacy.id}`, 'DELETE', owner, undefined, 404);

  await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  ({ server, url } = await startServer({ port: 0 }));
  const saved = (await request('/api/achievements', 'GET', owner)).achievements.find((item) => item.id === created.id);
  assert.equal(saved.title, edited.title);
  assert.equal(saved.icon, '💕');
  assert.ok(saved.unlocked_at);
  assert.equal(saved.is_custom, true);

  await request(endpoint, 'DELETE', owner);
  await request(endpoint, 'DELETE', owner, undefined, 404);
  const remaining = (await request('/api/achievements', 'GET', owner)).achievements;
  assert.deepEqual(remaining.map((item) => item.id), [legacy.id]);
  assert.equal(getDatabase().prepare('PRAGMA quick_check').get().quick_check, 'ok');
});
