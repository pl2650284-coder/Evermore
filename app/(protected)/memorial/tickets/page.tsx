'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Plus, Edit2, Trash2, X, Upload, Calendar, MapPin, Tag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useTickets } from '@/lib/data';
import { uploadFile } from '@/lib/storage';

const ticketCategories = [
  { value: 'movie', label: '电影票' },
  { value: 'concert', label: '演唱会' },
  { value: 'travel', label: '车票/机票' },
  { value: 'theme_park', label: '主题乐园' },
  { value: 'museum', label: '博物馆/展览' },
  { value: 'restaurant', label: '餐厅预约' },
  { value: 'other', label: '其他' },
];

export default function TicketsPage() {
  const { tickets, loading, addTicket, updateTicket, deleteTicket } = useTickets();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    category: '',
    location: '',
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
    setEditingTicket(null);
    setFormData({
      title: '',
      description: '',
      event_date: new Date().toISOString().split('T')[0],
      category: '',
      location: '',
      image_url: '',
    });
    setImageFile(null);
    setImagePreview('');
    setIsModalOpen(true);
  };

  const handleEdit = (ticket: any) => {
    setEditingTicket(ticket);
    setFormData({
      title: ticket.title,
      description: ticket.description || '',
      event_date: ticket.event_date,
      category: ticket.category || '',
      location: ticket.location || '',
      image_url: ticket.image_url,
    });
    setImageFile(null);
    setImagePreview(ticket.image_url);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这张票据吗？')) return;
    try {
      await deleteTicket(id);
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      alert('请填写标题');
      return;
    }
    if (!imageFile && !formData.image_url) {
      alert('请上传票据照片');
      return;
    }

    try {
      let finalImageUrl = formData.image_url;

      if (imageFile) {
        setUploading(true);
        finalImageUrl = await uploadFile(imageFile, 'tickets');
        setUploading(false);
      }

      if (editingTicket) {
        await updateTicket(editingTicket.id, {
          title: formData.title,
          description: formData.description || null,
          event_date: formData.event_date,
          category: formData.category || null,
          location: formData.location || null,
          image_url: finalImageUrl,
        });
      } else {
        await addTicket({
          title: formData.title,
          description: formData.description || null,
          event_date: formData.event_date,
          category: formData.category || null,
          location: formData.location || null,
          image_url: finalImageUrl,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('保存失败，请重试');
    }
  };

  const getCategoryLabel = (category: string) => {
    return ticketCategories.find(c => c.value === category)?.label || category;
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
                <h1 className="page-title">门票馆</h1>
                <p className="page-description">保存每一张票据</p>
              </div>
              <button
                onClick={handleAdd}
                className="button-primary"
              >
                <Plus className="w-5 h-5" />
                添加票据
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">加载中...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <Ticket className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">还没有收藏任何票据</p>
                <button onClick={handleAdd} className="mt-4 text-accent hover:underline">
                  收藏第一张票据
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tickets.map((ticket) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <img
                        src={ticket.image_url}
                        alt={ticket.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(ticket)}
                            className="p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-full transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ticket.id)}
                            className="p-2 bg-white/20 backdrop-blur-sm hover:bg-red-500/50 text-white rounded-full transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold mb-2">{ticket.title}</h3>
                      <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(ticket.event_date).toLocaleDateString('zh-CN')}
                        </div>
                        {ticket.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
                            {ticket.location}
                          </div>
                        )}
                        {ticket.category && (
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-4 h-4" />
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                              {getCategoryLabel(ticket.category)}
                            </span>
                          </div>
                        )}
                      </div>
                      {ticket.description && (
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {ticket.description}
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
                    {editingTicket ? '编辑票据' : '添加票据'}
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
                    placeholder="这是什么票据？"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">日期</label>
                    <input
                      type="date"
                      value={formData.event_date}
                      onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
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
                      {ticketCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">地点（可选）</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="在哪里？"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">票据照片</label>
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
                      <p className="text-gray-500 dark:text-gray-400">上传票据照片</p>
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
                  <label className="block text-sm font-medium mb-2">备注（可选）</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    placeholder="写点什么..."
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
