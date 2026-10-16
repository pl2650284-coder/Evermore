'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  adminLogin: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const establishLocalSession = async () => {
    const result = await authApi.getLocalSession();
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    localStorage.setItem('isAdmin', 'false');
    setUser(result.user);
    setIsAdmin(false);
  };

  // 管理员会话保持原有行为；普通使用始终静默初始化本机会话。
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedIsAdmin = localStorage.getItem('isAdmin');

    if (token && savedUser && savedIsAdmin === 'true') {
      try {
        setUser(JSON.parse(savedUser));
        setIsAdmin(true);
        setIsLoading(false);
        return;
      } catch (e) {
        console.error('解析管理员信息失败:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
      }
    }

    establishLocalSession()
      .catch((error) => console.error('初始化本机会话失败:', error))
      .finally(() => setIsLoading(false));
  }, []);

  // 管理员登录
  const adminLogin = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      // 硬编码管理员账号作为 fallback
      if (username === 'Ghjxxj' && password === '123456') {
        const adminUser = {
          id: 'admin-001',
          email: 'admin@lovemuseum.com',
          name: '管理员',
        };
        const token = 'admin-token-' + Date.now();

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(adminUser));
        localStorage.setItem('isAdmin', 'true');

        setUser(adminUser);
        setIsAdmin(true);
      } else {
        throw new Error('管理员账号或密码错误');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 登出
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    setUser(null);
    setIsAdmin(false);
    establishLocalSession().catch((error) => console.error('恢复本机会话失败:', error));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        adminLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
