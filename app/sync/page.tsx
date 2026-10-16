'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  DownloadCloud,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  S3SyncConfiguration,
  S3SyncPublicConfiguration,
  SyncState,
  SyncStatus,
  syncApi,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAppSettings } from '@/lib/settings';

const emptyConfiguration: S3SyncConfiguration = {
  endpoint: '',
  region: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
};

const stateCopy: Record<SyncState, { title: string; detail: string; tone: string }> = {
  unconfigured: {
    title: '尚未配置',
    detail: '填写下方连接信息后即可开始同步。',
    tone: 'text-gray-600 dark:text-gray-300',
  },
  'remote-empty': {
    title: '云端暂无数据',
    detail: '首次同步会把本机数据上传到对象存储。',
    tone: 'text-blue-600 dark:text-blue-400',
  },
  'upload-needed': {
    title: '等待上传',
    detail: '本机有新数据，普通同步会上传到云端。',
    tone: 'text-blue-600 dark:text-blue-400',
  },
  'download-needed': {
    title: '等待下载',
    detail: '云端有新数据，普通同步会下载到本机。',
    tone: 'text-blue-600 dark:text-blue-400',
  },
  conflict: {
    title: '发现同步冲突',
    detail: '本机和云端都发生过修改，请明确选择要保留的一份。',
    tone: 'text-amber-600 dark:text-amber-400',
  },
  synced: {
    title: '已同步',
    detail: '本机数据与云端快照一致。',
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '尚未同步';
  return new Date(value).toLocaleString('zh-CN');
}

export default function SyncPage() {
  const { isLoading: authLoading } = useAuth();
  const { settings } = useAppSettings();
  const [form, setForm] = useState<S3SyncConfiguration>(emptyConfiguration);
  const [savedConfiguration, setSavedConfiguration] = useState<S3SyncPublicConfiguration | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'save' | 'status' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    const nextStatus = await syncApi.getStatus();
    setStatus(nextStatus);
    return nextStatus;
  };

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    async function load() {
      try {
        const result = await syncApi.getConfiguration();
        if (cancelled) return;
        setSavedConfiguration(result.configuration);
        if (result.configuration) {
          setForm((current) => ({
            ...current,
            endpoint: result.configuration!.endpoint,
            region: result.configuration!.region,
            bucket: result.configuration!.bucket,
          }));
          const nextStatus = await syncApi.getStatus();
          if (!cancelled) setStatus(nextStatus);
        } else {
          setStatus({ state: 'unconfigured', local: null, remote: null, lastSyncedAt: null });
        }
      } catch (loadError: any) {
        if (!cancelled) setError(loadError.message || '无法读取同步配置');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  const updateField = (field: keyof S3SyncConfiguration, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveConfiguration = async (event: FormEvent) => {
    event.preventDefault();
    setWorking('save');
    setError(null);
    setMessage(null);
    try {
      const result = await syncApi.saveConfiguration(form);
      setSavedConfiguration(result.configuration);
      setForm((current) => ({ ...current, accessKeyId: '', secretAccessKey: '' }));
      await loadStatus();
      setMessage('连接测试成功，配置已安全保存在本机。');
    } catch (saveError: any) {
      setError(saveError.message || '连接对象存储失败');
    } finally {
      setWorking(null);
    }
  };

  const refreshStatus = async () => {
    setWorking('status');
    setError(null);
    setMessage(null);
    try {
      await loadStatus();
    } catch (statusError: any) {
      setError(statusError.message || '刷新同步状态失败');
    } finally {
      setWorking(null);
    }
  };

  const runSync = async (direction: 'auto' | 'upload' | 'download') => {
    if (direction === 'upload' && !window.confirm(
      '这会用当前本机数据覆盖云端同步版本。确定继续吗？'
    )) return;
    if (direction === 'download' && !window.confirm(
      '这会用云端数据替换当前本机数据库和上传文件。原数据会保留在本机恢复目录中。确定继续吗？'
    )) return;

    setWorking('sync');
    setError(null);
    setMessage(null);
    try {
      const result = await syncApi.run(direction);
      if (result.direction === 'download') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
        setMessage('云端数据已恢复，即将返回首页。');
        window.setTimeout(() => window.location.assign('/'), 900);
        return;
      }
      await loadStatus();
      setMessage(result.direction === 'upload' ? '本机数据已上传到云端。' : '本机与云端已经一致。');
    } catch (syncError: any) {
      setError(syncError.message || '同步失败');
      try {
        await loadStatus();
      } catch {
        // 保留原始同步错误。
      }
    } finally {
      setWorking(null);
    }
  };

  const currentState = status?.state || 'unconfigured';
  const copy = stateCopy[currentState];
  const emptyDeviceWithoutRemote = currentState === 'remote-empty' && status?.local?.isEmpty === true;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="page-shell page-container">
        <header className="page-header">
          <div>
            <div className="inline-flex items-center gap-2 text-accent font-medium mb-3">
              <Cloud className="w-5 h-5" />
              S3 兼容对象存储
            </div>
            <h1 className="page-title">数据同步</h1>
            <p className="page-description max-w-3xl">
              SQLite 数据通过快照同步；新增照片和视频会直接保存到你自己的对象存储，本机只按需保留
              媒体缓存，默认 500MB，也可以在设置中选择大小。支持 AWS S3、Cloudflare R2、MinIO 及其他兼容 S3 协议的服务。
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="mb-6 flex gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-6">
          <form
            onSubmit={saveConfiguration}
            className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="section-title">连接配置</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  保存前会实际访问 Bucket 测试连接。
                </p>
              </div>
              {savedConfiguration && (
                <span className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  已保存
                </span>
              )}
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="block text-sm font-medium mb-2">Endpoint</span>
                <input
                  type="url"
                  value={form.endpoint}
                  onChange={(event) => updateField('endpoint', event.target.value)}
                  placeholder="https://s3.example.com"
                  spellCheck={false}
                  required
                  className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Region</span>
                  <input
                    value={form.region}
                    onChange={(event) => updateField('region', event.target.value)}
                    placeholder="auto / us-east-1"
                    spellCheck={false}
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Bucket name</span>
                  <input
                    value={form.bucket}
                    onChange={(event) => updateField('bucket', event.target.value)}
                    placeholder="evermore"
                    spellCheck={false}
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Access Key (AK)</span>
                  <input
                    value={form.accessKeyId}
                    onChange={(event) => updateField('accessKeyId', event.target.value)}
                    placeholder={savedConfiguration?.accessKeyIdHint || 'Access Key ID'}
                    autoComplete="off"
                    spellCheck={false}
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Secret Key (SK)</span>
                  <input
                    type="password"
                    value={form.secretAccessKey}
                    onChange={(event) => updateField('secretAccessKey', event.target.value)}
                    placeholder={savedConfiguration ? '修改配置时请重新输入' : 'Secret Access Key'}
                    autoComplete="new-password"
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={working !== null}
              className="mt-6 w-full py-3.5 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              {working === 'save' ? '正在测试连接...' : '测试并保存连接'}
            </button>

            <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-gray-400">
              AK 和 SK 会加密写入本机配置文件，不会返回到页面，也不会写入云端同步快照。
              请使用私有 Bucket；同步数据本身不会额外加密，隐私依赖 Bucket 权限与存储服务的加密设置。
            </p>
          </form>

          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="section-title">同步状态</h2>
                <p className={`font-medium mt-2 ${copy.tone}`}>{copy.title}</p>
              </div>
              <button
                type="button"
                onClick={refreshStatus}
                disabled={!savedConfiguration || working !== null}
                aria-label="刷新同步状态"
                className="p-2.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <RefreshCw className={`w-5 h-5 ${working === 'status' ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <RefreshCw className="w-7 h-7 animate-spin text-accent" />
              </div>
            ) : (
              <>
                <p className="text-sm leading-6 text-gray-500 dark:text-gray-400 mb-6">
                  {emptyDeviceWithoutRemote
                    ? '本机和云端都还没有数据，请先在设置中填写基础信息。'
                    : copy.detail}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/70">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-5 h-5 text-gray-400" />
                      <span className="text-sm">本机旧版上传文件</span>
                    </div>
                    <span className="text-sm font-medium">
                      {status?.local ? `${status.local.fileCount} 个 · ${formatBytes(status.local.totalBytes)}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/70">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-gray-400" />
                      <span className="text-sm">云端快照</span>
                    </div>
                    <span className="text-sm font-medium">
                      {status?.remote ? `${status.remote.fileCount} 个文件` : '暂无'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-1 pt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>最近同步</span>
                    <span>{formatDate(status?.lastSyncedAt)}</span>
                  </div>
                  {status?.remote && (
                    <div className="flex items-center justify-between gap-4 px-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>云端更新时间</span>
                      <span>{formatDate(status.remote.createdAt)}</span>
                    </div>
                  )}
                </div>

                {settings.manualSyncEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => runSync('auto')}
                      disabled={!savedConfiguration || emptyDeviceWithoutRemote || working !== null}
                      className="w-full py-3.5 bg-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-5 h-5 ${working === 'sync' ? 'animate-spin' : ''}`} />
                      {working === 'sync' ? '同步中，请勿关闭应用...' : '立即同步'}
                    </button>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <button
                        type="button"
                        onClick={() => runSync('upload')}
                        disabled={!savedConfiguration || status?.local?.isEmpty !== false || working !== null}
                        className="py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <UploadCloud className="w-4 h-4" />
                        以本机覆盖
                      </button>
                      <button
                        type="button"
                        onClick={() => runSync('download')}
                        disabled={!savedConfiguration || !status?.remote || working !== null}
                        className="py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <DownloadCloud className="w-4 h-4" />
                        以云端覆盖
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/70 text-sm text-gray-500 dark:text-gray-400">
                    手动同步按钮已在设置中关闭，自动同步仍会按设置执行。
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-6">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">同步说明</h2>
          <p className="text-sm leading-6 text-amber-800 dark:text-amber-300">
            同步快照包含 SQLite 数据库和仍使用本地地址的旧版上传文件；新媒体已经直接存放在对象存储中。
            本机媒体缓存不会进入同步快照。两台设备都修改过数据库时不会静默覆盖，下载前也会保留恢复副本。
          </p>
        </section>

        <div className="mt-8 text-center">
          <Link href="/settings" className="text-sm text-gray-500 dark:text-gray-400 hover:text-accent">
            返回设置
          </Link>
        </div>
      </main>
    </div>
  );
}
