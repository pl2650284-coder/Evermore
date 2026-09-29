'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useCouple } from '@/lib/couple';
import { useRouter, usePathname } from 'next/navigation';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const publicPaths = ['/login', '/register', '/admin/login'];
const adminPaths = ['/admin/dashboard', '/admin/users', '/admin/couples'];
const onboardingPath = '/onboarding';

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { couple, loading: coupleLoading } = useCouple();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) return;

    // 管理员路由逻辑
    if (pathname.startsWith('/admin')) {
      if (!isAdmin && pathname !== '/admin/login') {
        router.push('/admin/login');
        return;
      }
      if (isAdmin && pathname === '/admin/login') {
        router.push('/admin/dashboard');
        return;
      }
      return;
    }

    // 普通用户路由逻辑
    if (coupleLoading) return;

    // 如果未登录，且不在公开页面，跳转到登录页
    if (!user && !publicPaths.includes(pathname)) {
      router.push('/login');
      return;
    }

    // 如果已登录，但在登录/注册页，跳转到首页或onboarding
    if (user && publicPaths.includes(pathname) && !pathname.startsWith('/admin')) {
      if (!couple) {
        router.push(onboardingPath);
      } else {
        router.push('/');
      }
      return;
    }

    // 如果已登录但没有情侣空间，且不在onboarding页，跳转到onboarding
    if (user && !couple && pathname !== onboardingPath) {
      router.push(onboardingPath);
      return;
    }

    // 如果已登录且有情侣空间，但在onboarding页，跳转到首页
    if (user && couple && pathname === onboardingPath) {
      router.push('/');
      return;
    }
  }, [user, isAdmin, couple, authLoading, coupleLoading, pathname, router]);

  // 加载中显示loading状态
  if (authLoading || (pathname.startsWith('/admin') ? false : coupleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 渲染子组件
  return <>{children}</>;
}
