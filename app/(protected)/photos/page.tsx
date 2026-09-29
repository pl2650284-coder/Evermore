'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Plus, X, Calendar, MapPin, Search,
  LayoutGrid, Clock, Globe, Filter,
  ChevronLeft, ChevronRight, Image as ImageIcon,
  ChevronDown, PlusCircle, Upload
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Section from '@/components/Section';
import {
  usePhotos, useTags,
  PROVINCES, getCitiesByProvince, getDistrictsByCity,
  sortProvinces, sortCities, sortDistricts
} from '@/lib/data';
import { useCouple } from '@/lib/couple';
import { uploadFile } from '@/lib/storage';

export default function PhotosPage() {
  const { photos, loading, addPhoto } = usePhotos();
  const { tags, loading: tagsLoading, addTag } = useTags();
  const { couple } = useCouple();

  // 基础状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'map'>('grid');

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'year' | 'month' | '30days' | 'custom'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 上传表单状态
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taken_at: '',
    province: '',
    city: '',
    district: '',
  });
  const [selectedPhotoTags, setSelectedPhotoTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取已使用的地点
  const usedLocations = useMemo(() => {
    const provinces = new Set<string>();
    const cities = new Set<string>();
    const districts = new Set<string>();

    photos.forEach(p => {
      if (p.province) provinces.add(p.province);
      if (p.city) cities.add(p.city);
      if (p.district) districts.add(p.district);
    });

    return {
      provinces: sortProvinces(Array.from(provinces)),
      cities: sortCities(Array.from(cities), selectedProvince),
      districts: sortDistricts(Array.from(districts), selectedCity)
    };
  }, [photos, selectedProvince, selectedCity]);

  // 获取当前城市列表
  const currentCities = useMemo(() => {
    return getCitiesByProvince(formData.province);
  }, [formData.province]);

  // 获取当前区县列表
  const currentDistricts = useMemo(() => {
    return getDistrictsByCity(formData.city);
  }, [formData.city]);

  // 筛选照片
  const filteredPhotos = useMemo(() => {
    let result = [...photos];

    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    // 时间筛选
    if (timeFilter !== 'all') {
      const now = new Date();
      result = result.filter(p => {
        if (!p.taken_at) return false;
        const photoDate = new Date(p.taken_at);

        switch (timeFilter) {
          case 'year':
            return photoDate.getFullYear() === now.getFullYear();
          case 'month':
            return photoDate.getFullYear() === now.getFullYear() &&
                   photoDate.getMonth() === now.getMonth();
          case '30days':
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return photoDate >= thirtyDaysAgo;
          case 'custom':
            if (customStartDate && customEndDate) {
              const start = new Date(customStartDate);
              const end = new Date(customEndDate);
              return photoDate >= start && photoDate <= end;
            }
            return true;
          default:
            return true;
        }
      });
    }

    // 地点筛选
    if (selectedProvince) {
      result = result.filter(p => p.province === selectedProvince);
    }
    if (selectedCity) {
      result = result.filter(p => p.city === selectedCity);
    }
    if (selectedDistrict) {
      result = result.filter(p => p.district === selectedDistrict);
    }

    // 标签筛选
    if (selectedTags.length > 0) {
      result = result.filter(p => {
        const photoTagIds = (p.photo_tags || []).map(pt => pt.tag?.id).filter(Boolean);
        return selectedTags.some(tagId => photoTagIds.includes(tagId));
      });
    }

    return result;
  }, [photos, searchQuery, timeFilter, customStartDate, customEndDate,
      selectedProvince, selectedCity, selectedDistrict, selectedTags]);

  // 计算统计数据
  const stats = useMemo(() => {
    const cities = new Set<string>();
    const districts = new Set<string>();
    const monthCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};

    photos.forEach(p => {
      if (p.city) cities.add(p.city);
      if (p.district) districts.add(p.district);
      if (p.taken_at) {
        const month = new Date(p.taken_at).toLocaleDateString('zh-CN', { month: 'long' });
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
      if (p.district) {
        locationCounts[p.district] = (locationCounts[p.district] || 0) + 1;
      } else if (p.city) {
        locationCounts[p.city] = (locationCounts[p.city] || 0) + 1;
      }
    });

    const mostCommonMonth = Object.entries(monthCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    const mostCommonLocation = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    // 计算恋爱总天数
    let totalDays = 0;
    if (couple?.start_date) {
      totalDays = Math.floor((Date.now() - new Date(couple.start_date).getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      totalPhotos: photos.length,
      cities: cities.size,
      districts: districts.size,
      mostCommonMonth,
      mostCommonLocation,
      totalDays
    };
  }, [photos, couple]);

  // 计算恋爱天数
  const getLoveDays = (dateStr: string) => {
    if (!couple?.start_date) return null;
    const photoDate = new Date(dateStr);
    const startDate = new Date(couple.start_date);
    return Math.floor((photoDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  // 按年月分组照片（时间轴视图用）
  const groupedPhotos = useMemo(() => {
    const groups: Record<string, typeof photos> = {};
    filteredPhotos.forEach(photo => {
      const date = photo.taken_at ? new Date(photo.taken_at) : new Date(photo.created_at);
      const key = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(photo);
    });
    return groups;
  }, [filteredPhotos]);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImageFiles(files);
      const previews = files.map(file => URL.createObjectURL(file));
      setImagePreviews(previews);
    }
  };

  // 清空选择
  const clearImages = () => {
    setImageFiles([]);
    setImagePreviews([]);
    setFormData({
      title: '',
      description: '',
      taken_at: '',
      province: '',
      city: '',
      district: '',
    });
    setSelectedPhotoTags([]);
    setNewTagName('');
    setShowNewTagInput(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 打开添加对话框
  const handleAdd = () => {
    clearImages();
    setIsModalOpen(true);
  };

  // 创建新标签
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const newTag = await addTag(newTagName.trim());
      setSelectedPhotoTags([...selectedPhotoTags, newTag.id]);
      setNewTagName('');
      setShowNewTagInput(false);
    } catch (e) {
      console.error('创建标签错误:', e);
      alert('创建标签失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  // 保存照片
  const handleSave = async () => {
    if (imageFiles.length === 0) {
      alert('请选择照片');
      return;
    }

    try {
      setUploading(true);

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const url = await uploadFile(file, 'photos');

        let title = formData.title;
        if (imageFiles.length > 1) {
          title = formData.title ? `${formData.title} (${i + 1})` : `照片 ${i + 1}`;
        }

        await addPhoto({
          image_url: url,
          title: title || '',
          description: formData.description || null,
          taken_at: formData.taken_at || null,
          province: formData.province || null,
          city: formData.city || null,
          district: formData.district || null,
        }, selectedPhotoTags);
      }

      setIsModalOpen(false);
      setUploading(false);
    } catch (e) {
      console.error(e);
      alert('保存失败，请重试');
      setUploading(false);
    }
  };

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewingPhotoIndex === null) return;

      if (e.key === 'Escape') {
        setViewingPhotoIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setViewingPhotoIndex(prev =>
          prev !== null ? Math.max(0, prev - 1) : null
        );
      } else if (e.key === 'ArrowRight') {
        setViewingPhotoIndex(prev =>
          prev !== null ? Math.min(filteredPhotos.length - 1, prev + 1) : null
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPhotoIndex, filteredPhotos]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-24 pb-12">
        <Section>
          <div className="max-w-7xl mx-auto">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold mb-2">照片博物馆</h1>
                <p className="text-gray-600 dark:text-gray-400">收藏我们的每一个美好瞬间</p>
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full hover:opacity-90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                上传照片
              </button>
            </div>

            {/* 统计卡片 */}
            {!loading && photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="text-3xl font-bold text-accent">{stats.totalPhotos}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">照片总数</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="text-3xl font-bold text-purple-500">{stats.cities}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">去过城市</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="text-3xl font-bold text-pink-500">{stats.districts}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">打卡地点</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="text-3xl font-bold text-orange-500 truncate">{stats.mostCommonMonth}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">最爱月份</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="text-3xl font-bold text-green-500 truncate">{stats.mostCommonLocation}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">常去地点</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="text-3xl font-bold text-blue-500">{stats.totalDays}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">恋爱天数</div>
                </motion.div>
              </div>
            )}

            {/* 搜索和筛选栏 */}
            <div className="mb-6">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                {/* 搜索框 */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索照片标题、描述..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* 视图切换 */}
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'timeline' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'map' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                  </button>
                </div>

                {/* 筛选按钮 */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                    showFilters ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  筛选
                </button>
              </div>

              {/* 展开的筛选选项 */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg overflow-hidden"
                  >
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* 时间筛选 */}
                      <div>
                        <label className="block text-sm font-medium mb-3">时间</label>
                        <div className="space-y-2">
                          {[
                            { value: 'all', label: '全部' },
                            { value: 'year', label: '今年' },
                            { value: 'month', label: '本月' },
                            { value: '30days', label: '最近30天' },
                            { value: 'custom', label: '自定义' },
                          ].map((item) => (
                            <button
                              key={item.value}
                              onClick={() => setTimeFilter(item.value as any)}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                                timeFilter === item.value
                                  ? 'bg-accent/10 text-accent'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        {timeFilter === 'custom' && (
                          <div className="mt-3 space-y-2">
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm"
                              placeholder="开始日期"
                            />
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm"
                              placeholder="结束日期"
                            />
                          </div>
                        )}
                      </div>

                      {/* 地点筛选 */}
                      <div>
                        <label className="block text-sm font-medium mb-3">地点</label>
                        <div className="space-y-2">
                          <select
                            value={selectedProvince}
                            onChange={(e) => {
                              setSelectedProvince(e.target.value);
                              setSelectedCity('');
                              setSelectedDistrict('');
                            }}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <option value="">全部省份</option>
                            {usedLocations.provinces.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          {selectedProvince && usedLocations.cities.length > 0 && (
                            <select
                              value={selectedCity}
                              onChange={(e) => {
                                setSelectedCity(e.target.value);
                                setSelectedDistrict('');
                              }}
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <option value="">全部城市</option>
                              {usedLocations.cities.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          )}
                          {selectedCity && usedLocations.districts.length > 0 && (
                            <select
                              value={selectedDistrict}
                              onChange={(e) => setSelectedDistrict(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <option value="">全部区县</option>
                              {usedLocations.districts.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* 标签筛选 */}
                      <div>
                        <label className="block text-sm font-medium mb-3">标签</label>
                        <div className="flex flex-wrap gap-2">
                          {tagsLoading ? (
                            <span className="text-gray-500 text-sm">加载中...</span>
                          ) : tags.length === 0 ? (
                            <span className="text-gray-500 text-sm">暂无标签</span>
                          ) : (
                            tags.map(tag => (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  setSelectedTags(prev =>
                                    prev.includes(tag.id)
                                      ? prev.filter(t => t !== tag.id)
                                      : [...prev, tag.id]
                                  );
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                  selectedTags.includes(tag.id)
                                    ? 'bg-accent text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                {tag.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 重置按钮 */}
                      <div className="flex items-end">
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setTimeFilter('all');
                            setSelectedTags([]);
                            setSelectedProvince('');
                            setSelectedCity('');
                            setSelectedDistrict('');
                            setCustomStartDate('');
                            setCustomEndDate('');
                          }}
                          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          重置筛选
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 加载状态 */}
            {loading ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">加载中...</p>
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">还没有上传照片</p>
                <button onClick={handleAdd} className="mt-4 text-accent hover:underline">
                  上传第一张照片
                </button>
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">没有找到符合条件的照片</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setTimeFilter('all');
                    setSelectedTags([]);
                    setSelectedProvince('');
                    setSelectedCity('');
                    setSelectedDistrict('');
                  }}
                  className="mt-4 text-accent hover:underline"
                >
                  清除筛选
                </button>
              </div>
            ) : (
              <>
                {/* 相册视图 - 瀑布流 */}
                {viewMode === 'grid' && (
                  <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                    {filteredPhotos.map((photo, index) => {
                      const loveDays = photo.taken_at ? getLoveDays(photo.taken_at) : null;
                      const photoTags = (photo.photo_tags || []).map(pt => pt.tag?.name).filter(Boolean);
                      return (
                        <motion.div
                          key={photo.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="break-inside-avoid cursor-pointer group"
                          onClick={() => setViewingPhotoIndex(index)}
                        >
                          <div className="relative rounded-2xl overflow-hidden shadow-lg bg-gray-100 dark:bg-gray-800">
                            <img
                              src={photo.image_url}
                              alt={photo.title || '照片'}
                              className="w-full h-auto group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                            {/* 悬浮信息 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                              {photo.title && (
                                <h3 className="text-white font-semibold text-lg mb-1">{photo.title}</h3>
                              )}
                              <div className="flex items-center gap-3 text-sm text-white/80">
                                {photo.taken_at && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(photo.taken_at).toLocaleDateString('zh-CN')}
                                  </div>
                                )}
                                {(photo.district || photo.city || photo.province) && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {photo.district || photo.city || photo.province}
                                  </div>
                                )}
                              </div>
                              {photoTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {photoTags.map(tagName => (
                                    <span key={tagName} className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                                      {tagName}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {loveDays !== null && loveDays >= 0 && (
                                <div className="mt-2 text-xs text-pink-300">
                                  恋爱第 {loveDays} 天
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* 时间轴视图 */}
                {viewMode === 'timeline' && (
                  <div className="space-y-8">
                    {Object.entries(groupedPhotos).map(([month, monthPhotos], monthIndex) => (
                      <motion.div
                        key={month}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: monthIndex * 0.1 }}
                      >
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                          <Calendar className="w-6 h-6 text-accent" />
                          {month}
                          <span className="text-sm text-gray-400 font-normal">({monthPhotos.length} 张)</span>
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                          {monthPhotos.map((photo, index) => {
                            const originalIndex = filteredPhotos.findIndex(p => p.id === photo.id);
                            return (
                              <motion.div
                                key={photo.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: monthIndex * 0.1 + index * 0.02 }}
                                className="aspect-square rounded-xl overflow-hidden shadow cursor-pointer group"
                                onClick={() => setViewingPhotoIndex(originalIndex)}
                              >
                                <img
                                  src={photo.image_url}
                                  alt={photo.title || '照片'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* 地图视图 - 简化版 */}
                {viewMode === 'map' && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-3xl p-8 text-center">
                    <Globe className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400 mb-2">地图视图开发中...</p>
                    <p className="text-sm text-gray-400">
                      需要集成地图 SDK（如高德地图、谷歌地图）来显示照片位置
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Section>
      </div>

      {/* 查看照片弹窗 */}
      <AnimatePresence>
        {viewingPhotoIndex !== null && filteredPhotos[viewingPhotoIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setViewingPhotoIndex(null)}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setViewingPhotoIndex(null)}
              className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors z-10"
            >
              <X className="w-8 h-8" />
            </button>

            {/* 上一张按钮 */}
            {viewingPhotoIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingPhotoIndex(prev => (prev !== null ? prev - 1 : null));
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* 下一张按钮 */}
            {viewingPhotoIndex < filteredPhotos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingPhotoIndex(prev => (prev !== null ? prev + 1 : null));
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-6xl max-h-[90vh] w-full flex flex-col lg:flex-row gap-8 px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 图片 */}
              <div className="flex-1 flex items-center justify-center">
                <img
                  src={filteredPhotos[viewingPhotoIndex].image_url}
                  alt={filteredPhotos[viewingPhotoIndex].title || '照片'}
                  className="max-h-[70vh] w-auto rounded-lg"
                />
              </div>

              {/* 信息面板 */}
              <div className="lg:w-80 text-white space-y-6">
                {filteredPhotos[viewingPhotoIndex].title && (
                  <h2 className="text-2xl font-bold">{filteredPhotos[viewingPhotoIndex].title}</h2>
                )}

                {/* 基本信息 */}
                <div className="space-y-3">
                  {filteredPhotos[viewingPhotoIndex].taken_at && (
                    <div className="flex items-center gap-3 text-white/70">
                      <Calendar className="w-5 h-5" />
                      <div>
                        <div>{new Date(filteredPhotos[viewingPhotoIndex].taken_at).toLocaleDateString('zh-CN')}</div>
                        {(() => {
                          const loveDays = getLoveDays(filteredPhotos[viewingPhotoIndex].taken_at!);
                          if (loveDays !== null && loveDays >= 0) {
                            return <div className="text-pink-400 text-sm mt-1">恋爱第 {loveDays} 天</div>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                  {(filteredPhotos[viewingPhotoIndex].district || filteredPhotos[viewingPhotoIndex].city || filteredPhotos[viewingPhotoIndex].province) && (
                    <div className="flex items-center gap-3 text-white/70">
                      <MapPin className="w-5 h-5" />
                      <span>
                        {[
                          filteredPhotos[viewingPhotoIndex].province,
                          filteredPhotos[viewingPhotoIndex].city,
                          filteredPhotos[viewingPhotoIndex].district
                        ].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* 标签 */}
                {(() => {
                  const photoTags = (filteredPhotos[viewingPhotoIndex].photo_tags || [])
                    .map(pt => pt.tag?.name)
                    .filter(Boolean);
                  if (photoTags.length > 0) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        {photoTags.map(tagName => (
                          <span key={tagName} className="px-3 py-1 bg-white/10 rounded-full text-sm">
                            {tagName}
                          </span>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* 描述 */}
                {filteredPhotos[viewingPhotoIndex].description && (
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-white/80 whitespace-pre-wrap">
                      {filteredPhotos[viewingPhotoIndex].description}
                    </p>
                  </div>
                )}

                {/* 上传时间 */}
                <div className="pt-4 border-t border-white/10 text-sm text-white/50">
                  上传于 {new Date(filteredPhotos[viewingPhotoIndex].created_at).toLocaleDateString('zh-CN')}
                </div>

                {/* 页码指示 */}
                <div className="pt-4 text-center text-white/50 text-sm">
                  {viewingPhotoIndex + 1} / {filteredPhotos.length}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 上传照片弹窗 */}
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
              className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">上传照片</h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {/* 照片选择 */}
                <div>
                  <label className="block text-sm font-medium mb-2">选择照片</label>
                  {imagePreviews.length > 0 ? (
                    <div>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {imagePreviews.map((preview, idx) => (
                          <div key={idx} className="aspect-square rounded-lg overflow-hidden">
                            <img src={preview} alt={`预览 ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={clearImages}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        重新选择
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-12 text-center cursor-pointer hover:border-accent transition-colors"
                    >
                      <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600 dark:text-gray-400 mb-1">点击选择照片</p>
                      <p className="text-sm text-gray-400">可以一次选择多张</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {/* 标题 */}
                <div>
                  <label className="block text-sm font-medium mb-2">标题（可选）</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="给这些照片起个名字"
                  />
                </div>

                {/* 日期 */}
                <div>
                  <label className="block text-sm font-medium mb-2">日期（可选）</label>
                  <input
                    type="date"
                    value={formData.taken_at}
                    onChange={(e) => setFormData({ ...formData, taken_at: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* 地点选择 */}
                <div>
                  <label className="block text-sm font-medium mb-2">地点（可选）</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={formData.province}
                      onChange={(e) => {
                        setFormData({ ...formData, province: e.target.value, city: '', district: '' });
                      }}
                      className="px-3 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">省份</option>
                      {PROVINCES.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <select
                      value={formData.city}
                      onChange={(e) => {
                        setFormData({ ...formData, city: e.target.value, district: '' });
                      }}
                      disabled={!formData.province}
                      className="px-3 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                    >
                      <option value="">城市</option>
                      {currentCities.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      disabled={!formData.city}
                      className="px-3 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                    >
                      <option value="">区县</option>
                      {currentDistricts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 标签 */}
                <div>
                  <label className="block text-sm font-medium mb-2">标签（可选）</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tagsLoading ? (
                      <span className="text-gray-500 text-sm">加载中...</span>
                    ) : tags.length === 0 ? (
                      <span className="text-gray-500 text-sm">暂无标签，创建一个吧</span>
                    ) : (
                      tags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedPhotoTags(prev =>
                              prev.includes(tag.id)
                                ? prev.filter(t => t !== tag.id)
                                : [...prev, tag.id]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            selectedPhotoTags.includes(tag.id)
                              ? 'bg-accent text-white'
                              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {tag.name}
                        </button>
                      ))
                    )}
                  </div>
                  {!showNewTagInput ? (
                    <button
                      onClick={() => setShowNewTagInput(true)}
                      className="flex items-center gap-1 text-accent hover:underline text-sm"
                    >
                      <PlusCircle className="w-4 h-4" />
                      创建新标签
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="输入标签名称"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        autoFocus
                      />
                      <button
                        onClick={handleCreateTag}
                        className="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90"
                      >
                        确定
                      </button>
                      <button
                        onClick={() => {
                          setShowNewTagInput(false);
                          setNewTagName('');
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:opacity-90"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-sm font-medium mb-2">描述（可选）</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    placeholder="写下关于这些照片的故事..."
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
                  disabled={uploading || imageFiles.length === 0}
                  className="flex-1 py-4 bg-accent text-white rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {uploading ? `上传中 ${imageFiles.length} 张...` : `上传 ${imageFiles.length} 张`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
