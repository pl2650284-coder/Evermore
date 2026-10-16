'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Plus, Edit2, Trash2, X, Upload, Calendar, Tag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useGifts } from '@/lib/data';
import { uploadFile } from '@/lib/storage';
import { useCouple } from '@/lib/couple';

const giftCategories = [
  { value: 'jewelry', label: '首饰' },
  { value: 'clothes', label: '衣服' },
  { value: 'books', label: '书籍' },
  { value: 'electronics', label: '电子产品' },
  { value: 'experience', label: '体验/旅行' },
  { value: 'handmade', label: '手工制作' },
  { value: 'other', label: '其他' },
];

export default function GiftsPage() {
  const { gifts, loading, addGift, updateGift, deleteGift } = useGifts();
  const { couple } = useCouple();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    given_by: '',
    given_to: '',
    given_date: new Date().toISOString().split('T')[0],
    category: '',
    image_url: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setFormData({ ...formData, image_url: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAdd = () => {
    setEditingGift(null);
    setFormData({
      title: '',
      description: '',
      given_by: couple?.partner1_name || '',
      given_to: couple?.partner2_name || '',
      given_date: new Date().toISOString().split('T')[0],
      category: '',
      image_url: '',
    });
    setImageFile(null);
    setImagePreview('');
    setIsModalOpen(true);
  };

  const handleEdit = (gift: any) => {
    setEditingGift(gift);
    setFormData({
      title: gift.title,
      description: gift.description || '',
      given_by: gift.given_by,
      given_to: gift.given_to,
      given_date: gift.given_date,
      category: gift.category || '',
      image_url: gift.image_url || '',
    });
    setImageFile(null);
    setImagePreview(gift.image_url || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这份礼物记录吗？')) return;
    try {
      await deleteGift(id);
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      alert('请填写礼物名称');
      return;
    }
    if (!formData.given_by || !formData.given_to) {
      alert('请填写赠送者和接收者');
      return;
    }

    try {
      let finalImageUrl = formData.image_url;

      if (imageFile) {
        setUploading(true);
        finalImageUrl = await uploadFile(imageFile, 'gifts');
        setUploading(false);
      }

      if (editingGift) {
        await updateGift(editingGift.id, {
          title: formData.title,
          description: formData.description || null,
          given_by: formData.given_by,
          given_to: formData.given_to,
          given_date: formData.given_date,
          category: formData.category || null,
          image_url: finalImageUrl || null,
        });
      } else {
        await addGift({
          title: formData.title,
          description: formData.description || null,
          given_by: formData.given_by,
          given_to: formData.given_to,
          given_date: formData.given_date,
          category: formData.category || null,
          image_url: finalImageUrl || null,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('保存失败，请重试');
    }
  };

  const getCategoryLabel = (category: string) => {
    return giftCategories.find(c => c.value === category)?.label || category;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="page-shell">
        <main className="page-container">
          <div>
            <div className="page-header">
              <div>
                <Link href="/memorial" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2 inline-block">
                  ← 返回纪念馆
                </Link>
                <h1 className="page-title">礼物馆</h1>
                <p className="page-description">记录每份礼物背后的故事</p>
              </div>
              <button
                onClick={handleAdd}
                className="button-primary"
              >
                <Plus className="w-5 h-5" />
                添加礼物
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">加载中...</p>
              </div>
            ) : gifts.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <Gift className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">还没有记录任何礼物</p>
                <button onClick={handleAdd} className="mt-4 text-accent hover:underline">
                  记录第一份礼物
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gifts.map((gift) => (
                  <motion.div
                    key={gift.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                  >
                    {gift.image_url ? (
                      <div className="aspect-square overflow-hidden">
                        <img
                          src={gift.image_url}
                          alt={gift.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                        <Gift className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{gift.title}</h3>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(gift)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(gift.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <span>{gift.given_by}</span>
                          <span>→</span>
                          <span>{gift.given_to}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(gift.given_date).toLocaleDateString('zh-CN')}
                        </div>
                        {gift.category && (
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-4 h-4" />
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                              {getCategoryLabel(gift.category)}
                            </span>
                          </div>
                        )}
                      </div>
                      {gift.description && (
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {gift.description}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

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
                    {editingGift ? '编辑礼物' : '添加礼物'}
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
                  <label className="block text-sm font-medium mb-2">礼物名称</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="这是什么礼物？"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">赠送者</label>
                    <input
                      type="text"
                      value={formData.given_by}
                      onChange={(e) => setFormData({ ...formData, given_by: e.target.value })}
                      className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">接收者</label>
                    <input
                      type="text"
                      value={formData.given_to}
                      onChange={(e) => setFormData({ ...formData, given_to: e.target.value })}
                      className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">赠送日期</label>
                    <input
                      type="date"
                      value={formData.given_date}
                      onChange={(e) => setFormData({ ...formData, given_date: e.target.value })}
                      className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">分类（可选）</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">选择分类</option>
                      {giftCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">照片（可选）</label>
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
                      <p className="text-gray-500 dark:text-gray-400">点击上传照片</p>
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
                <div>
                  <label className="block text-sm font-medium mb-2">故事（可选）</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    placeholder="说说这份礼物背后的故事..."
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
                  disabled={uploading}
                  className="flex-1 py-4 bg-accent text-white rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {uploading ? '上传中...' : '保存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
