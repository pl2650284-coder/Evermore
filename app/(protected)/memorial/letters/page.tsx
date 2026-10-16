'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Plus, Edit2, Trash2, X, Upload, Calendar, PenLine } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useLetters } from '@/lib/data';
import { uploadFile } from '@/lib/storage';
import { useCouple } from '@/lib/couple';

export default function LettersPage() {
  const { letters, loading, addLetter, updateLetter, deleteLetter } = useLetters();
  const { couple } = useCouple();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLetter, setEditingLetter] = useState<any>(null);
  const [viewingLetter, setViewingLetter] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    from_partner: '',
    to_partner: '',
    written_date: new Date().toISOString().split('T')[0],
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
    setEditingLetter(null);
    setViewingLetter(null);
    setFormData({
      title: '',
      content: '',
      from_partner: couple?.partner1_name || '',
      to_partner: couple?.partner2_name || '',
      written_date: new Date().toISOString().split('T')[0],
      image_url: '',
    });
    setImageFile(null);
    setImagePreview('');
    setIsModalOpen(true);
  };

  const handleEdit = (letter: any) => {
    setEditingLetter(letter);
    setViewingLetter(null);
    setFormData({
      title: letter.title,
      content: letter.content,
      from_partner: letter.from_partner,
      to_partner: letter.to_partner,
      written_date: letter.written_date,
      image_url: letter.image_url || '',
    });
    setImageFile(null);
    setImagePreview(letter.image_url || '');
    setIsModalOpen(true);
  };

  const handleView = (letter: any) => {
    setViewingLetter(letter);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这封信吗？')) return;
    try {
      await deleteLetter(id);
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      alert('请填写信的标题');
      return;
    }
    if (!formData.content) {
      alert('请写点什么吧');
      return;
    }
    if (!formData.from_partner || !formData.to_partner) {
      alert('请填写写信人和收信人');
      return;
    }

    try {
      let finalImageUrl = formData.image_url;

      if (imageFile) {
        setUploading(true);
        finalImageUrl = await uploadFile(imageFile, 'letters');
        setUploading(false);
      }

      if (editingLetter) {
        await updateLetter(editingLetter.id, {
          title: formData.title,
          content: formData.content,
          from_partner: formData.from_partner,
          to_partner: formData.to_partner,
          written_date: formData.written_date,
          image_url: finalImageUrl || null,
        });
      } else {
        await addLetter({
          title: formData.title,
          content: formData.content,
          from_partner: formData.from_partner,
          to_partner: formData.to_partner,
          written_date: formData.written_date,
          image_url: finalImageUrl || null,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('保存失败，请重试');
    }
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
                <h1 className="page-title">信件馆</h1>
                <p className="page-description">收藏每一封情书和手写信</p>
              </div>
              <button
                onClick={handleAdd}
                className="button-primary"
              >
                <Plus className="w-5 h-5" />
                写一封信
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">加载中...</p>
              </div>
            ) : letters.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <Mail className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">还没有收藏任何信件</p>
                <button onClick={handleAdd} className="mt-4 text-accent hover:underline">
                  写第一封信
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {letters.map((letter) => (
                  <motion.div
                    key={letter.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
                  >
                    {letter.image_url ? (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={letter.image_url}
                          alt={letter.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 flex items-center justify-center">
                        <Mail className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    <div className="p-5" onClick={() => handleView(letter)}>
                      <h3 className="text-lg font-semibold mb-2">{letter.title}</h3>
                      <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <div className="flex items-center gap-1.5">
                          <PenLine className="w-4 h-4" />
                          <span>{letter.from_partner}</span>
                          <span>→</span>
                          <span>{letter.to_partner}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(letter.written_date).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {letter.content}
                      </p>
                    </div>
                    <div className="px-5 pb-5 pt-0 flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(letter); }}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(letter.id); }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 查看信件弹窗 */}
      <AnimatePresence>
        {viewingLetter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setViewingLetter(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {viewingLetter.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={viewingLetter.image_url}
                    alt={viewingLetter.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="section-title">{viewingLetter.title}</h2>
                  <button
                    onClick={() => setViewingLetter(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                  <div className="flex items-center gap-1.5">
                    <PenLine className="w-4 h-4" />
                    <span>{viewingLetter.from_partner}</span>
                    <span>→</span>
                    <span>{viewingLetter.to_partner}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(viewingLetter.written_date).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                  {viewingLetter.content}
                </div>
                <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => { setViewingLetter(null); handleEdit(viewingLetter); }}
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

      {/* 编辑/添加弹窗 */}
      <AnimatePresence>
        {isModalOpen && !viewingLetter && (
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
                    {editingLetter ? '编辑信' : '写一封信'}
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
                    placeholder="给这封信起个名字"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">写信人</label>
                    <input
                      type="text"
                      value={formData.from_partner}
                      onChange={(e) => setFormData({ ...formData, from_partner: e.target.value })}
                      className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">收信人</label>
                    <input
                      type="text"
                      value={formData.to_partner}
                      onChange={(e) => setFormData({ ...formData, to_partner: e.target.value })}
                      className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">写信日期</label>
                  <input
                    type="date"
                    value={formData.written_date}
                    onChange={(e) => setFormData({ ...formData, written_date: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">照片/手写信（可选）</label>
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
                      <p className="text-gray-500 dark:text-gray-400">上传照片或手写信</p>
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
                  <label className="block text-sm font-medium mb-2">内容</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    placeholder="写下你想说的话..."
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
