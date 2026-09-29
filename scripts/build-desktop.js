const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

const result = spawnSync(process.execPath, [nextCli, 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DESKTOP_BUILD: 'true',
    NEXT_PUBLIC_API_URL: '/api',
    NEXT_TELEMETRY_DISABLED: '1',
  },
});

if (result.error) {
  console.error(`Unable to start Next.js build: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
