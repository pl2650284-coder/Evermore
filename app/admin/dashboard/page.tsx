'use client';

import { useEffect, useState } from 'react';
import { Users, Heart, Image, Calendar, Gift, Mail, Ticket } from 'lucide-react';
import { motion } from 'framer-motion';

// 统计数据类型
interface Stats {
  totalUsers: number;
  totalCouples: number;
  totalPhotos: number;
  totalEvents: number;
  totalGifts: number;
  totalLetters: number;
  totalTickets: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalCouples: 0,
    totalPhotos: 0,
    totalEvents: 0,
    totalGifts: 0,
    totalLetters: 0,
    totalTickets: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟加载统计数据
    const loadStats = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      // 从 localStorage 获取模拟数据
      const totalUsers = Object.keys(localStorage).filter(k => k.startsWith('couple_user')).length;
      const totalCouples = Object.keys(localStorage).filter(k => k.startsWith('couple_')).length;

      setStats({
        totalUsers: Math.max(totalUsers, 0) + 12,
        totalCouples: Math.max(totalCouples, 0) + 8,
        totalPhotos: Math.floor(Math.random() * 200) + 50,
        totalEvents: Math.floor(Math.random() * 100) + 30,
        totalGifts: Math.floor(Math.random() * 50) + 10,
        totalLetters: Math.floor(Math.random() * 80) + 20,
        totalTickets: Math.floor(Math.random() * 40) + 5,
      });
      setLoading(false);
    };

    loadStats();
  }, []);

  const statCards = [
    { label: '总用户数', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-blue-600' },
    { label: '情侣空间', value: stats.totalCouples, icon: Heart, color: 'from-pink-500 to-red-500' },
    { label: '照片数量', value: stats.totalPhotos, icon: Image, color: 'from-purple-500 to-indigo-500' },
    { label: '时光轴事件', value: stats.totalEvents, icon: Calendar, color: 'from-green-500 to-emerald-500' },
    { label: '礼物记录', value: stats.totalGifts, icon: Gift, color: 'from-cyan-500 to-teal-500' },
    { label: '信件数量', value: stats.totalLetters, icon: Mail, color: 'from-rose-500 to-pink-600' },
    { label: '门票票据', value: stats.totalTickets, icon: Ticket, color: 'from-amber-500 to-yellow-600' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">仪表盘</h1>
        <p className="text-gray-500 dark:text-gray-400">欢迎回来，管理员。这是系统概览。</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : card.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* 最近活动 */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">系统状态</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">数据库连接</span>
              <span className="flex items-center gap-2 text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">存储服务</span>
              <span className="flex items-center gap-2 text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">API 服务</span>
              <span className="flex items-center gap-2 text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">最后备份</span>
              <span className="text-gray-900 dark:text-white">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快速操作</h2>
          <div className="space-y-3">
            <button className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <p className="font-medium text-gray-900 dark:text-white">查看所有用户</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">管理用户账号和权限</p>
            </button>
            <button className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <p className="font-medium text-gray-900 dark:text-white">系统设置</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">配置系统参数和选项</p>
            </button>
            <button className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <p className="font-medium text-gray-900 dark:text-white">数据备份</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">导出和备份系统数据</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
