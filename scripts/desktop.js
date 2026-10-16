const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const tauriCli = path.join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const executable = path.join(projectRoot, 'src-tauri', 'target', 'debug',
  process.platform === 'win32' ? 'evermore.exe' : 'evermore');
const instanceName = 'love-museum-dev-' + crypto.createHash('sha256')
  .update(process.platform === 'win32' ? projectRoot.toLowerCase() : projectRoot)
  .digest('hex').slice(0, 16);
const address = process.platform === 'win32'
  ? '\\\\.\\pipe\\' + instanceName
  : path.join(os.tmpdir(), instanceName + '.sock');
let cli;
let shuttingDown = false;
let activation;

function windowsProcesses() {
  const quote = (value) => "'" + value.replace(/'/g, "''") + "'";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', String.raw`
    $ErrorActionPreference = 'Stop'
    $root = ${quote(projectRoot)}
    $executable = ${quote(executable)}
    $sessionProcesses = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='evermore.exe'" |
      Where-Object {
        $_.ExecutablePath -eq $executable -or
        ($_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($root) -and
          $_.CommandLine -match 'tauri\.js"?\s+dev(?:\s|$)')
      } | Select-Object ProcessId, ExecutablePath)
    ConvertTo-Json -InputObject $sessionProcesses -Compress
  `], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr.trim());
  }
  return JSON.parse(result.stdout.trim() || '[]');
}

function stopProcess(processId) {
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(processId), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true,
    });
  } else {
    process.kill(processId, 'SIGTERM');
  }
}

function stopCli() {
  const child = cli;
  cli = undefined;
  if (child?.pid && child.exitCode === null) {
    stopProcess(child.pid);
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopCli();
  server.close();
  process.exit(code);
}

function startCli() {
  const child = spawn(process.execPath, [tauriCli, 'dev', ...process.argv.slice(2)], {
    cwd: projectRoot, stdio: 'inherit', windowsHide: true,
  });
  cli = child;
  child.once('error', (error) => {
    console.error(`Unable to start Tauri: ${error.message}`);
    shutdown(1);
  });
  child.once('exit', (code) => {
    if (cli === child) shutdown(code ?? 1);
  });
}

async function activate() {
  if (process.platform === 'win32' &&
      !windowsProcesses().some((item) => item.ExecutablePath?.toLowerCase() === executable.toLowerCase())) {
    return 'Evermore is already starting. Waiting for the desktop window.';
  }
  const healthy = await Promise.all([3000, 38489].map(async (port) => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok && (await response.json()).status === 'ok';
    } catch {
      return false;
    }
  }));
  if (!healthy.every(Boolean)) {
    stopCli();
    startCli();
    return 'Restarting Evermore because its development services stopped.';
  }
  const child = spawn(executable, [], { cwd: projectRoot, stdio: 'ignore', windowsHide: true });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Activation exited with ${code}.`)));
  });
  return 'Opened the existing Evermore window.';
}

const server = net.createServer((socket) => {
  activation ||= activate().finally(() => { activation = undefined; });
  activation.then((message) => socket.end(message), (error) => socket.end(`Unable to open Evermore: ${error.message}`));
  socket.on('error', () => {});
});

async function main(retries = 0) {
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(address, resolve);
    });
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    const socket = net.connect(address);
    socket.setTimeout(15000, () => socket.destroy(new Error('The existing desktop launcher did not respond.')));
    let response = '';
    socket.on('data', (data) => { response += data; });
    await new Promise((resolve, reject) => {
      socket.once('end', resolve);
      socket.once('error', reject);
    }).catch((connectionError) => {
      if (!['ENOENT', 'ECONNREFUSED', 'ECONNRESET'].includes(connectionError.code)) throw connectionError;
      if (process.platform !== 'win32' && connectionError.code === 'ECONNREFUSED') fs.unlinkSync(address);
    });
    if (!response) {
      if (retries >= 20) throw new Error('The previous desktop session is still shutting down.');
      await new Promise((resolve) => setTimeout(resolve, 100));
      return main(retries + 1);
    }
    if (response.startsWith('Unable to open Evermore:')) throw new Error(response);
    if (response) console.log(response);
    return;
  }

  if (process.platform === 'win32') {
    for (const item of windowsProcesses()) stopProcess(item.ProcessId);
  }
  console.log('Starting Evermore development session.');
  startCli();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
if (process.platform === 'win32') process.on('SIGBREAK', () => shutdown(0));
process.on('exit', stopCli);
main().catch((error) => {
  console.error(`Unable to start Evermore: ${error.message}`);
  shutdown(1);
});
