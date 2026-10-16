'use client';

import { useEffect, useState } from 'react';

export interface AppSettings {
  showSoundButton: boolean;
  musicFolder: string;
  musicPlaybackMode: 'loop' | 'shuffle' | 'repeat-one';
  manualSyncEnabled: boolean;
  autoSyncEnabled: boolean;
  syncOnStartup: boolean;
  syncIntervalMinutes: number;
}

const STORAGE_KEY = 'loveMuseum.settings';
const CHANGE_EVENT = 'love-museum-settings-change';

export const defaultAppSettings: AppSettings = {
  showSoundButton: true,
  musicFolder: '',
  musicPlaybackMode: 'loop',
  manualSyncEnabled: true,
  autoSyncEnabled: false,
  syncOnStartup: false,
  syncIntervalMinutes: 60,
};

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const interval = Number(value?.syncIntervalMinutes);
  const rawMusicPlaybackMode = (value as { musicPlaybackMode?: string } | null | undefined)?.musicPlaybackMode;
  const savedMusicPlaybackMode = rawMusicPlaybackMode === 'sequence'
    ? 'repeat-one'
    : rawMusicPlaybackMode;
  const musicPlaybackMode = ['loop', 'shuffle', 'repeat-one'].includes(savedMusicPlaybackMode || '')
    ? savedMusicPlaybackMode as AppSettings['musicPlaybackMode']
    : 'loop';
  return {
    showSoundButton: value?.showSoundButton !== false,
    musicFolder: typeof value?.musicFolder === 'string' ? value.musicFolder : '',
    musicPlaybackMode,
    manualSyncEnabled: value?.manualSyncEnabled !== false,
    autoSyncEnabled: value?.autoSyncEnabled === true,
    syncOnStartup: value?.syncOnStartup === true,
    syncIntervalMinutes: Number.isFinite(interval) && interval >= 5 ? interval : 60,
  };
}

export function readAppSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultAppSettings;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return normalizeSettings(saved ? JSON.parse(saved) : null);
  } catch {
    return defaultAppSettings;
  }
}

export function writeAppSettings(settings: AppSettings) {
  const normalized = normalizeSettings(settings);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: normalized }));
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);

  useEffect(() => {
    setSettings(readAppSettings());
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<AppSettings>).detail;
      setSettings(detail ? normalizeSettings(detail) : readAppSettings());
    };
    const handleStorage = () => setSettings(readAppSettings());
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const updateSettings = (patch: Partial<AppSettings>) => {
    const next = normalizeSettings({ ...settings, ...patch });
    writeAppSettings(next);
  };

  return { settings, updateSettings };
}
