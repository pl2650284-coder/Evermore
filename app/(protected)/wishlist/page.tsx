'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Edit2,
  Trash2,
  X,
  Star,
  Upload,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useWishlist } from '@/lib/data';
import { uploadFile } from '@/lib/storage';

export default function WishlistPage() {
  const { items, loading, addItem, updateItem, deleteItem } = useWishlist();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    completion_image_url: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;

  const toggleComplete = async (item: any) => {
    try {
      await updateItem(item.id, {
        completed: !item.completed,
        completed_at: !item.completed ? new Date().toISOString() : null,
      });
    } catch (e) {
      alert('更新失败，请重试');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // 创建预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setFormData({ ...formData, completion_image_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ title: '', description: '', completion_image_url: '' });
    setImageFile(null);
    setImagePreview('');
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      completion_image_url: item.completion_image_url || '',
    });
    setImageFile(null);
    setImagePreview(item.completion_image_url || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个愿望吗？')) return;
    try {
      await deleteItem(id);
    } catch (e) {
      alert('删除失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      alert('请填写愿望标题');
      return;
    }

    try {
      let finalImageUrl = formData.completion_image_url;

      // 如果有选择文件，先上传
      if (imageFile) {
        setUploading(true);
        finalImageUrl = await uploadFile(imageFile, 'wishlist');
        setUploading(false);
      }

      if (editingItem) {
        await updateItem(editingItem.id, {
          title: formData.title,
          description: formData.description || null,
          completion_image_url: finalImageUrl || null,
        });
      } else {
        await addItem({
          title: formData.title,
          description: formData.description || null,
          completed: false,
          completion_image_url: finalImageUrl || null,
        });
      }
      setIsModalOpen(false);
    } catch (e) {
      alert('保存失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="page-shell">
        <main className="page-container">
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">愿望清单</h1>
                <p className="page-description">
                  {completedCount}/{totalCount} 已完成
                </p>
              </div>
              <button
                onClick={handleAdd}
                className="button-primary"
              >
                <Plus className="w-5 h-5" />
                添加愿望
              </button>
            </div>

            {/* 进度条 */}
            <div className="mb-12">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                  transition={{ duration: 1 }}
                  className="h-full bg-gradient-to-r from-accent to-orange-400 rounded-full"
                />
              </div>
            </div>

            {/* 愿望列表 */}
            {items.length === 0 ? (
              <div className="text-center py-20">
                <Star className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">还没有愿望</p>
                <button
                  onClick={handleAdd}
                  className="mt-4 text-accent hover:underline"
                >
                  添加第一个愿望
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-6 rounded-2xl shadow-lg transition-all ${
                      item.completed
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex gap-4">
                      <button
                        onClick={() => toggleComplete(item)}
                        className="mt-1 flex-shrink-0"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-400 hover:text-accent transition-colors" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <h3 className={`text-lg font-semibold mb-1 ${
                          item.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''
                        }`}>
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className={`text-gray-600 dark:text-gray-400 mb-3 ${
                            item.completed ? 'line-through' : ''
                          }`}>
                            {item.description}
                          </p>
                        )}

                        {item.completed && item.completed_at && (
                          <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1 mb-3">
                            <Calendar className="w-4 h-4" />
                            完成于 {new Date(item.completed_at).toLocaleDateString('zh-CN')}
                          </p>
                        )}

                        {item.completion_image_url && (
                          <div className="rounded-xl overflow-hidden w-40">
                            <img
                              src={item.completion_image_url}
                              alt={item.title}
                              className="w-full h-28 object-cover"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
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

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
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
                    {editingItem ? '编辑愿望' : '添加新愿望'}
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
                  <label className="block text-sm font-medium mb-2">愿望</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="想要一起做什么"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    placeholder="详细描述一下..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">完成纪念照（可选）</label>
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="预览"
                        className="w-full h-48 object-cover rounded-2xl"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-accent transition-colors"
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-500 dark:text-gray-400">点击选择照片</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  )}
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
