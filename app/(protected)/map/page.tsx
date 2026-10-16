'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Heart,
  Image as ImageIcon,
  MapPin,
  Route,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { PROVINCES, getCitiesByProvince, getDistrictsByCity, usePhotos, useTimelineEvents } from '@/lib/data';

type RecordKind = 'event' | 'photo';
type RecordFilter = 'all' | RecordKind;

interface LocationSource {
  province?: string | null;
  city?: string | null;
  district?: string | null;
  location?: string | null;
}

interface FootprintRecord {
  id: string;
  kind: RecordKind;
  title: string;
  date?: string;
  province: string;
  city?: string;
  district?: string;
  location?: string;
  imageUrl?: string;
}

interface ProvinceStat {
  province: string;
  total: number;
  eventCount: number;
  photoCount: number;
  cities: Set<string>;
  districts: Set<string>;
}

interface ProvinceTile {
  name: string;
  shortName: string;
  row: number;
  column: number;
  columnSpan?: number;
}

const PROVINCE_TILES: ProvinceTile[] = [
  { name: '黑龙江省', shortName: '黑龙江', row: 1, column: 11, columnSpan: 2 },
  { name: '新疆维吾尔自治区', shortName: '新疆', row: 2, column: 1, columnSpan: 2 },
  { name: '内蒙古自治区', shortName: '内蒙古', row: 2, column: 5, columnSpan: 3 },
  { name: '吉林省', shortName: '吉林', row: 2, column: 10 },
  { name: '辽宁省', shortName: '辽宁', row: 2, column: 11 },
  { name: '青海省', shortName: '青海', row: 3, column: 3 },
  { name: '甘肃省', shortName: '甘肃', row: 3, column: 4 },
  { name: '宁夏回族自治区', shortName: '宁夏', row: 3, column: 5 },
  { name: '陕西省', shortName: '陕西', row: 3, column: 6 },
  { name: '山西省', shortName: '山西', row: 3, column: 7 },
  { name: '河北省', shortName: '河北', row: 3, column: 8 },
  { name: '北京市', shortName: '北京', row: 3, column: 9 },
  { name: '天津市', shortName: '天津', row: 3, column: 10 },
  { name: '山东省', shortName: '山东', row: 3, column: 11 },
  { name: '西藏自治区', shortName: '西藏', row: 4, column: 1, columnSpan: 2 },
  { name: '四川省', shortName: '四川', row: 4, column: 4, columnSpan: 2 },
  { name: '重庆市', shortName: '重庆', row: 4, column: 6 },
  { name: '河南省', shortName: '河南', row: 4, column: 7 },
  { name: '安徽省', shortName: '安徽', row: 4, column: 8 },
  { name: '江苏省', shortName: '江苏', row: 4, column: 9 },
  { name: '上海市', shortName: '上海', row: 4, column: 10 },
  { name: '云南省', shortName: '云南', row: 5, column: 3, columnSpan: 2 },
  { name: '贵州省', shortName: '贵州', row: 5, column: 5 },
  { name: '湖南省', shortName: '湖南', row: 5, column: 6 },
  { name: '湖北省', shortName: '湖北', row: 5, column: 7 },
  { name: '江西省', shortName: '江西', row: 5, column: 8 },
  { name: '浙江省', shortName: '浙江', row: 5, column: 9 },
  { name: '广西壮族自治区', shortName: '广西', row: 6, column: 4 },
  { name: '广东省', shortName: '广东', row: 6, column: 5, columnSpan: 2 },
  { name: '福建省', shortName: '福建', row: 6, column: 8 },
  { name: '台湾省', shortName: '台湾', row: 6, column: 10 },
  { name: '海南省', shortName: '海南', row: 7, column: 5 },
  { name: '香港特别行政区', shortName: '香港', row: 7, column: 6 },
  { name: '澳门特别行政区', shortName: '澳门', row: 7, column: 7 },
];

const DIRECT_ADMINISTRATIONS = new Set([
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '香港特别行政区',
  '澳门特别行政区',
]);

function resolveLocation(source: LocationSource) {
  const text = source.location?.trim() || '';
  let province = source.province?.trim() || '';
  let city = source.city?.trim() || '';
  let district = source.district?.trim() || '';

  if (!province) {
    province = PROVINCES.find(candidate => text.includes(candidate)) || '';
  }

  if (!city && province) {
    city = getCitiesByProvince(province).find(candidate => text.includes(candidate)) || '';
  }

  if (!city || !province) {
    for (const candidateProvince of PROVINCES) {
      const candidateCity = getCitiesByProvince(candidateProvince)
        .find(item => text.includes(item) || item === city);
      if (candidateCity) {
        province ||= candidateProvince;
        city ||= candidateCity;
        break;
      }
    }
  }

  if (!city && province && DIRECT_ADMINISTRATIONS.has(province)) {
    city = province;
  }

  if (!district && city) {
    district = getDistrictsByCity(city).find(candidate => text.includes(candidate)) || '';
  }

  return { province, city, district, location: text };
}

function formatDate(date?: string) {
  if (!date) return '日期未记录';
  const value = date.slice(0, 10);
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '日期未记录';
  return parsed.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getTileColor(total: number, maximum: number) {
  if (total === 0) {
    return 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500';
  }

  const ratio = total / Math.max(maximum, 1);
  if (ratio > 0.66) return 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600';
  if (ratio > 0.33) return 'border-orange-400 bg-orange-400 text-white hover:bg-orange-500';
  return 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600';
}

export default function MapPage() {
  const { events, loading: eventsLoading, error: eventsError } = useTimelineEvents();
  const { photos, loading: photosLoading } = usePhotos();
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all');

  const allRecords = useMemo(() => {
    const eventRecords = events.map<FootprintRecord | null>(event => {
      const place = resolveLocation(event);
      if (!place.province) return null;
      return {
        id: `event-${event.id}`,
        kind: 'event',
        title: event.title,
        date: event.event_date,
        province: place.province,
        city: place.city,
        district: place.district,
        location: place.location,
        imageUrl: event.image_url,
      };
    });

    const photoRecords = photos.map<FootprintRecord | null>(photo => {
      const place = resolveLocation(photo);
      if (!place.province) return null;
      return {
        id: `photo-${photo.id}`,
        kind: 'photo',
        title: photo.title || '一张照片',
        date: photo.taken_at || photo.created_at,
        province: place.province,
        city: place.city,
        district: place.district,
        location: place.location,
        imageUrl: photo.image_url,
      };
    });

    return [...eventRecords, ...photoRecords]
      .filter((record): record is FootprintRecord => record !== null)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [events, photos]);

  const provinceStats = useMemo(() => {
    const stats = new Map<string, ProvinceStat>();

    allRecords.forEach(record => {
      const current = stats.get(record.province) || {
        province: record.province,
        total: 0,
        eventCount: 0,
        photoCount: 0,
        cities: new Set<string>(),
        districts: new Set<string>(),
      };

      current.total += 1;
      current.eventCount += record.kind === 'event' ? 1 : 0;
      current.photoCount += record.kind === 'photo' ? 1 : 0;
      if (record.city) current.cities.add(record.city);
      if (record.district) current.districts.add(record.district);
      stats.set(record.province, current);
    });

    return stats;
  }, [allRecords]);

  const maximumProvinceRecords = useMemo(
    () => Math.max(0, ...Array.from(provinceStats.values(), stat => stat.total)),
    [provinceStats]
  );

  const displayedRecords = useMemo(() => {
    return allRecords.filter(record => {
      const matchesProvince = !selectedProvince || record.province === selectedProvince;
      const matchesKind = recordFilter === 'all' || record.kind === recordFilter;
      return matchesProvince && matchesKind;
    });
  }, [allRecords, recordFilter, selectedProvince]);

  const totalCities = useMemo(
    () => new Set(allRecords.map(record => record.city).filter(Boolean)).size,
    [allRecords]
  );
  const totalDistricts = useMemo(
    () => new Set(allRecords.map(record => record.district).filter(Boolean)).size,
    [allRecords]
  );
  const unmappedCount = events.length + photos.length - allRecords.length;
  const selectedStat = selectedProvince ? provinceStats.get(selectedProvince) : undefined;
  const loading = eventsLoading || photosLoading;

  const toggleProvince = (province: string) => {
    setSelectedProvince(current => current === province ? null : province);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-4 border-gray-200 border-t-accent" />
            <p className="text-sm text-gray-500 dark:text-gray-400">正在整理你们的足迹...</p>
          </div>
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
            <motion.header
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="page-header"
            >
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-accent">
                  <Heart className="h-4 w-4" fill="currentColor" />
                  OUR JOURNEY
                </div>
                <h1 className="page-title">恋爱地图</h1>
                <p className="page-description">一起走过的地方，正在变成我们的版图</p>
              </div>
              {selectedProvince && (
                <button
                  type="button"
                  onClick={() => setSelectedProvince(null)}
                  className="button-secondary self-start"
                >
                  查看全部足迹
                </button>
              )}
            </motion.header>

            <div className="mb-8 grid grid-cols-2 border-y border-gray-200 dark:border-gray-800 md:grid-cols-4">
              {[
                { label: '去过省份', value: provinceStats.size, suffix: '个' },
                { label: '留下城市', value: totalCities, suffix: '座' },
                { label: '记录足迹', value: allRecords.length, suffix: '条' },
                { label: '细化区县', value: totalDistricts, suffix: '处' },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={`px-4 py-5 ${index % 2 === 0 ? 'border-r' : ''} border-gray-200 dark:border-gray-800 md:border-r md:last:border-r-0`}
                >
                  <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
                    {item.value}<span className="ml-1 text-sm font-normal text-gray-400">{item.suffix}</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                </div>
              ))}
            </div>

            {eventsError && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                时光轴数据加载失败：{eventsError}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
                aria-label="省份足迹图"
              >
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
                  <div>
                    <h2 className="section-title">{selectedProvince || '中国足迹'}</h2>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {selectedProvince
                        ? `${selectedStat?.total || 0} 条记录 · ${selectedStat?.cities.size || 0} 座城市`
                        : `${provinceStats.size} 个省级地区留下了回忆`}
                    </p>
                  </div>
                  <MapPin className="h-5 w-5 text-accent" />
                </div>

                <div className="p-3 sm:p-6">
                  <div className="grid h-[280px] grid-cols-12 grid-rows-7 gap-1.5 sm:h-[380px] sm:gap-2 lg:h-[430px]">
                    {PROVINCE_TILES.map(tile => {
                      const count = provinceStats.get(tile.name)?.total || 0;
                      const selected = selectedProvince === tile.name;

                      return (
                        <button
                          key={tile.name}
                          type="button"
                          title={`${tile.name}：${count} 条足迹`}
                          aria-label={`${tile.name}，${count} 条足迹`}
                          aria-pressed={selected}
                          onClick={() => toggleProvince(tile.name)}
                          style={{
                            gridColumnStart: tile.column,
                            gridColumnEnd: `span ${tile.columnSpan || 1}`,
                            gridRowStart: tile.row,
                          }}
                          className={`relative flex min-w-0 items-center justify-center rounded-md border px-0.5 text-[10px] font-medium transition-all sm:text-xs ${getTileColor(count, maximumProvinceRecords)} ${selected ? 'z-10 ring-2 ring-gray-950 ring-offset-2 dark:ring-white dark:ring-offset-gray-950' : ''}`}
                        >
                          <span className="truncate">{tile.shortName}</span>
                          {count > 0 && (
                            <span className="absolute -right-1 -top-1 hidden h-5 min-w-5 items-center justify-center rounded-full bg-gray-950 px-1 text-[9px] font-semibold text-white shadow sm:flex dark:bg-white dark:text-gray-950">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-4 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />初见</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-orange-400" />常去</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-500" />故事最多</span>
                  </div>
                  {unmappedCount > 0 && <span>{unmappedCount} 条记录尚未填写省份</span>}
                </div>
              </motion.section>

              <motion.aside
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="flex min-h-[500px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="border-b border-gray-200 p-5 dark:border-gray-800">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="section-title">{selectedProvince || '全部旅途'}</h2>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{displayedRecords.length} 条可查看记录</p>
                    </div>
                    <Route className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="grid grid-cols-3 rounded-lg bg-gray-100 p-1 dark:bg-gray-800" role="group" aria-label="记录类型筛选">
                    {([
                      ['all', '全部'],
                      ['event', '回忆'],
                      ['photo', '照片'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRecordFilter(value)}
                        className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${recordFilter === value ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[520px] flex-1 overflow-y-auto">
                  {displayedRecords.length > 0 ? (
                    displayedRecords.map(record => {
                      const locationDetail = [
                        record.city && record.city !== record.province ? record.city : '',
                        record.district,
                      ].filter(Boolean).join(' · ') || record.location || record.province;

                      return (
                        <Link
                          key={record.id}
                          href={record.kind === 'event' ? '/timeline' : '/photos'}
                          className="group flex gap-3 border-b border-gray-100 p-4 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                        >
                          <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                            {record.imageUrl ? (
                              <img src={record.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : record.kind === 'event' ? (
                              <CalendarDays className="h-5 w-5 text-orange-500" />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-emerald-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className={`text-[11px] font-medium ${record.kind === 'event' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {record.kind === 'event' ? '时光轴' : '照片馆'}
                              </span>
                              <span className="text-[11px] text-gray-400">{formatDate(record.date)}</span>
                            </div>
                            <p className="truncate text-sm font-medium">{record.title}</p>
                            <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                              <MapPin className="h-3 w-3 flex-none" />
                              {record.province} · {locationDetail}
                            </p>
                          </div>
                          <ChevronRight className="mt-5 h-4 w-4 flex-none text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
                        </Link>
                      );
                    })
                  ) : (
                    <div className="flex h-full min-h-[310px] flex-col items-center justify-center px-8 text-center">
                      <Camera className="mb-4 h-10 w-10 text-gray-300 dark:text-gray-600" />
                      <p className="font-medium">这里还没有留下足迹</p>
                      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">在时光轴记录地点，或为照片补充省市信息后，足迹会自动出现。</p>
                      <div className="mt-5 flex gap-3">
                        <Link href="/timeline" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">记录回忆</Link>
                        <Link href="/photos" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500">上传照片</Link>
                      </div>
                    </div>
                  )}
                </div>
              </motion.aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
