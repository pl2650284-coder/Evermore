'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadMusicLibrary, LocalMusicTrack } from '@/lib/music';
import { useAppSettings } from '@/lib/settings';

interface MusicPlayerState {
  tracks: LocalMusicTrack[];
  currentTrack: LocalMusicTrack | null;
  currentIndex: number;
  isPlaying: boolean;
  message: string;
  togglePlay: () => void;
  previousTrack: () => void;
  nextTrack: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerState | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();
  const [tracks, setTracks] = useState<LocalMusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [message, setMessage] = useState('请先在设置中选择音乐文件夹');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.5;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!settings.showSoundButton) {
      audio?.pause();
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }
    if (!settings.musicFolder) {
      audio?.pause();
      playingRef.current = false;
      setIsPlaying(false);
      setTracks([]);
      setMessage('请先在设置中选择音乐文件夹');
      return;
    }

    playingRef.current = false;
    setIsPlaying(false);
    audio?.pause();
    loadMusicLibrary(settings.musicFolder)
      .then((library) => {
        setTracks(library.tracks);
        setCurrentIndex(0);
        setMessage(library.tracks.length ? '' : '这个文件夹中没有可播放的音乐');
      })
      .catch((error) => {
        setTracks([]);
        setMessage(error?.message || '无法读取音乐文件夹');
      });
  }, [settings.musicFolder, settings.showSoundButton]);

  useEffect(() => {
    const audio = audioRef.current;
    const track = tracks[currentIndex];
    if (!audio || !track) return;
    audio.src = track.url;
    audio.load();
    if (playingRef.current) {
      audio.play().catch(() => {
        playingRef.current = false;
        setIsPlaying(false);
        setMessage('无法播放这个音乐文件');
      });
    }
  }, [currentIndex, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      if (settings.musicPlaybackMode === 'repeat-one' || (tracks.length === 1 && settings.musicPlaybackMode === 'loop')) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          playingRef.current = false;
          setIsPlaying(false);
        });
        return;
      }
      setCurrentIndex((index) => {
        if (settings.musicPlaybackMode === 'shuffle' && tracks.length > 1) {
          let next = index;
          while (next === index) next = Math.floor(Math.random() * tracks.length);
          return next;
        }
        return tracks.length ? (index + 1) % tracks.length : 0;
      });
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [settings.musicPlaybackMode, tracks.length]);

  const togglePlay = () => {
    const audio = audioRef.current;
    const track = tracks[currentIndex];
    if (!audio || !track) return;
    if (playingRef.current) {
      audio.pause();
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }
    if (!audio.src) {
      audio.src = track.url;
      audio.load();
    }
    if (audio.ended) audio.currentTime = 0;
    audio.play().then(() => {
      playingRef.current = true;
      setIsPlaying(true);
      setMessage('');
    }).catch(() => setMessage('无法播放这个音乐文件'));
  };

  const changeTrack = (direction: -1 | 1) => {
    if (!tracks.length) return;
    setCurrentIndex((index) => (index + direction + tracks.length) % tracks.length);
  };

  const value = {
    tracks,
    currentTrack: tracks[currentIndex] || null,
    currentIndex,
    isPlaying,
    message,
    togglePlay,
    previousTrack: () => changeTrack(-1),
    nextTrack: () => changeTrack(1),
  };

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) throw new Error('useMusicPlayer must be used within MusicProvider');
  return context;
}
