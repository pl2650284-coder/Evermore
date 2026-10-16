const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const buildScript = path.resolve(__dirname, '..', 'tauri-build-windows.js');
const version = '1.2.3';
const installer = 'Evermore_' + version + '_x64-setup.exe';

function runBuild(t, files, signed = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'love-museum-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(buildScript, path.join(root, 'scripts', 'tauri-build-windows.js'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version }));

  const cli = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(cli, `
    require('node:fs').copyFileSync(
      process.argv[process.argv.indexOf('--config') + 1], 'build-config.json'
    );
  `);

  const bundle = path.join(root, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'nsis');
  fs.mkdirSync(bundle, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(bundle, name), content);
  }

  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'tauri-build-windows.js')], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      TAURI_UPDATER_ENDPOINT: signed ? 'https://updates.example.com/app/latest.json' : '',
      TAURI_UPDATER_PUBLIC_KEY: signed ? 'test-public-key' : '',
      TAURI_UPDATE_NOTES: '更新说明',
    },
  });
  assert.ifError(result.error);
  assert.equal(fs.existsSync(path.join(root, '.tauri-updater.config.json')), false);
  return { root, result };
}

test('publishes the current Tauri 2 installer and signature instead of stale artifacts', (t) => {
  const { root, result } = runBuild(t, {
    'Love Museum_1.0.0_x64-setup.exe': 'old installer',
    'Love Museum_1.0.0_x64-setup.exe.sig': 'old signature',
    'Love Museum_1.0.0_x64-setup.nsis.zip': 'old updater',
    'Love Museum_1.0.0_x64-setup.nsis.zip.sig': 'old signature',
    [installer]: 'current installer',
    [installer + '.sig']: 'current signature\n',
  });
  assert.equal(result.status, 0, result.stderr);

  const output = path.join(root, 'release-updates');
  assert.deepEqual(fs.readdirSync(path.join(output, version)).sort(), [installer, installer + '.sig'].sort());
  assert.equal(fs.readFileSync(path.join(output, version, installer), 'utf8'), 'current installer');
  assert.equal(fs.readFileSync(path.join(output, version, installer + '.sig'), 'utf8'), 'current signature\n');
  const latest = JSON.parse(fs.readFileSync(path.join(output, 'latest.json'), 'utf8'));
  assert.equal(latest.version, version);
  assert.equal(latest.notes, '更新说明');
  assert.deepEqual(latest.platforms['windows-x86_64-nsis'], {
    url: 'https://updates.example.com/app/1.2.3/Evermore_1.2.3_x64-setup.exe',
    signature: 'current signature',
  });
  const config = JSON.parse(fs.readFileSync(path.join(root, 'build-config.json'), 'utf8'));
  assert.equal(config.bundle.createUpdaterArtifacts, true);
});

test('rejects a current installer without its updater signature', (t) => {
  const { root, result } = runBuild(t, { [installer]: 'current installer' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /The updater signature was not generated/);
  assert.equal(fs.existsSync(path.join(root, 'release-updates')), false);
});

test('rejects stale installers when the current version is missing', (t) => {
  const { root, result } = runBuild(t, {
    'Love Museum_1.0.0_x64-setup.exe': 'old installer',
    'Love Museum_1.0.0_x64-setup.exe.sig': 'old signature',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /The NSIS installer was not generated for version 1\.2\.3/);
  assert.equal(fs.existsSync(path.join(root, 'release-updates')), false);
});

test('unsigned builds do not require updater artifacts', (t) => {
  const { root, result } = runBuild(t, {}, false);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, 'release-updates')), false);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'build-config.json'), 'utf8'));
  assert.deepEqual(config, { version });
});
