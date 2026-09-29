'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Plus, Edit2, Trash2, X, Upload, CheckCircle, AlertCircle, Loader2, Search, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Section from '@/components/Section';
import { useTimelineEvents, PROVINCES, getCitiesByProvince, getDistrictsByCity } from '@/lib/data';
import { uploadFile } from '@/lib/storage';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type PhotoFilter = 'all' | 'with' | 'without';

// 辅助函数：获取单张图片 URL
const getEventImageUrl = (event: any): string | null => {
  return event.image_url || null;
};

const getEventDateParts = (eventDate: string) => {
  const [year = '', month = ''] = eventDate.slice(0, 10).split('-');
  return { year, month };
};

export default function TimelinePage() {
  const { events, loading, addEvent, updateEvent, deleteEvent } = useTimelineEvents();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    location: '',
    province: '',
    city: '',
    district: '',
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const isSavingRef = useRef(false);

  const currentCities = getCitiesByProvince(formData.province);
  const currentDistricts = getDistrictsByCity(formData.city);

  const availableYears = useMemo(() => {
    return Array.from(new Set(events.map(event => getEventDateParts(event.event_date).year)))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
  }, [events]);

  const availableMonths = useMemo(() => {
    const sourceEvents = selectedYear === 'all'
      ? events
      : events.filter(event => getEventDateParts(event.event_date).year === selectedYear);

    return Array.from(new Set(sourceEvents.map(event => getEventDateParts(event.event_date).month)))
      .filter(Boolean)
      .sort((a, b) => Number(b) - Number(a));
  }, [events, selectedYear]);

  const availableLocations = useMemo(() => {
    return Array.from(new Set(
      events
        .map(event => event.location)
        .filter((location): location is string => Boolean(location))
    )).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter(event => {
      const { year, month } = getEventDateParts(event.event_date);
      const matchesQuery = !query || [event.title, event.description, event.location]
        .some(value => value?.toLowerCase().includes(query));
      const matchesYear = selectedYear === 'all' || year === selectedYear;
      const matchesMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchesLocation = selectedLocation === 'all' || event.location === selectedLocation;
      const hasPhoto = Boolean(getEventImageUrl(event));
      const matchesPhoto = photoFilter === 'all'
        || (photoFilter === 'with' && hasPhoto)
        || (photoFilter === 'without' && !hasPhoto);

      return matchesQuery && matchesYear && matchesMonth && matchesLocation && matchesPhoto;
    });
  }, [events, photoFilter, searchQuery, selectedLocation, selectedMonth, selectedYear]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      year: string;
      month: string;
      events: typeof events;
    }>();

    filteredEvents.forEach(event => {
      const { year, month } = getEventDateParts(event.event_date);
      const key = `${year}-${month}`;
      const group = groups.get(key);

      if (group) {
        group.events.push(event);
      } else {
        groups.set(key, { key, year, month, events: [event] });
      }
    });

    return Array.from(groups.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(group => ({
        ...group,
        events: [...group.events].sort((a, b) => b.event_date.localeCompare(a.event_date)),
      }));
  }, [events, filteredEvents]);

  useEffect(() => {
    if (groupedEvents.length === 0) return;

    setExpandedGroups(current => {
      if (groupedEvents.some(group => current.has(group.key))) {
        return current;
      }
      return new Set([groupedEvents[0].key]);
    });
  }, [groupedEvents]);

  const hasActiveFilters = searchQuery.trim() !== ''
    || selectedYear !== 'all'
    || selectedMonth !== 'all'
    || selectedLocation !== 'all'
    || photoFilter !== 'all';

  const allGroupsExpanded = groupedEvents.length > 0
    && groupedEvents.every(group => expandedGroups.has(group.key));

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedYear('all');
    setSelectedMonth('all');
    setSelectedLocation('all');
    setPhotoFilter('all');
    setExpandedGroups(new Set());
  }, []);

  const formatLocationDisplay = (province: string, city: string, district: string, locationText: string) => {
    const parts = [province, city, district].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
    return locationText;
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImageFiles(prev => [...prev, ...files]);
      const previews = files.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...previews]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeExistingUrl = useCallback((index: number) => {
    setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImageUrls([]);
  }, []);

  const handleAddEvent = useCallback(() => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      event_date: new Date().toISOString().split('T')[0],
      location: '',
      province: '',
      city: '',
      district: '',
    });
    clearImages();
    setUploadStatus('idle');
    setUploadMessage('');
    isSavingRef.current = false;
    setIsModalOpen(true);
  }, [clearImages]);

  const handleEditEvent = useCallback((event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      location: event.location || '',
      province: event.province || '',
      city: event.city || '',
      district: event.district || '',
    });
    clearImages();
    if (event.image_url) {
      setExistingImageUrls([event.image_url]);
    }
    setUploadStatus('idle');
    setUploadMessage('');
    isSavingRef.current = false;
    setIsModalOpen(true);
  }, [clearImages]);

  const handleDeleteEvent = useCallback(async (id: string) => {
    if (!confirm('确定要删除这个回忆吗？')) return;
    try {
      await deleteEvent(id);
    } catch (err) {
      alert('删除失败，请重试');
    }
  }, [deleteEvent]);

  const handleSaveEvent = useCallback(async () => {
    console.log('[handleSaveEvent] ========== 开始保存 ==========');
    if (!formData.title.trim()) {
      alert('请填写标题');
      return;
    }
    if (isSavingRef.current) {
      console.log('[handleSaveEvent] 正在保存中，忽略重复点击');
      return;
    }
    isSavingRef.current = true;
    setUploadStatus('uploading');

    try {
      const locationDisplay = formatLocationDisplay(
        formData.province,
        formData.city,
        formData.district,
        formData.location
      );

      console.log('[handleSaveEvent] 地点信息', { locationDisplay, formData });

      if (editingEvent) {
        console.log('[handleSaveEvent] 编辑模式，编辑事件ID:', editingEvent.id);
        // 编辑模式：处理已有图片
        let imageUrl = existingImageUrls.length > 0 ? existingImageUrls[0] : null;
        console.log('[handleSaveEvent] 现有图片URL:', imageUrl);

        // 上传新照片
        if (imageFiles.length > 0) {
          console.log('[handleSaveEvent] 开始上传新照片');
          setUploadMessage('正在上传照片...');
          const url = await uploadFile(imageFiles[0], 'timeline');
          console.log('[handleSaveEvent] 新照片上传成功，URL:', url);
          imageUrl = url;
        }

        setUploadMessage('正在保存回忆...');

        const saveData: any = {
          title: formData.title.trim(),
          description: formData.description || null,
          event_date: formData.event_date,
          location: locationDisplay || null,
          province: formData.province || null,
          city: formData.city || null,
          district: formData.district || null,
          image_url: imageUrl,
        };

        console.log('[handleSaveEvent] ========== 保存数据 ==========');
        console.log('[handleSaveEvent] saveData:', saveData);

        await updateEvent(editingEvent.id, saveData);
        console.log('[handleSaveEvent] 更新成功');
      } else {
        console.log('[handleSaveEvent] 添加新模式');
        // 添加模式：处理多张图片
        const allUrls = [...existingImageUrls];
        console.log('[handleSaveEvent] 已有URL列表:', allUrls);

        // 上传新照片
        if (imageFiles.length > 0) {
          console.log('[handleSaveEvent] 开始上传新照片，数量:', imageFiles.length);
          setUploadMessage(`正在上传照片 (0/${imageFiles.length})...`);
          for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            console.log(`[handleSaveEvent] 正在上传第 ${i + 1} 张照片:`, file.name);
            const url = await uploadFile(file, 'timeline');
            console.log(`[handleSaveEvent] 第 ${i + 1} 张照片上传成功:`, url);
            allUrls.push(url);
            setUploadMessage(`正在上传照片 (${i + 1}/${imageFiles.length})...`);
          }
        }

        console.log('[handleSaveEvent] 所有图片URL:', allUrls);
        setUploadMessage('正在保存回忆...');

        if (allUrls.length <= 1) {
          // 0 或 1 张图片：创建单个事件
          const saveData: any = {
            title: formData.title.trim(),
            description: formData.description || null,
            event_date: formData.event_date,
            location: locationDisplay || null,
            province: formData.province || null,
            city: formData.city || null,
            district: formData.district || null,
            image_url: allUrls.length > 0 ? allUrls[0] : null,
          };

          console.log('[handleSaveEvent] ========== 保存数据（单张图片） ==========');
          console.log('[handleSaveEvent] saveData:', saveData);

          await addEvent(saveData);
          console.log('[handleSaveEvent] 添加成功');
        } else {
          // 多张图片：每个图片创建一个独立事件，标题加序号
          console.log('[handleSaveEvent] 多张图片，将创建', allUrls.length, '个事件');
          for (let i = 0; i < allUrls.length; i++) {
            const saveData: any = {
              title: `${formData.title.trim()} (${i + 1})`,
              description: formData.description || null,
              event_date: formData.event_date,
              location: locationDisplay || null,
              province: formData.province || null,
              city: formData.city || null,
              district: formData.district || null,
              image_url: allUrls[i],
            };

            console.log(`[handleSaveEvent] ========== 保存数据（第 ${i + 1} 个事件） ==========`);
            console.log('[handleSaveEvent] saveData:', saveData);

            await addEvent(saveData);
            console.log(`[handleSaveEvent] 第 ${i + 1} 个事件添加成功`);
            setUploadMessage(`正在保存回忆 (${i + 1}/${allUrls.length})...`);
          }
        }
      }

      console.log('[handleSaveEvent] ========== 保存成功 ==========');
      setUploadStatus('success');
      setUploadMessage('保存成功！');

      setTimeout(() => {
        setIsModalOpen(false);
        clearImages();
        setEditingEvent(null);
        setTimeout(() => {
          setUploadStatus('idle');
          setUploadMessage('');
        }, 300);
      }, 800);
    } catch (err) {
      console.error('[handleSaveEvent] ========== 保存失败 ==========');
      console.error('[handleSaveEvent]', err);
      setUploadStatus('error');
      setUploadMessage('保存失败，请重试');
    } finally {
      isSavingRef.current = false;
    }
  }, [formData, imageFiles, existingImageUrls, editingEvent, addEvent, updateEvent, clearImages]);

  const handleCloseModal = useCallback(() => {
    if (isSavingRef.current) {
      return;
    }
    setIsModalOpen(false);
  }, []);

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
      <div className="pt-24 pb-12">
        <Section>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold mb-4">恋爱时间轴</h1>
                <p className="text-gray-600 dark:text-gray-400">记录我们的每一个重要时刻</p>
              </div>
              <button onClick={handleAddEvent} className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full hover:opacity-90 transition-opacity">
                <Plus className="w-5 h-5" />
                添加新回忆
              </button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-20">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">还没有记录任何回忆</p>
                <button onClick={handleAddEvent} className="mt-4 text-accent hover:underline">添加第一个</button>
              </div>
            ) : (
              <>
                <div className="sticky top-20 z-20 mb-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-4 shadow-sm backdrop-blur">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="relative sm:col-span-2 lg:col-span-2">
                      <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="搜索标题、故事或地点"
                        aria-label="搜索回忆"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <select
                      value={selectedYear}
                      onChange={(event) => {
                        setSelectedYear(event.target.value);
                        setSelectedMonth('all');
                      }}
                      aria-label="按年份筛选"
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="all">全部年份</option>
                      {availableYears.map(year => <option key={year} value={year}>{year} 年</option>)}
                    </select>
                    <select
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                      aria-label="按月份筛选"
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="all">全部月份</option>
                      {availableMonths.map(month => <option key={month} value={month}>{Number(month)} 月</option>)}
                    </select>
                    <select
                      value={selectedLocation}
                      onChange={(event) => setSelectedLocation(event.target.value)}
                      aria-label="按地点筛选"
                      className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="all">全部地点</option>
                      {availableLocations.map(location => <option key={location} value={location}>{location}</option>)}
                    </select>
                    <select
                      value={photoFilter}
                      onChange={(event) => setPhotoFilter(event.target.value as PhotoFilter)}
                      aria-label="按照片状态筛选"
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="all">全部回忆</option>
                      <option value="with">有照片</option>
                      <option value="without">无照片</option>
                    </select>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      找到 {filteredEvents.length} 条，共 {events.length} 条回忆
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <RotateCcw className="w-4 h-4" />
                        清空筛选
                      </button>
                      {groupedEvents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedGroups(
                            allGroupsExpanded
                              ? new Set()
                              : new Set(groupedEvents.map(group => group.key))
                          )}
                          className="rounded-lg px-3 py-1.5 text-accent hover:bg-accent/10"
                        >
                          {allGroupsExpanded ? '全部收起' : '全部展开'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {filteredEvents.length === 0 ? (
                  <div className="text-center py-20">
                    <Search className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400">没有找到符合条件的回忆</p>
                    <button onClick={clearFilters} className="mt-4 text-accent hover:underline">清空筛选条件</button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groupedEvents.map(group => {
                      const isExpanded = expandedGroups.has(group.key);

                      return (
                        <section key={group.key}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.key)}
                            aria-expanded={isExpanded}
                            className="flex w-full items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 text-left shadow-sm transition-colors hover:border-accent/50"
                          >
                            <span>
                              <span className="block text-lg font-semibold">
                                {group.year} 年 {Number(group.month)} 月
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {group.events.length} 条回忆
                              </span>
                            </span>
                            {isExpanded
                              ? <ChevronDown className="w-5 h-5 text-gray-400" />
                              : <ChevronRight className="w-5 h-5 text-gray-400" />}
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                key={`${group.key}-events`}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="relative pt-8 pb-2">
                                  <div className="absolute left-8 md:left-1/2 top-8 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700 -translate-x-1/2" />
                                  <div className="space-y-12">
                                    {group.events.map((event, index) => {
                                      const imageUrl = getEventImageUrl(event);

                                      return (
                                        <motion.div
                                          key={event.id}
                                          initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                                          whileInView={{ opacity: 1, x: 0 }}
                                          viewport={{ once: true }}
                                          transition={{ delay: Math.min(index * 0.06, 0.3) }}
                                          className={`relative flex items-start ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                                        >
                                          <div className={`flex-1 pl-16 ${index % 2 === 0 ? 'md:pl-0 md:pr-12' : 'md:pl-12 md:pr-0'}`}>
                                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden group hover:shadow-xl transition-shadow">
                                              {imageUrl && (
                                                <div className="relative">
                                                  <div className="aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700">
                                                    <img
                                                      src={imageUrl}
                                                      alt={event.title}
                                                      loading="lazy"
                                                      decoding="async"
                                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                      onError={() => console.error(`[Image Error] 事件 ${event.id} 图片加载失败`, { imageUrl })}
                                                    />
                                                  </div>
                                                </div>
                                              )}
                                              <div className="p-6">
                                                <div className="flex items-center gap-4 mb-3 text-sm text-gray-500 dark:text-gray-400">
                                                  <span className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" />
                                                    {new Date(event.event_date).toLocaleDateString('zh-CN')}
                                                  </span>
                                                  {event.location && (
                                                    <span className="flex items-center gap-1">
                                                      <MapPin className="w-4 h-4" />
                                                      {event.location}
                                                    </span>
                                                  )}
                                                </div>
                                                <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                                                {event.description && (
                                                  <p className="text-gray-600 dark:text-gray-400 mb-4">{event.description}</p>
                                                )}
                                                <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                                                  <button onClick={() => handleEditEvent(event)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                                    <Edit2 className="w-4 h-4" />
                                                    编辑
                                                  </button>
                                                  <button onClick={() => handleDeleteEvent(event.id)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4" />
                                                    删除
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 bg-accent rounded-full border-4 border-white dark:border-gray-900 z-10" />
                                          <div className="flex-1 hidden md:block" />
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </section>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </Section>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={handleCloseModal}
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
                  <h2 className="text-xl font-bold">{editingEvent ? '编辑回忆' : '添加新回忆'}</h2>
                  <button onClick={handleCloseModal} disabled={isSavingRef.current} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {uploadStatus !== 'idle' && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl ${
                    uploadStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                    uploadStatus === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  }`}>
                    {uploadStatus === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {uploadStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                    {uploadStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                    <span className="text-sm">{uploadMessage}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">标题</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent" placeholder="这个时刻叫什么" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">日期</label>
                  <input type="date" value={formData.event_date} onChange={(e) => setFormData({ ...formData, event_date: e.target.value })} className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">地点（可选）</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <select
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value, city: '', district: '' })}
                      className="px-3 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">省份</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value, district: '' })}
                      disabled={!formData.province}
                      className="px-3 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                    >
                      <option value="">城市</option>
                      {currentCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      disabled={!formData.city}
                      className="px-3 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                    >
                      <option value="">区县</option>
                      {currentDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">或直接输入具体地点</p>
                  <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent" placeholder="补充具体地点" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">照片（可选，支持多选）</label>

                  {/* 已有图片 */}
                  {existingImageUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {existingImageUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden">
                          <img src={url} alt={`已添加 ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeExistingUrl(idx)}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 新选择的图片 */}
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {imagePreviews.map((preview, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden">
                          <img src={preview} alt={`预览 ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div onClick={() => document.getElementById('timeline-image-input')?.click()} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-accent transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">点击选择照片，支持多选</p>
                    <input id="timeline-image-input" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">描述</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent resize-none" placeholder="讲讲这个时刻的故事..." />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button onClick={handleCloseModal} disabled={isSavingRef.current} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">取消</button>
                <button onClick={handleSaveEvent} disabled={isSavingRef.current || !formData.title.trim()} className="flex-1 py-4 bg-accent text-white rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSavingRef.current ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
