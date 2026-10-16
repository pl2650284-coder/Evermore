const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApp } = require('../server');

test('music library lists supported local audio files in name order', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-music-test-'));
  fs.writeFileSync(path.join(folder, '02 second.mp3'), 'second');
  fs.writeFileSync(path.join(folder, '01 first.wav'), 'first');
  fs.writeFileSync(path.join(folder, 'notes.txt'), 'ignored');

  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => {
    server.close();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/music/library?folder=${encodeURIComponent(folder)}`);
  assert.equal(response.status, 200);
  const library = await response.json();
  assert.deepEqual(library.tracks.map((track) => track.name), ['01 first', '02 second']);

  const musicResponse = await fetch(`http://127.0.0.1:${port}${library.tracks[0].url}`);
  assert.equal(musicResponse.status, 200);
  assert.equal(await musicResponse.text(), 'first');
});
