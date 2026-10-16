'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  FolderOpen,
  HardDrive,
  Heart,
  Pause,
  Palette,
  Play,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useMusicPlayer } from '@/components/MusicProvider';
import { useTheme } from '@/components/ThemeProvider';
import { coupleApi, mediaCacheApi, MediaCacheStatus } from '@/lib/api';
import { useCouple } from '@/lib/couple';
import { useAppSettings } from '@/lib/settings';
import { chooseMusicFolder, loadMusicLibrary } from '@/lib/music';
import {
  AppUpdate,
  checkForAppUpdate,
  getCurrentAppVersion,
  installAppUpdate,
  isDesktopApp,
  updaterConfigured,
} from '@/lib/updater';

const syncIntervals = [
  { value: 15, label: '每 15 分钟' },
  { value: 30, label: '每 30 分钟' },
  { value: 60, label: '每小时' },
  { value: 180, label: '每 3 小时' },
  { value: 360, label: '每 6 小时' },
  { value: 720, label: '每 12 小时' },
  { value: 1440, label: '每天' },
];

const cacheSizes = [
  { value: 100 * 1024 * 1024, label: '100 MB' },
  { value: 500 * 1024 * 1024, label: '500 MB（推荐）' },
  { value: 1024 * 1024 * 1024, label: '1 GB' },
  { value: 5 * 1024 * 1024 * 1024, label: '5 GB' },
];

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function SettingsPage() {
  const { couple, createCouple, refreshCouple } = useCouple();
  const { theme, toggleTheme } = useTheme();
  const { settings, updateSettings } = useAppSettings();
  const [partner1Name, setPartner1Name] = useState('');
  const [partner2Name, setPartner2Name] = useState('');
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<MediaCacheStatus | null>(null);
  const [cacheSaving, setCacheSaving] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(
    process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
  );
  const [desktopApp, setDesktopApp] = useState(false);
  const [musicLoading, setMusicLoading] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdate | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const musicPlayer = useMusicPlayer();

  useEffect(() => {
    setPartner1Name(couple?.partner1_name || '');
    setPartner2Name(couple?.partner2_name || '');
    setStartDate(couple?.start_date || '');
  }, [couple]);

  useEffect(() => {
    mediaCacheApi.getStatus().then(setCacheStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    setDesktopApp(isDesktopApp());
    getCurrentAppVersion().then(setCurrentVersion).catch(() => undefined);
  }, []);

  const selectMusicFolder = async () => {
    setMusicLoading(true);
    setError(null);
    try {
      const folder = await chooseMusicFolder();
      if (!folder) return;
      const library = await loadMusicLibrary(folder);
      updateSettings({ musicFolder: library.folder });
    } catch (musicError: any) {
      setError(musicError?.message || '读取音乐文件夹失败');
    } finally {
      setMusicLoading(false);
    }
  };

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    setUpdateProgress(null);
    if (availableUpdate) {
      await availableUpdate.close().catch(() => undefined);
      setAvailableUpdate(null);
    }

    try {
      const update = await checkForAppUpdate();
      if (!update) {
        setUpdateMessage('当前已经是最新版本。');
        return;
      }
      setAvailableUpdate(update);
      setUpdateMessage('发现新版本 ' + update.version);
    } catch (updateError: any) {
      setUpdateMessage(updateError?.message || '检查更新失败，请稍后重试。');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!availableUpdate) return;
    setInstallingUpdate(true);
    setUpdateProgress(0);
    let downloaded = 0;
    let total = 0;

    try {
      await installAppUpdate(availableUpdate, (event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength || 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) setUpdateProgress(Math.min(100, Math.round(downloaded / total * 100)));
        } else if (event.event === 'Finished') {
          setUpdateProgress(100);
          setUpdateMessage('更新已下载，正在安装并重新启动…');
        }
      });
    } catch (updateError: any) {
      setUpdateMessage(updateError?.message || '更新安装失败，请稍后重试。');
      setInstallingUpdate(false);
    }
  };

  const changeCacheLimit = async (limitBytes: number) => {
    setCacheSaving(true);
    setError(null);
    try {
      setCacheStatus(await mediaCacheApi.setLimit(limitBytes));
    } catch (cacheError: any) {
      setError(cacheError?.message || '保存缓存设置失败');
    } finally {
      setCacheSaving(false);
    }
  };

  const saveBasicSettings = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      if (couple) {
        await coupleApi.updateCouple(couple.id, {
          partner1_name: partner1Name,
          partner2_name: partner2Name,
          start_date: startDate,
        });
        await refreshCouple();
      } else {
        const result = await createCouple({ partner1Name, partner2Name, startDate });
        if (!result.success) throw result.error;
      }
      setSaved(true);
    } catch (saveError: any) {
      setError(saveError?.message || '保存基础设置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="page-shell page-container">
        <header className="page-header">
          <div>
            <div className="inline-flex items-center gap-2 text-accent font-medium mb-3">
              <SettingsIcon className="w-5 h-5" />
              应用设置
            </div>
            <h1 className="page-title">设置</h1>
            <p className="page-description">
              管理基础资料、界面偏好、对象存储和数据库同步行为。
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-6 flex items-center gap-2 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5" />
            基础设置已保存。
          </div>
        )}

        <div className="space-y-6">
          <form onSubmit={saveBasicSettings} className="settings-card">
            <SectionHeading icon={Heart} title="基础设置" description="这些信息会显示在首页和导航栏。" />
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="名字一">
                <input value={partner1Name} onChange={(event) => { setPartner1Name(event.target.value); setSaved(false); }} required className="settings-input" placeholder="小明" />
              </Field>
              <Field label="名字二">
                <input value={partner2Name} onChange={(event) => { setPartner2Name(event.target.value); setSaved(false); }} required className="settings-input" placeholder="小红" />
              </Field>
            </div>
            <Field label="在一起的日期">
              <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setSaved(false); }} required className="settings-input max-w-sm" />
            </Field>
            <button type="submit" disabled={saving} className="mt-6 px-5 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : saved ? '已保存' : '保存基础设置'}
            </button>
          </form>

          <section className="settings-card">
            <SectionHeading icon={Palette} title="偏好设置" description="调整界面外观和首页交互。" />
            <SettingRow title="外观主题" description="选择浅色或深色显示。">
              <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                {(['light', 'dark'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => theme !== value && toggleTheme()}
                    className={'px-4 py-2 rounded-lg text-sm font-medium ' + (theme === value ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500')}
                  >
                    {value === 'light' ? '浅色' : '深色'}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow title="应用音乐" description="开启后显示右下角的播放或静音按钮，并在页面之间持续播放。" icon={Volume2}>
              <Toggle checked={settings.showSoundButton} onChange={(checked) => updateSettings({ showSoundButton: checked })} />
            </SettingRow>
            {settings.showSoundButton && (
              <>
                <SettingRow
                  title="音乐文件夹"
                  description={settings.musicFolder
                    ? `已找到 ${musicPlayer.tracks.length} 首音乐；文件不会复制到应用中。`
                    : '选择电脑上的文件夹，读取其中的 MP3、WAV、OGG、M4A、AAC 或 FLAC。'}
                  icon={FolderOpen}
                >
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectMusicFolder}
                      disabled={!desktopApp || musicLoading}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-medium disabled:opacity-50"
                    >
                      {musicLoading ? '读取中...' : settings.musicFolder ? '更换文件夹' : '选择文件夹'}
                    </button>
                    {settings.musicFolder && (
                      <button
                        type="button"
                        onClick={() => updateSettings({ musicFolder: '' })}
                        className="px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </SettingRow>
                {settings.musicFolder && (
                  <div className="-mt-2 mb-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 break-all dark:bg-gray-800/60 dark:text-gray-400">
                    {settings.musicFolder}
                  </div>
                )}
                {musicPlayer.currentTrack && (
                  <SettingRow
                    title="当前歌曲"
                    description={`${musicPlayer.currentIndex + 1} / ${musicPlayer.tracks.length} · ${musicPlayer.currentTrack.name}`}
                  >
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={musicPlayer.previousTrack} className="rounded-full p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="上一首">
                        <SkipBack className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={musicPlayer.togglePlay} className="rounded-full bg-accent p-3 text-white" aria-label={musicPlayer.isPlaying ? '暂停音乐' : '播放音乐'}>
                        {musicPlayer.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </button>
                      <button type="button" onClick={musicPlayer.nextTrack} className="rounded-full p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="下一首">
                        <SkipForward className="h-5 w-5" />
                      </button>
                    </div>
                  </SettingRow>
                )}
                {!musicPlayer.currentTrack && settings.musicFolder && (
                  <div className="py-3 text-sm text-amber-600 dark:text-amber-400">
                    {musicPlayer.message}
                  </div>
                )}
                <SettingRow title="音乐播放方式" description="选择列表循环、随机播放或重复当前歌曲。">
                  <select
                    value={settings.musicPlaybackMode}
                    onChange={(event) => updateSettings({ musicPlaybackMode: event.target.value as typeof settings.musicPlaybackMode })}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <option value="loop">列表循环</option>
                    <option value="shuffle">随机播放</option>
                    <option value="repeat-one">单曲循环</option>
                  </select>
                </SettingRow>
              </>
            )}
          </section>

          <section className="settings-card">
            <SectionHeading icon={Cloud} title="存储与同步" description="媒体直接存入对象存储，SQLite 数据按需同步快照。" />
            <Link href="/sync" className="mb-5 flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div>
                <div className="font-medium">对象存储连接与数据库同步</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">配置 S3 / R2 / MinIO。新增照片和视频会直接上传，本地只保留按需缓存。</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <SettingRow
              title="媒体缓存大小"
              description={cacheStatus
                ? `当前使用 ${formatBytes(cacheStatus.usedBytes)}，共 ${cacheStatus.fileCount} 个文件。调小后会立即清理最久未查看的缓存。`
                : '控制本机保留多少最近查看过的照片和视频，不影响云端原文件。'}
              icon={HardDrive}
            >
              <select
                value={cacheStatus?.limitBytes || 500 * 1024 * 1024}
                onChange={(event) => changeCacheLimit(Number(event.target.value))}
                disabled={!cacheStatus || cacheSaving}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-50"
              >
                {cacheSizes.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
              </select>
            </SettingRow>
            <SettingRow title="显示手动同步按钮" description="关闭后，对象存储页不显示立即同步和覆盖按钮。">
              <Toggle checked={settings.manualSyncEnabled} onChange={(checked) => updateSettings({ manualSyncEnabled: checked })} />
            </SettingRow>
            <SettingRow title="启动后自动同步" description="每次启动应用后自动检查一次云端数据。">
              <Toggle checked={settings.syncOnStartup} onChange={(checked) => updateSettings({ syncOnStartup: checked })} />
            </SettingRow>
            <SettingRow title="定时自动同步" description="应用保持打开时，按设定间隔自动检查并同步。">
              <Toggle checked={settings.autoSyncEnabled} onChange={(checked) => updateSettings({ autoSyncEnabled: checked })} />
            </SettingRow>
            <SettingRow title="自动同步间隔" description="仅在开启定时自动同步时生效。">
              <select
                value={settings.syncIntervalMinutes}
                onChange={(event) => updateSettings({ syncIntervalMinutes: Number(event.target.value) })}
                disabled={!settings.autoSyncEnabled}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-50"
              >
                {syncIntervals.map((interval) => <option key={interval.value} value={interval.value}>{interval.label}</option>)}
              </select>
            </SettingRow>
          </section>

          <section className="settings-card">
            <SectionHeading icon={Download} title="应用更新" description="仅在你点击时检查更新，不会在后台自动联网。" />
            <SettingRow title="当前版本" description="新版本安装时会覆盖应用程序，但不会删除本地数据库和缓存。">
              <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium">
                v{currentVersion}
              </span>
            </SettingRow>
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              {updateMessage && (
                <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 text-sm">
                  <div>{updateMessage}</div>
                  {availableUpdate?.body && (
                    <div className="mt-2 text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                      {availableUpdate.body}
                    </div>
                  )}
                </div>
              )}
              {updateProgress !== null && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>下载进度</span>
                    <span>{updateProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: updateProgress + '%' }} />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={checkUpdate}
                  disabled={!desktopApp || !updaterConfigured || checkingUpdate || installingUpdate}
                  className="px-5 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <RefreshCw className={'w-4 h-4 ' + (checkingUpdate ? 'animate-spin' : '')} />
                  {checkingUpdate ? '检查中…' : '检查更新'}
                </button>
                {availableUpdate && (
                  <button
                    type="button"
                    onClick={installUpdate}
                    disabled={installingUpdate}
                    className="px-5 py-3 border border-accent text-accent rounded-xl font-medium hover:bg-accent/5 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {installingUpdate ? '正在更新…' : '安装 v' + availableUpdate.version}
                  </button>
                )}
              </div>
              {!desktopApp && (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">请在桌面应用中检查更新。</p>
              )}
              {desktopApp && !updaterConfigured && (
                <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                  当前开发构建未配置对象存储更新地址；正式发布时注入地址和公钥后会自动启用。
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }: { icon: typeof SettingsIcon; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="p-2.5 rounded-xl bg-accent/10 text-accent"><Icon className="w-5 h-5" /></div>
      <div><h2 className="section-title">{title}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block mb-5"><span className="block text-sm font-medium mb-2">{label}</span>{children}</label>;
}

function SettingRow({ title, description, icon: Icon, children }: { title: string; description: string; icon?: typeof SettingsIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 py-4 border-t border-gray-100 dark:border-gray-800 first:border-t-0">
      <div className="flex items-start gap-3">{Icon && <Icon className="w-5 h-5 mt-0.5 text-gray-400" />}<div><div className="font-medium">{title}</div><div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</div></div></div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={'relative w-12 h-7 rounded-full transition-colors ' + (checked ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-700')}>
      <span className={'absolute left-0 top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}
