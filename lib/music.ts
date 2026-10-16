import { API_BASE_URL } from '@/lib/api';

export interface LocalMusicTrack {
  name: string;
  path: string;
  url: string;
}

export interface LocalMusicLibrary {
  folder: string;
  tracks: LocalMusicTrack[];
}

export function isDesktopApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function chooseMusicFolder() {
  if (!isDesktopApp()) throw new Error('请选择桌面应用中的音乐文件夹。');
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ directory: true, multiple: false, title: '选择音乐文件夹' });
  return typeof selected === 'string' ? selected : null;
}

export async function loadMusicLibrary(folder: string): Promise<LocalMusicLibrary> {
  if (!folder) return { folder: '', tracks: [] };
  const response = await fetch(`${API_BASE_URL}/music/library?folder=${encodeURIComponent(folder)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || '无法读取音乐文件夹');
  }
  return response.json();
}
