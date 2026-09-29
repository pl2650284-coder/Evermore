'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Calendar, MapPin, Camera } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import SoundButton from '@/components/SoundButton';
import Section from '@/components/Section';
import { useCouple } from '@/lib/couple';
import { calculateDaysTogether } from '@/lib/utils';

export default function Home() {
  const { couple, loading } = useCouple();

  // 默认值
  const partner1Name = couple?.partner1_name || '小明';
  const partner2Name = couple?.partner2_name || '小红';
  const startDate = couple?.start_date || new Date().toISOString().split('T')[0];
  const heroImageUrl = couple?.hero_image_url || null;

  const [daysTogether, setDaysTogether] = useState(0);

  useEffect(() => {
    setDaysTogether(calculateDaysTogether(startDate));
  }, [startDate]);

  // 临时统计数据
  const STATS = [
    { icon: Calendar, label: '一起走过', value: daysTogether.toString() },
    { icon: MapPin, label: '去过城市', value: '0' },
    { icon: Camera, label: '照片回忆', value: '0' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ParticleBackground />

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="relative mb-8">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-4 left-1/2 -translate-x-1/2"
            >
              <Heart className="w-8 h-8 text-accent" fill="currentColor" />
            </motion.div>

            <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto rounded-full overflow-hidden shadow-2xl bg-gray-100 dark:bg-gray-800">
              {heroImageUrl ? (
                <img src={heroImageUrl} alt="Couple" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Heart className="w-20 h-20 text-gray-300 dark:text-gray-600" fill="currentColor" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl sm:text-6xl font-bold mb-4 tracking-tight"
          >
            {partner1Name} & {partner2Name}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="space-y-2"
          >
            <div className="text-6xl sm:text-8xl font-light tracking-tighter text-accent">
              {daysTogether}
            </div>
            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400">
              我们相爱的天数
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              从 {new Date(startDate).toLocaleDateString('zh-CN')} 开始
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <Section>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <stat.icon className="w-10 h-10 mx-auto mb-4 text-accent" />
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <div className="text-gray-500 dark:text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="flex items-center justify-center gap-2">
          Made with <Heart className="w-4 h-4 text-accent" fill="currentColor" />
        </p>
        <p className="mt-2 text-sm">© {new Date().getFullYear()} Love Museum. Forever together.</p>
      </footer>

      <SoundButton />
    </div>
  );
}
