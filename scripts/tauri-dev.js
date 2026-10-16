const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const nodeExecutable = process.execPath;
const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const backendScript = path.join(projectRoot, 'backend', 'desktop-server.js');
const dataDirectory = path.join(projectRoot, '.tauri-dev-data');
const developmentPorts = [3000, 38489];

function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }

  child.kill('SIGTERM');
}

function stopStaleWindowsServers() {
  if (process.platform !== 'win32') {
    return;
  }

  const escapedRoot = projectRoot.replace(/'/g, "''");
  const script = `
    $projectRoot = '${escapedRoot}'
    $ports = @(${developmentPorts.join(', ')})
    $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $ports -contains $_.LocalPort }

    foreach ($processId in ($connections.OwningProcess | Sort-Object -Unique)) {
      $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
      if ($process -and $process.CommandLine -and $process.CommandLine.Contains($projectRoot)) {
        & taskkill.exe /PID $processId /T /F | Out-Null
      }
    }
  `;

  spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { stdio: 'inherit' }
  );
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function ensureDevelopmentPortsAreAvailable() {
  stopStaleWindowsServers();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const availability = await Promise.all(developmentPorts.map(canListen));
    if (availability.every(Boolean)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Development ports ${developmentPorts.join(' and ')} are still in use. ` +
    'Close the previous Evermore development window and try again.'
  );
}

const sharedEnvironment = {
  ...process.env,
  BACKEND_ORIGIN: 'http://127.0.0.1:38489',
  LOVE_MUSEUM_DATA_DIR: dataDirectory,
  DB_PATH: path.join(dataDirectory, 'love-museum.sqlite'),
  UPLOAD_DIR: path.join(dataDirectory, 'uploads'),
  JWT_SECRET: process.env.JWT_SECRET || 'tauri-development-only-secret',
  ENABLE_S3_SYNC: 'true',
  NEXT_PUBLIC_DESKTOP_BUILD: 'true',
  PORT: '38489',
};

let shuttingDown = false;
let backend;
let frontend;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  stopProcessTree(backend);
  stopProcessTree(frontend);
  setTimeout(() => process.exit(exitCode), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => shutdown(0));
}
process.on('exit', () => {
  if (!shuttingDown) {
    stopProcessTree(backend);
    stopProcessTree(frontend);
  }
});

async function main() {
  await ensureDevelopmentPortsAreAvailable();

  backend = spawn(nodeExecutable, [backendScript], {
    cwd: projectRoot,
    env: sharedEnvironment,
    stdio: 'inherit',
  });

  frontend = spawn(nodeExecutable, [nextCli, 'dev', '-H', '127.0.0.1', '-p', '3000'], {
    cwd: projectRoot,
    env: {
      ...sharedEnvironment,
      DESKTOP_BUILD: 'false',
      NEXT_DIST_DIR: '.next-tauri-dev',
      NEXT_PUBLIC_API_URL: '/api',
    },
    stdio: 'inherit',
  });

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
}

main().catch((error) => {
  console.error(`Unable to start Evermore development services: ${error.message}`);
  shutdown(1);
});
