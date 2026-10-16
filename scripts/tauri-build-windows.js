const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const tauriCli = path.join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const generatedConfig = path.join(projectRoot, '.tauri-updater.config.json');
const updateOutput = path.join(projectRoot, 'release-updates');
const version = require(path.join(projectRoot, 'package.json')).version;
const endpoint = process.env.TAURI_UPDATER_ENDPOINT?.trim();
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();

if (Boolean(endpoint) !== Boolean(publicKey)) {
  console.error('TAURI_UPDATER_ENDPOINT and TAURI_UPDATER_PUBLIC_KEY must be provided together.');
  process.exit(1);
}

const args = [tauriCli, 'build', '--target', 'x86_64-pc-windows-msvc', '--bundles', 'nsis'];
const config = { version };

if (endpoint && publicKey) {
  Object.assign(config, {
    bundle: { createUpdaterArtifacts: true },
    plugins: {
      updater: {
        endpoints: [endpoint],
        pubkey: publicKey,
        windows: { installMode: 'passive' },
      },
    },
  });
}
fs.writeFileSync(generatedConfig, JSON.stringify(config, null, 2));
args.push('--config', generatedConfig);

try {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  } else if (endpoint && publicKey) {
    const bundleDirectory = path.join(
      projectRoot,
      'src-tauri',
      'target',
      'x86_64-pc-windows-msvc',
      'release',
      'bundle',
      'nsis'
    );
    const artifactName = fs.readdirSync(bundleDirectory).find((name) =>
      name.endsWith('_' + version + '_x64-setup.exe')
    );
    if (!artifactName) {
      throw new Error('The NSIS installer was not generated for version ' + version + '.');
    }
    const signaturePath = path.join(bundleDirectory, artifactName + '.sig');
    if (!fs.existsSync(signaturePath)) {
      throw new Error('The updater signature was not generated. Set TAURI_SIGNING_PRIVATE_KEY.');
    }

    const releaseDirectory = path.join(updateOutput, version);
    fs.rmSync(updateOutput, { recursive: true, force: true });
    fs.mkdirSync(releaseDirectory, { recursive: true });
    fs.copyFileSync(path.join(bundleDirectory, artifactName), path.join(releaseDirectory, artifactName));
    fs.copyFileSync(signaturePath, path.join(releaseDirectory, artifactName + '.sig'));

    const rootUrl = new URL('.', endpoint).toString();
    const downloadUrl = new URL(
      version + '/' + encodeURIComponent(artifactName),
      rootUrl
    ).toString();
    const latest = {
      version,
      notes: process.env.TAURI_UPDATE_NOTES || '',
      pub_date: new Date().toISOString(),
      platforms: {
        'windows-x86_64-nsis': {
          url: downloadUrl,
          signature: fs.readFileSync(signaturePath, 'utf8').trim(),
        },
      },
    };
    fs.writeFileSync(path.join(updateOutput, 'latest.json'), JSON.stringify(latest, null, 2));
    console.log('Updater files prepared at ' + updateOutput);
  }
} finally {
  fs.rmSync(generatedConfig, { force: true });
}
