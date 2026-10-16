'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Lock, Unlock, X, Calendar, Edit2, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useTimeCapsules } from '@/lib/data';

export default function CapsulesPage() {
  const { capsules, loading, addCapsule, updateCapsule, deleteCapsule } = useTimeCapsules();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingCapsule, setViewingCapsule] = useState<any>(null);
  const [editingCapsule, setEditingCapsule] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    unlock_date: '',
  });

  const handleAdd = () => {
    setEditingCapsule(null);
    setViewingCapsule(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormData({
      title: '',
      content: '',
      unlock_date: tomorrow.toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const handleEdit = (capsule: any) => {
    setEditingCapsule(capsule);
    setViewingCapsule(null);
    setFormData({
      title: capsule.title,
      content: capsule.content,
      unlock_date: capsule.unlock_date,
    });
    setIsModalOpen(true);
  };

  const handleView = (capsule: any) => {
    setViewingCapsule(capsule);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个时光胶囊吗？')) return;
    try {
      await deleteCapsule(id);
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const handleUnlock = async (capsule: any) => {
    if (!confirm('确定要提前解锁这个时光胶囊吗？')) return;
    try {
      await updateCapsule(capsule.id, { is_unlocked: true });
      if (viewingCapsule?.id === capsule.id) {
        setViewingCapsule({ ...viewingCapsule, is_unlocked: true });
      }
    } catch (err) {
      alert('解锁失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content || !formData.unlock_date) {
      alert('请填写完整信息');
      return;
    }

    try {
      if (editingCapsule) {
        await updateCapsule(editingCapsule.id, formData);
      } else {
        await addCapsule(formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('保存失败，请重试');
    }
  };

  const isUnlockDatePassed = (unlockDate: string) => {
    return new Date(unlockDate) <= new Date();
  };

  const canView = (capsule: any) => {
    return capsule.is_unlocked || isUnlockDatePassed(capsule.unlock_date);
  };

  const getTimeLeft = (unlockDate: string) => {
    const now = new Date();
    const unlock = new Date(unlockDate);
    const diff = unlock.getTime() - now.getTime();

    if (diff <= 0) return '已可解锁';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `还剩 ${days} 天`;
    if (hours > 0) return `还剩 ${hours} 小时`;
    return `还剩 ${minutes} 分钟`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="page-shell">
        <main className="page-container">
          <div>
            <div className="page-header">
              <div>
                <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="page-title">
                  时光胶囊
                </motion.h1>
                <p className="page-description">
                  给未来的自己写一封信
                </p>
              </div>
              <button
                onClick={handleAdd}
                className="button-primary"
              >
                <Plus className="w-5 h-5" />
                新建胶囊
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">加载中...</p>
              </div>
            ) : capsules.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">还没有时光胶囊</p>
                <p className="text-sm text-gray-400 mb-4">给未来的你们写一封信，设定一个解锁日期</p>
                <button onClick={handleAdd} className="mt-4 text-accent hover:underline">
                  创建第一个胶囊
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {capsules.map((capsule) => (
                  <motion.div
                    key={capsule.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  >
                    <div className="h-40 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center relative">
                      {canView(capsule) ? (
                        <Unlock className="w-12 h-12 text-purple-500" />
                      ) : (
                        <Lock className="w-12 h-12 text-gray-400" />
                      )}
                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-sm text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-gray-800/80 px-3 py-1 rounded-full">
                          {getTimeLeft(capsule.unlock_date)}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold mb-2 truncate">{capsule.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                        <Calendar className="w-4 h-4" />
                        <span>解锁: {new Date(capsule.unlock_date).toLocaleDateString('zh-CN')}</span>
                      </div>
                      {canView(capsule) ? (
                        <button
                          onClick={() => handleView(capsule)}
                          className="w-full py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                        >
                          打开胶囊
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnlock(capsule)}
                          className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                        >
                          提前解锁
                        </button>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(capsule); }}
                          className="flex-1 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm flex items-center justify-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          编辑
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(capsule.id); }}
                          className="flex-1 py-2 text-gray-500 hover:text-red-500 transition-colors text-sm flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 查看胶囊弹窗 */}
      <AnimatePresence>
        {viewingCapsule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setViewingCapsule(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="section-title">{viewingCapsule.title}</h2>
                  <button
                    onClick={() => setViewingCapsule(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>解锁日期: {new Date(viewingCapsule.unlock_date).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl">
                  {viewingCapsule.content}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => { setViewingCapsule(null); handleEdit(viewingCapsule); }}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    编辑
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 编辑/新建弹窗 */}
      <AnimatePresence>
        {isModalOpen && !viewingCapsule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="section-title">
                    {editingCapsule ? '编辑胶囊' : '新建时光胶囊'}
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">标题</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="给这个胶囊起个名字"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">解锁日期</label>
                  <input
                    type="date"
                    value={formData.unlock_date}
                    onChange={(e) => setFormData({ ...formData, unlock_date: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">内容</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={10}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    placeholder="写给未来的话..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-4 bg-accent text-white rounded-2xl hover:opacity-90 transition-opacity"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
