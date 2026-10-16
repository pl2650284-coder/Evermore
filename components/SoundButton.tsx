'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMusicPlayer } from '@/components/MusicProvider';
import { useAppSettings } from '@/lib/settings';

export default function SoundButton() {
  const { settings } = useAppSettings();
  const { currentTrack, isPlaying, message, togglePlay } = useMusicPlayer();
  const pathname = usePathname();

  if (!settings.showSoundButton || ['/admin', '/login', '/register', '/onboarding'].some((path) => pathname.startsWith(path))) return null;

  return (
    <button
      type="button"
      onClick={togglePlay}
      disabled={!currentTrack}
      className="fixed bottom-8 right-8 z-50 rounded-full bg-white p-4 shadow-lg transition-transform hover:scale-110 disabled:opacity-60 dark:bg-gray-900"
      title={message || currentTrack?.name}
      aria-label={isPlaying ? '暂停音乐' : '播放音乐'}
    >
      {isPlaying ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
    </button>
  );
}
