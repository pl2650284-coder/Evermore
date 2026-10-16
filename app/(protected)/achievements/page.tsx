'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Trophy, CheckCircle2, Circle, Edit2, Lock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Modal from '@/components/Modal';
import { useAchievements } from '@/lib/data';
import { Achievement } from '@/lib/api';

const ICONS = ['🏆', '💕', '🌅', '🌍', '🎉', '🎬', '🍜', '🏕️', '🎨', '📚', '🎵', '✨'];
const CATEGORIES = [
  { title: '里程碑', ids: ['together_30', 'together_100', 'together_365', 'together_730'] },
  { title: '回忆', ids: ['first_photo', 'ten_photos', 'fifty_photos', 'first_event', 'five_events'] },
  { title: '互动', ids: ['first_letter', 'first_gift', 'first_ticket', 'first_wish', 'first_capsule'] },
];

export default function AchievementsPage() {
  const {
    loading, error, achievementsWithStatus, customAchievements, refresh,
    addAchievement, updateAchievement, deleteAchievement,
  } = useAchievements();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState<Achievement | null>(null);
  const [form, setForm] = useState({ title: '', description: '', icon: '🏆' });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const completed = achievementsWithStatus.filter(item => item.unlocked).length
    + customAchievements.filter(item => item.unlocked_at).length;
  const total = achievementsWithStatus.length + customAchievements.length;

  function openForm(achievement?: Achievement) {
    setEditing(achievement || null);
    setForm({ title: achievement?.title || '', description: achievement?.description || '', icon: achievement?.icon || '🏆' });
    setFormError(null);
    setActionError(null);
    setFormOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!form.title.trim()) { setFormError('请填写成就标题'); return; }
    setPending('save');
    try {
      if (editing) await updateAchievement(editing.id, form);
      else await addAchievement(form);
      setFormOpen(false);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : '保存成就失败');
    } finally {
      setPending(null);
    }
  }

  async function toggle(achievement: Achievement) {
    setPending(achievement.id);
    setActionError(null);
    try {
      await updateAchievement(achievement.id, { unlocked: !achievement.unlocked_at });
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : '更新成就失败');
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setPending('delete');
    setActionError(null);
    try {
      await deleteAchievement(deleting.id);
      setDeleting(null);
    } catch (requestError) {
      setDeleting(null);
      setActionError(requestError instanceof Error ? requestError.message : '删除成就失败');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="page-shell page-container">
        <header className="page-header">
          <div>
            <h1 className="page-title">成就系统</h1>
            <p className="page-description">收藏每一次成长，也为你们自己定义值得庆祝的时刻。</p>
          </div>
          <button type="button" onClick={() => openForm()} disabled={loading || pending !== null} className="button-primary">
            <Plus className="h-5 w-5" />创建成就
          </button>
        </header>

        {(error || actionError) && (
          <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error || actionError}
            {error && <button type="button" onClick={refresh} className="ml-3 inline-flex items-center gap-1 font-medium underline"><RefreshCw className="h-4 w-4" />重试</button>}
          </div>
        )}

        {loading ? (
          <div role="status" className="py-20 text-center text-gray-500">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-accent" />
            正在整理你们的成就...
          </div>
        ) : !error && (
          <div className="space-y-10">
            <section aria-label="成就概览" className="rounded-3xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 p-6 dark:border-orange-900/40 dark:from-orange-950/30 dark:to-amber-950/20 sm:p-8">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-accent dark:bg-orange-900/40"><Trophy className="h-7 w-7" /></div>
                <div>
                  <p className="text-3xl font-bold tabular-nums">{completed}<span className="ml-2 text-lg font-normal text-gray-400">/ {total}</span></p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">已完成成就 · 其中 {customAchievements.length} 个由你们定义</p>
                </div>
              </div>
              <div role="progressbar" aria-label="成就完成进度" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total} className="h-2.5 overflow-hidden rounded-full bg-orange-100 dark:bg-gray-800">
                <motion.div initial={{ width: 0 }} animate={{ width: `${total ? completed / total * 100 : 0}%` }} className="h-full rounded-full bg-accent" />
              </div>
            </section>

            <section aria-labelledby="custom-achievements-title">
              <div className="mb-5">
                <h2 id="custom-achievements-title" className="section-title">自定义成就</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">从一起看日出，到完成一次旅行。完成之后，亲手点亮它。</p>
              </div>
              {customAchievements.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/50">
                  <Trophy className="mx-auto mb-4 h-10 w-10 text-accent" />
                  <p className="font-medium">下一份成就，由你们来定义</p>
                  <p className="mb-5 mt-2 text-sm text-gray-500 dark:text-gray-400">写下标题和说明，选一个喜欢的图标，留待未来点亮。</p>
                  <button type="button" onClick={() => openForm()} className="button-secondary"><Plus className="h-4 w-4" />创建第一个成就</button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {customAchievements.map(achievement => (
                    <AchievementCard key={achievement.id} title={achievement.title} description={achievement.description} icon={achievement.icon} unlocked={Boolean(achievement.unlocked_at)} unlockedAt={achievement.unlocked_at}>
                      <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                        <button type="button" onClick={() => toggle(achievement)} disabled={pending !== null} className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-medium text-accent hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">
                          {achievement.unlocked_at ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          {pending === achievement.id ? '更新中...' : achievement.unlocked_at ? '取消完成' : '标记完成'}
                        </button>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => openForm(achievement)} disabled={pending !== null} aria-label={`编辑成就：${achievement.title}`} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 dark:hover:bg-gray-800"><Edit2 className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setDeleting(achievement)} disabled={pending !== null} aria-label={`删除成就：${achievement.title}`} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </AchievementCard>
                  ))}
                </div>
              )}
            </section>

            {CATEGORIES.map(category => (
              <section key={category.title} aria-label={category.title}>
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="section-title">{category.title}</h2>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">内置成就</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {achievementsWithStatus.filter(item => category.ids.includes(item.id)).map(achievement => (
                    <AchievementCard key={achievement.id} title={achievement.title} description={achievement.description} icon={achievement.icon} unlocked={achievement.unlocked} unlockedAt={achievement.unlockedAt} builtin />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <Modal open={formOpen} title={editing ? '编辑成就' : '创建成就'} onClose={() => setFormOpen(false)} busy={pending === 'save'}>
        <form onSubmit={save} className="space-y-5">
          <div>
            <label htmlFor="achievement-title" className="mb-2 block text-sm font-medium">成就标题 <span className="text-accent">*</span></label>
            <input id="achievement-title" name="title" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} required maxLength={80} placeholder="例如：一起看一次海边日出" className="form-input" disabled={pending === 'save'} />
          </div>
          <div>
            <label htmlFor="achievement-description" className="mb-2 block text-sm font-medium">成就说明</label>
            <textarea id="achievement-description" name="description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={500} rows={3} placeholder="写下这个成就对你们的意义..." className="form-input resize-y" disabled={pending === 'save'} />
            <p className="mt-1 text-right text-xs text-gray-400">{form.description.length} / 500</p>
          </div>
          <fieldset disabled={pending === 'save'}>
            <legend className="mb-3 text-sm font-medium">成就图标</legend>
            <div className="grid grid-cols-6 gap-2">
              {ICONS.map(icon => <button key={icon} type="button" aria-label={`选择图标 ${icon}`} aria-pressed={form.icon === icon} onClick={() => setForm({ ...form, icon })} className={`flex h-11 items-center justify-center rounded-xl border text-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${form.icon === icon ? 'border-accent bg-orange-50 dark:bg-orange-950/40' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'}`}>{icon}</button>)}
            </div>
          </fieldset>
          {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <button type="button" onClick={() => setFormOpen(false)} disabled={pending === 'save'} className="button-secondary">取消</button>
            <button type="submit" disabled={pending === 'save'} className="button-primary">{pending === 'save' ? '保存中...' : '保存成就'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleting)} title="删除成就" onClose={() => setDeleting(null)} busy={pending === 'delete'}>
        <p className="break-words text-sm leading-7 text-gray-600 dark:text-gray-400">确定删除「{deleting?.title}」吗？这个成就及其完成记录将被移除。</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setDeleting(null)} disabled={pending === 'delete'} className="button-secondary">保留成就</button>
          <button type="button" onClick={remove} disabled={pending === 'delete'} className="button-primary !bg-red-600 hover:!bg-red-700">{pending === 'delete' ? '删除中...' : '确认删除'}</button>
        </div>
      </Modal>
    </div>
  );
}

function AchievementCard({ title, description, icon, unlocked, unlockedAt, builtin = false, children }: {
  title: string;
  description: string | null;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  builtin?: boolean;
  children?: ReactNode;
}) {
  return (
    <article aria-label={title} className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900 sm:p-6 ${unlocked ? 'border-orange-200 dark:border-orange-900/60' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="flex flex-1 items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${unlocked ? 'bg-orange-50 dark:bg-orange-950/40' : 'bg-gray-100 dark:bg-gray-800'}`}>{builtin && !unlocked ? <Lock className="h-5 w-5 text-gray-400" /> : icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="break-words font-semibold leading-6">{title}</h3>
            {unlocked && <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />}
          </div>
          {description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>}
          <p className="mt-3 text-xs text-gray-400">{unlocked && unlockedAt ? `完成于 ${new Date(unlockedAt).toLocaleDateString('zh-CN')}` : '待完成'}</p>
        </div>
      </div>
      {children}
    </article>
  );
}
