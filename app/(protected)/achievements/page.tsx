'use client';

import { motion } from 'framer-motion';
import { Trophy, CheckCircle2, Lock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Section from '@/components/Section';
import { useAchievements } from '@/lib/data';

export default function AchievementsPage() {
  const { loading, achievementsWithStatus } = useAchievements();
  const achievements = achievementsWithStatus;

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  const categories = [
    {
      title: '里程碑',
      ids: ['together_30', 'together_100', 'together_365', 'together_730']
    },
    {
      title: '回忆',
      ids: ['first_photo', 'ten_photos', 'fifty_photos', 'first_event', 'five_events']
    },
    {
      title: '互动',
      ids: ['first_letter', 'first_gift', 'first_ticket', 'first_wish', 'first_capsule']
    },
  ];

  const getCategoryAchievements = (categoryIds: string[]) => {
    return achievements.filter(a => categoryIds.includes(a.id));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-24 pb-12">
        <Section>
          <div className="max-w-6xl mx-auto">
            <div className="mb-12">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-bold mb-2">成就系统</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  记录你们的每一个重要时刻
                </p>

                {/* 进度概览 */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-3xl p-6 mb-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{unlockedCount} / {totalCount}</p>
                      <p className="text-gray-600 dark:text-gray-400">已解锁成就</p>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                    />
                  </div>
                </div>
              </motion.div>

              {loading ? (
                <div className="text-center py-20">
                  <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">加载中...</p>
                </div>
              ) : achievements.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">暂无成就</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {categories.map((category, idx) => {
                    const categoryAchievements = getCategoryAchievements(category.ids);
                    if (categoryAchievements.length === 0) return null;

                    return (
                      <div key={category.title}>
                        <h2 className="text-xl font-bold mb-6">{category.title}</h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryAchievements.map((achievement) => (
                            <motion.div
                              key={achievement.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border-2 transition-all ${
                                achievement.unlocked
                                  ? 'border-yellow-200 dark:border-yellow-900/50'
                                  : 'border-transparent opacity-75'
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                                  achievement.unlocked
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                    : 'bg-gray-100 dark:bg-gray-700'
                                }`}>
                                  {achievement.unlocked ? achievement.icon : '🔒'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold truncate">{achievement.title}</h3>
                                    {achievement.unlocked && (
                                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    {achievement.description}
                                  </p>

                                  {/* 进度条 */}
                                  {!achievement.unlocked && achievement.maxProgress > 1 && (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>{achievement.progress} / {achievement.maxProgress}</span>
                                      </div>
                                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-accent transition-all"
                                          style={{ width: `${Math.min(100, (achievement.progress / achievement.maxProgress) * 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* 解锁时间 */}
                                  {achievement.unlocked && achievement.unlockedAt && (
                                    <p className="text-xs text-gray-500">
                                      解锁于 {new Date(achievement.unlockedAt).toLocaleDateString('zh-CN')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
