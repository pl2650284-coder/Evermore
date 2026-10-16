'use client';

import { useAuth } from '@/lib/auth';
import { useCouple } from '@/lib/couple';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading: authLoading } = useAuth();
  const { loading: coupleLoading } = useCouple();

  // 加载中显示loading状态
  if (authLoading || coupleLoading) {
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
