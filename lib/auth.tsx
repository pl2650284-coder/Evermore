'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, AuthResponse } from './api';

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
  login: (email: string, password: string) => Promise<void>;
  adminLogin: (username: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 初始化时检查本地存储的登录态
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedIsAdmin = localStorage.getItem('isAdmin');

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsAdmin(savedIsAdmin === 'true');
      } catch (e) {
        console.error('解析用户信息失败:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
      }
    }
    setIsLoading(false);
  }, []);

  // 用户登录
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.login({ email, password });

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('isAdmin', 'false');

      setUser(result.user);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

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

  // 注册
  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.register({ email, password, name });

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('isAdmin', 'false');

      setUser(result.user);
      setIsAdmin(false);
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
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        login,
        adminLogin,
        register,
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
