const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const launcher = path.join(root, 'scripts', 'desktop.js');
const executable = path.join(root, 'src-tauri', 'target', 'debug', 'evermore.exe');
const quote = (value) => "'" + value.replace(/'/g, "''") + "'";

function windows(action = '') {
  const actions = {
    minimize: '[void][DesktopWindow]::ShowWindow($app.MainWindowHandle, 6)',
    hide: '[void][DesktopWindow]::ShowWindow($app.MainWindowHandle, 0)',
    close: '[void]$app.CloseMainWindow()',
    stopBackend: `
      $backendProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$backendPid"
      if (-not $backendProcess.CommandLine.Contains(${quote(path.join(root, 'backend', 'desktop-server.js'))})) {
        throw 'The listener is not this project backend.'
      }
      Stop-Process -Id $backendPid -Force
    `,
  };
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', String.raw`
    $ErrorActionPreference = 'Stop'
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DesktopWindow {
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
}
'@
    $app = Get-Process -Name evermore -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -eq ${quote(executable)} } | Select-Object -First 1
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.LocalPort -in 3000,38489 })
    $frontendPid = ($listeners | Where-Object LocalPort -eq 3000 | Select-Object -First 1).OwningProcess
    $backendPid = ($listeners | Where-Object LocalPort -eq 38489 | Select-Object -First 1).OwningProcess
    ${actions[action] || ''}
    @{
      app = $app.Id
      frontend = $frontendPid
      backend = $backendPid
      visible = ($app -and [DesktopWindow]::IsWindowVisible($app.MainWindowHandle))
      minimized = ($app -and [DesktopWindow]::IsIconic($app.MainWindowHandle))
    } | ConvertTo-Json -Compress
  `], { encoding: 'utf8', windowsHide: true }).trim());
}

function launch() {
  const child = spawn(process.execPath, [launcher], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.output = '';
  child.stdout.on('data', (data) => { child.output += data; });
  child.stderr.on('data', (data) => { child.output += data; });
  return child;
}

async function until(check, message, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(200);
  }
  assert.fail(message);
}

async function ready() {
  await until(async () => {
    try {
      const responses = await Promise.all([3000, 38489].map(async (port) => {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
        return response.ok && (await response.json()).status === 'ok';
      }));
      return responses.every(Boolean) && windows().visible;
    } catch {
      return false;
    }
  }, 'The desktop window and its services did not become ready.');
}

async function repeat() {
  const child = launch();
  await until(() => child.exitCode !== null, 'Repeated launch did not finish.', 15000);
  assert.equal(child.exitCode, 0, child.output);
  return child.output;
}

// Run explicitly: this regression test opens and closes the project's development window.
test('Windows desktop startup lifecycle', { skip: process.platform !== 'win32', timeout: 180000 }, async (t) => {
  let owner = launch();
  t.after(() => {
    windows('close');
    if (owner.exitCode === null && owner.signalCode === null) {
      execFileSync('taskkill.exe', ['/PID', String(owner.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    }
  });
  await ready();

  await t.test('repeated commands restore minimized and hidden windows without replacing services', async () => {
    const before = windows();
    for (const action of ['minimize', 'hide']) {
      windows(action);
      assert.match(await repeat(), /Opened the existing/);
      const after = windows();
      assert.equal(after.app, before.app);
      assert.equal(after.frontend, before.frontend);
      assert.equal(after.backend, before.backend);
      assert.equal(after.visible, true);
      assert.equal(after.minimized, false);
    }
  });

  await t.test('a stopped API is recovered by the next command', async () => {
    const before = windows();
    windows('stopBackend');
    const replacement = launch();
    await ready();
    if (replacement.exitCode === null) owner = replacement;
    else assert.equal(replacement.exitCode, 0, replacement.output);
    const after = windows();
    assert.notEqual(after.app, before.app);
    assert.notEqual(after.backend, before.backend);
  });

  await t.test('closing the window releases both development ports and permits a fresh start', async () => {
    windows('close');
    await until(() => {
      const state = windows();
      return !state.app && !state.frontend && !state.backend;
    }, 'Closing the window left development processes running.');
    owner = launch();
    await ready();
  });

  await t.test('an interrupted launcher does not block the next session', async () => {
    const before = windows();
    owner.kill('SIGKILL');
    await until(() => owner.exitCode !== null || owner.signalCode !== null, 'The old launcher did not exit.');
    owner = launch();
    await ready();
    const after = windows();
    assert.notEqual(after.app, before.app);
    assert.notEqual(after.frontend, before.frontend);
    assert.notEqual(after.backend, before.backend);
  });
});
