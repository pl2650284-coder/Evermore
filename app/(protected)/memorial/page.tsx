'use client';

import { motion } from 'framer-motion';
import { Archive, Mail, Gift, Ticket, Clock, Sparkles, Calendar, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function MemorialPage() {
  const modules = [
    { href: '/memorial/letters', label: '信件馆', description: '收藏每一封情书和手写信', icon: Mail, color: 'from-pink-500 to-rose-500' },
    { href: '/memorial/gifts', label: '礼物馆', description: '记录每份礼物背后的故事', icon: Gift, color: 'from-violet-500 to-purple-500' },
    { href: '/memorial/tickets', label: '门票馆', description: '保存每一张票据', icon: Ticket, color: 'from-amber-500 to-orange-500' },
    { href: '/capsules', label: '时光胶囊', description: '给未来的礼物', icon: Clock, color: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="page-shell">
        <main className="page-container">
          <div>
            <div className="page-header">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="page-title"
                >
                  纪念馆
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="page-description"
                >
                  收藏我们共同的回忆，每一件物品都有它的故事
                </motion.p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-accent dark:bg-orange-950/30">
                <Archive className="h-7 w-7" />
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {modules.map((module, index) => (
                <motion.div
                  key={module.href}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Link href={module.href}>
                    <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-lg hover:shadow-2xl transition-all duration-300">
                      <div className={`h-2 bg-gradient-to-r ${module.color}`} />
                      <div className="p-8">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform duration-300`}>
                          <module.icon className="w-8 h-8" />
                        </div>
                        <h3 className="section-title mb-2">{module.label}</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          {module.description}
                        </p>
                        <div className="flex items-center text-gray-500 dark:text-gray-400">
                          进入
                          <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
