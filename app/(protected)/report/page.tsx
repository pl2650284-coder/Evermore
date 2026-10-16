'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Camera,
  Clock3,
  ImagePlus,
  Map,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { AnnualReport, reportApi } from '@/lib/api';

const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />,
});

const CURRENT_YEAR = new Date().getFullYear();

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN');
}

export default function ReportPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [report, setReport] = useState<AnnualReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    reportApi.getAnnual(year)
      .then(({ report: nextReport }) => {
        if (active) setReport(nextReport);
      })
      .catch((requestError) => {
        if (active) {
          setReport(null);
          setError(requestError instanceof Error ? requestError.message : '获取年度报告失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey, year]);

  const availableYears = useMemo(() => {
    const years = new Set(report?.availableYears || []);
    years.add(year);
    years.add(CURRENT_YEAR);
    return Array.from(years).sort((a, b) => b - a);
  }, [report, year]);

  const monthlyOption = useMemo(() => ({
    animationDuration: 700,
    color: ['#f43f5e', '#f97316'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17, 24, 39, 0.94)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#9ca3af' },
    },
    grid: { left: 12, right: 12, top: 48, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: report?.monthly.map(item => item.label) || [],
      axisLine: { lineStyle: { color: '#d1d5db' } },
      axisTick: { show: false },
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: 'rgba(156, 163, 175, 0.18)' } },
    },
    series: [
      {
        name: '时光轴事件',
        type: 'bar',
        barMaxWidth: 18,
        data: report?.monthly.map(item => item.eventCount) || [],
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
      {
        name: '上传照片',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: report?.monthly.map(item => item.photoCount) || [],
        lineStyle: { width: 3 },
        areaStyle: { color: 'rgba(249, 115, 22, 0.12)' },
      },
    ],
  }), [report]);

  const locationOption = useMemo(() => {
    const locations = [...(report?.topLocations || [])].reverse();
    return {
      animationDuration: 700,
      color: ['#f97316'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(17, 24, 39, 0.94)',
        borderWidth: 0,
        textStyle: { color: '#fff' },
      },
      grid: { left: 8, right: 20, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#9ca3af' },
        splitLine: { lineStyle: { color: 'rgba(156, 163, 175, 0.18)' } },
      },
      yAxis: {
        type: 'category',
        data: locations.map(item => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#9ca3af', width: 120, overflow: 'truncate' },
      },
      series: [{
        name: '留下记录',
        type: 'bar',
        barMaxWidth: 22,
        data: locations.map(item => item.total),
        label: { show: true, position: 'right', color: '#9ca3af' },
        itemStyle: { borderRadius: [0, 8, 8, 0] },
      }],
    };
  }, [report]);

  const hasActivity = Boolean(report && (
    report.summary.eventCount > 0
    || report.summary.photoCount > 0
    || report.summary.placeCount > 0
  ));

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
                  <Sparkles className="h-4 w-4" />
                  OUR YEAR IN MEMORIES
                </div>
                <h1 className="page-title">年度报告</h1>
                <p className="page-description">把一起走过的地方和留下的回忆，整理成这一年的故事。</p>
              </div>
              <label className="flex items-center gap-3 self-start rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-900 sm:self-auto">
                <CalendarDays className="h-4 w-4 text-accent" />
                <span className="text-gray-500 dark:text-gray-400">报告年份</span>
                <select
                  value={year}
                  onChange={event => setYear(Number(event.target.value))}
                  className="bg-transparent font-semibold outline-none"
                  aria-label="选择报告年份"
                >
                  {availableYears.map(item => <option key={item} value={item}>{item} 年</option>)}
                </select>
              </label>
            </motion.header>

            {loading && (
              <div className="grid gap-5">
                <div className="h-64 animate-pulse rounded-[2rem] bg-gray-100 dark:bg-gray-900" />
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[0, 1, 2, 3].map(item => <div key={item} className="h-32 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-900" />)}
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/60 dark:bg-red-950/30">
                <p className="font-medium text-red-700 dark:text-red-300">年度报告加载失败</p>
                <p className="mt-2 text-sm text-red-600/80 dark:text-red-300/80">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey(value => value + 1)}
                  className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新加载
                </button>
              </div>
            )}

            {!loading && report && (
              <div className="space-y-6">
                <motion.section
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-[2rem] bg-gray-950 px-6 py-10 text-white sm:px-10 sm:py-12"
                >
                  <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
                  <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-rose-500/20 blur-3xl" />
                  <div className="relative max-w-3xl">
                    <p className="mb-5 text-sm font-medium uppercase tracking-[0.24em] text-orange-300">{report.year} · Evermore</p>
                    <p className="text-5xl font-semibold tracking-tight sm:text-7xl">{report.year}</p>
                    <h2 className="mt-5 text-2xl font-medium leading-relaxed sm:text-3xl">
                      {hasActivity
                        ? `你们在 ${report.summary.placeCount} 个地方留下足迹，收藏了 ${report.summary.photoCount} 张照片。`
                        : '这一年的故事还在等待你们写下第一笔。'}
                    </h2>
                    {report.busiestMonth && (
                      <p className="mt-5 text-sm text-gray-300">
                        {report.busiestMonth.label}是记录最多的月份，共留下 {report.busiestMonth.total} 条回忆。
                      </p>
                    )}
                  </div>
                </motion.section>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: '去过的地方', value: report.summary.placeCount, suffix: '处', icon: MapPin, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/30' },
                    { label: '上传的照片', value: report.summary.photoCount, suffix: '张', icon: Camera, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
                    { label: '时光轴事件', value: report.summary.eventCount, suffix: '件', icon: CalendarDays, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                    { label: '活跃月份', value: report.summary.activeMonths, suffix: '/ 12', icon: Clock3, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <motion.article
                        key={item.label}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6"
                      >
                        <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${item.bg}`}>
                          <Icon className={`h-5 w-5 ${item.color}`} />
                        </div>
                        <p className="text-3xl font-semibold tabular-nums sm:text-4xl">
                          {formatNumber(item.value)}
                          <span className="ml-1.5 text-sm font-normal text-gray-400">{item.suffix}</span>
                        </p>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                      </motion.article>
                    );
                  })}
                </div>

                {hasActivity ? (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
                    <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                      <div className="mb-2">
                        <h2 className="section-title">每月回忆趋势</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">时光轴按事件日期统计，照片按上传时间统计。</p>
                      </div>
                      <ReactECharts option={monthlyOption} style={{ height: 340 }} notMerge lazyUpdate />
                    </section>

                    <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                      <div className="mb-2">
                        <h2 className="section-title">常去的地方</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">按地点关联的照片和事件数量排序。</p>
                      </div>
                      {report.topLocations.length > 0 ? (
                        <ReactECharts option={locationOption} style={{ height: 340 }} notMerge lazyUpdate />
                      ) : (
                        <div className="flex h-[340px] flex-col items-center justify-center text-center">
                          <Map className="mb-4 h-10 w-10 text-gray-300 dark:text-gray-700" />
                          <p className="font-medium">还没有可统计的地点</p>
                          <p className="mt-2 max-w-xs text-sm text-gray-500 dark:text-gray-400">为照片或时光轴事件补充省、市、区信息后，这里会生成地点排行。</p>
                        </div>
                      )}
                    </section>
                  </div>
                ) : (
                  <section className="rounded-3xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-700">
                    <ImagePlus className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-700" />
                    <h2 className="section-title">开始记录 {report.year} 年的故事</h2>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">添加一段时光轴事件，或者上传一张照片，年度报告就会自动更新。</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <Link href="/timeline" className="rounded-full bg-gray-950 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-gray-950">记录事件</Link>
                      <Link href="/photos" className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium dark:border-gray-700">上传照片</Link>
                    </div>
                  </section>
                )}

                <section className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
                    <p className="text-sm text-gray-500 dark:text-gray-400">记录天数</p>
                    <p className="mt-2 text-2xl font-semibold">{report.summary.activeDays} 天</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
                    <p className="text-sm text-gray-500 dark:text-gray-400">覆盖城市</p>
                    <p className="mt-2 text-2xl font-semibold">{report.summary.cityCount} 座</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-900">
                    <p className="text-sm text-gray-500 dark:text-gray-400">覆盖省份</p>
                    <p className="mt-2 text-2xl font-semibold">{report.summary.provinceCount} 个</p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
