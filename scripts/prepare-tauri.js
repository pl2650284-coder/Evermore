const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const resourcesRoot = path.join(projectRoot, 'src-tauri', 'resources');
const backendRoot = path.join(projectRoot, 'backend');

function copy(source, destination) {
  fs.cpSync(source, destination, { recursive: true, force: true });
}

function runDesktopBuild() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'build-desktop.js')], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureBackendDependencies() {
  if (fs.existsSync(path.join(backendRoot, 'node_modules', 'express'))) {
    return;
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['install', '--omit=dev', '--prefix', backendRoot], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    console.error('Backend dependencies are required to build the Tauri bundle.');
    process.exit(result.status || 1);
  }
}

function stageResources() {
  const outputDirectory = path.join(projectRoot, 'out');
  if (!fs.existsSync(path.join(outputDirectory, 'index.html'))) {
    throw new Error('The desktop frontend was not generated at out/index.html.');
  }

  ensureBackendDependencies();
  fs.rmSync(resourcesRoot, { recursive: true, force: true });
  fs.mkdirSync(resourcesRoot, { recursive: true });

  copy(outputDirectory, path.join(resourcesRoot, 'out'));

  const stagedBackend = path.join(resourcesRoot, 'backend');
  fs.mkdirSync(stagedBackend, { recursive: true });
  for (const file of ['server.js', 'desktop-server.js', 'utils.js', 'package.json']) {
    copy(path.join(backendRoot, file), path.join(stagedBackend, file));
  }
  for (const directory of ['middleware', 'routes']) {
    copy(path.join(backendRoot, directory), path.join(stagedBackend, directory));
  }
  fs.mkdirSync(path.join(stagedBackend, 'db'), { recursive: true });
  for (const file of ['connection.js', 'migrate.js']) {
    copy(path.join(backendRoot, 'db', file), path.join(stagedBackend, 'db', file));
  }
  copy(path.join(backendRoot, 'node_modules'), path.join(stagedBackend, 'node_modules'));

  const runtimeName = process.platform === 'win32' ? 'node-runtime.exe' : 'node-runtime';
  fs.copyFileSync(process.execPath, path.join(resourcesRoot, runtimeName));
}

runDesktopBuild();
stageResources();
