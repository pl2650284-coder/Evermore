const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const nodeExecutable = process.execPath;
const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const backendScript = path.join(projectRoot, 'backend', 'desktop-server.js');
const dataDirectory = path.join(projectRoot, '.tauri-dev-data');

const sharedEnvironment = {
  ...process.env,
  BACKEND_ORIGIN: 'http://127.0.0.1:38489',
  LOVE_MUSEUM_DATA_DIR: dataDirectory,
  DB_PATH: path.join(dataDirectory, 'love-museum.sqlite'),
  UPLOAD_DIR: path.join(dataDirectory, 'uploads'),
  JWT_SECRET: process.env.JWT_SECRET || 'tauri-development-only-secret',
  PORT: '38489',
};

const backend = spawn(nodeExecutable, [backendScript], {
  cwd: projectRoot,
  env: sharedEnvironment,
  stdio: 'inherit',
});

const frontend = spawn(nodeExecutable, [nextCli, 'dev', '-p', '3000'], {
  cwd: projectRoot,
  env: {
    ...sharedEnvironment,
    DESKTOP_BUILD: 'false',
    NEXT_PUBLIC_API_URL: '/api',
  },
  stdio: 'inherit',
});

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  backend.kill();
  frontend.kill();
  setTimeout(() => process.exit(exitCode), 250);
}

backend.once('exit', (code) => {
  if (!shuttingDown) {
    shutdown(code || 1);
  }
});

frontend.once('exit', (code) => {
  if (!shuttingDown) {
    shutdown(code || 0);
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  if (!shuttingDown) {
    backend.kill();
    frontend.kill();
  }
});
