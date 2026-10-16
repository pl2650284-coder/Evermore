import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';

export const updaterConfigured = process.env.NEXT_PUBLIC_UPDATER_CONFIGURED === 'true';

export function isDesktopApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getCurrentAppVersion() {
  if (!isDesktopApp()) {
    return process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
  }

  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

export async function checkForAppUpdate() {
  if (!isDesktopApp()) {
    throw new Error('请在桌面应用中检查更新。');
  }
  if (!updaterConfigured) {
    throw new Error('当前构建尚未配置更新源。');
  }

  const { check } = await import('@tauri-apps/plugin-updater');
  return check({ timeout: 15_000 });
}

export async function installAppUpdate(
  update: Update,
  onEvent: (event: DownloadEvent) => void
) {
  await update.downloadAndInstall(onEvent, {
    timeout: 10 * 60_000,
    restartAfterInstall: true,
  });
}

export type AppUpdate = Update;
