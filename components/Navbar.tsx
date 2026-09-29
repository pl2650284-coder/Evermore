'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
  Heart,
  LogOut,
  User,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useAuth } from '@/lib/auth';
import { useCouple } from '@/lib/couple';
import { cn } from '@/lib/utils';

// 一级导航
const mainNavItems = [
  { href: '/', label: '首页' },
  { href: '/timeline', label: '时光轴' },
];

// 回忆馆下拉菜单
const memorialDropdownItems = [
  { href: '/map', label: '地图足迹' },
  { href: '/photos', label: '照片博物馆' },
  { href: '/memorial/letters', label: '信件馆' },
  { href: '/memorial/gifts', label: '礼物馆' },
  { href: '/memorial/tickets', label: '门票馆' },
];

// 数据中心下拉菜单
const dataDropdownItems = [
  { href: '/achievements', label: '成就系统' },
  { href: '/wishlist', label: '愿望清单' },
  { href: '/capsules', label: '时光胶囊' },
];

// 年度报告
const reportNavItem = { href: '/report', label: '年度报告' };

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, isAdmin, logout } = useAuth();
  const { couple } = useCouple();
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  // 默认情侣名称
  const partner1Name = couple?.partner1_name || '小明';
  const partner2Name = couple?.partner2_name || '小红';

  // 监听滚动
  useEffect(() => {
    if (isAdminPage) return;

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAdminPage]);

  // 管理员页面不显示导航栏
  if (isAdminPage) {
    return null;
  }

  // 检查是否是当前页面或子页面
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // 检查下拉菜单是否有激活项
  const isDropdownActive = (items: { href: string }[]) => {
    return items.some(item => isActive(item.href));
  };

  // 切换下拉菜单
  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/70 backdrop-blur-xl shadow-sm'
          : 'bg-background/0 backdrop-blur-none'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Logo 区域 */}
          <Link href="/" className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-accent" fill="currentColor" />
              <span className="font-semibold text-lg tracking-tight">
                {partner1Name} &amp; {partner2Name}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">
              Love Museum
            </span>
          </Link>

          {/* 桌面导航 */}
          <div className="hidden md:flex items-center gap-1">
            {/* 一级导航 */}
            {mainNavItems.map((item) => (
              <NavLink key={item.href} href={item.href} active={isActive(item.href)}>
                {item.label}
              </NavLink>
            ))}

            {/* 回忆馆下拉 */}
            <NavDropdown
              label="回忆馆"
              items={memorialDropdownItems}
              isOpen={openDropdown === 'memorial'}
              onToggle={() => toggleDropdown('memorial')}
              hasActive={isDropdownActive(memorialDropdownItems)}
              pathname={pathname}
            />

            {/* 数据中心下拉 */}
            <NavDropdown
              label="数据中心"
              items={dataDropdownItems}
              isOpen={openDropdown === 'data'}
              onToggle={() => toggleDropdown('data')}
              hasActive={isDropdownActive(dataDropdownItems)}
              pathname={pathname}
            />

            {/* 年度报告 */}
            <NavLink key={reportNavItem.href} href={reportNavItem.href} active={isActive(reportNavItem.href)}>
              {reportNavItem.label}
            </NavLink>
          </div>

          {/* 右侧功能按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="切换主题"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>

            {/* 用户菜单 */}
            {!user && (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-accent transition-colors"
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-full hover:bg-accent/90 transition-colors"
                >
                  注册
                </Link>
              </div>
            )}

            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-accent to-orange-400 rounded-full flex items-center justify-center text-white">
                    <User className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 top-full pt-2"
                    >
                      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 min-w-[200px]">
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                          <p className="text-sm font-medium">{user.email}</p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          退出登录
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* 移动端菜单 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-background border-t border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-6">
              {/* 一级导航 */}
              <div className="space-y-2">
                {mainNavItems.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    href={item.href}
                    active={isActive(item.href)}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </MobileNavLink>
                ))}
              </div>

              {/* 回忆馆 */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  回忆馆
                </div>
                {memorialDropdownItems.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    href={item.href}
                    active={isActive(item.href)}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </MobileNavLink>
                ))}
              </div>

              {/* 数据中心 */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  数据中心
                </div>
                {dataDropdownItems.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    href={item.href}
                    active={isActive(item.href)}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </MobileNavLink>
                ))}
              </div>

              {/* 年度报告 */}
              <div className="space-y-2">
                <MobileNavLink
                  href={reportNavItem.href}
                  active={isActive(reportNavItem.href)}
                  onClick={() => setIsOpen(false)}
                >
                  {reportNavItem.label}
                </MobileNavLink>
              </div>

              {/* 用户操作 */}
              {!user && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <Link
                    href="/login"
                    className="block w-full px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="block w-full px-4 py-3 text-center font-medium bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    注册
                  </Link>
                </div>
              )}

              {/* 用户登出 */}
              {user && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// 导航链接组件 - 带胶囊高亮效果
function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full',
        active
          ? 'text-black dark:text-white bg-gray-100 dark:bg-gray-800'
          : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
      )}
    >
      {children}
      {active && (
        <motion.div
          layoutId="activeNav"
          className="absolute inset-0 rounded-full border border-gray-200 dark:border-gray-700"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </Link>
  );
}

// 下拉菜单组件
function NavDropdown({
  label,
  items,
  isOpen,
  onToggle,
  hasActive,
  pathname,
}: {
  label: string;
  items: { href: string; label: string }[];
  isOpen: boolean;
  onToggle: () => void;
  hasActive: boolean;
  pathname: string;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={() => onToggle()}
      onMouseLeave={() => onToggle()}
    >
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1 px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full',
          hasActive
            ? 'text-black dark:text-white bg-gray-100 dark:bg-gray-800'
            : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
        )}
      >
        {label}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-0 top-full pt-2"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 min-w-[180px]">
              {items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block px-4 py-2.5 text-sm rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-medium'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-black dark:hover:text-white'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 移动端导航链接
function MobileNavLink({
  href,
  children,
  active,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'block px-4 py-3 text-base rounded-xl transition-all duration-200',
        active
          ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-medium'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      )}
    >
      {children}
    </Link>
  );
}
