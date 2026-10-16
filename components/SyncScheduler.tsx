'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { syncApi } from '@/lib/api';
import { useAppSettings } from '@/lib/settings';

const STARTUP_SYNC_KEY = 'loveMuseum.startupSyncAttempted';

async function runAutomaticSync() {
  const { configuration } = await syncApi.getConfiguration();
  if (!configuration) return;

  const status = await syncApi.getStatus();
  if (status.state === 'remote-empty' && status.local?.isEmpty) return;

  const result = await syncApi.run('auto');
  if (result.direction === 'download') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    window.location.replace('/');
  }
}

export default function SyncScheduler() {
  const { isAdmin, isLoading } = useAuth();
  const { settings } = useAppSettings();

  useEffect(() => {
    if (isLoading || isAdmin || !settings.syncOnStartup) return;
    if (sessionStorage.getItem(STARTUP_SYNC_KEY)) return;
    sessionStorage.setItem(STARTUP_SYNC_KEY, 'true');
    runAutomaticSync().catch((error) => console.error('启动自动同步失败:', error));
  }, [isAdmin, isLoading, settings.syncOnStartup]);

  useEffect(() => {
    if (isLoading || isAdmin || !settings.autoSyncEnabled) return;
    const timer = window.setInterval(() => {
      runAutomaticSync().catch((error) => console.error('定时自动同步失败:', error));
    }, settings.syncIntervalMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isAdmin, isLoading, settings.autoSyncEnabled, settings.syncIntervalMinutes]);

  return null;
}
