'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './auth';
import { coupleApi, Couple as ApiCouple } from './api';

export interface Couple {
  id: string;
  user1_id: string;
  user2_id?: string;
  start_date: string;
  partner1_name: string;
  partner2_name: string;
  hero_image_url?: string;
  created_at: string;
}

interface CoupleContextType {
  couple: Couple | null;
  loading: boolean;
  createCouple: (data: {
    partner1Name: string;
    partner2Name: string;
    startDate: string;
    heroImageUrl?: string;
  }) => Promise<{ error: any | null; success: boolean }>;
  refreshCouple: () => Promise<void>;
}

const CoupleContext = createContext<CoupleContextType | undefined>(undefined);

export function CoupleProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);

  // 从后端获取情侣空间
  const fetchCouple = async (userId: string) => {
    try {
      const result = await coupleApi.getMyCouple();
      setCouple(result.couple || null);
    } catch (error) {
      console.error('Error fetching couple:', error);
      setCouple(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshCouple = async () => {
    if (!user) return;
    setLoading(true);
    await fetchCouple(user.id);
  };

  useEffect(() => {
    if (authLoading) return;

    // 管理员不需要情侣空间
    if (isAdmin) {
      setCouple(null);
      setLoading(false);
      return;
    }

    if (!user) {
      setCouple(null);
      setLoading(false);
      return;
    }

    fetchCouple(user.id);
  }, [user, authLoading, isAdmin]);

  const createCouple = async (data: {
    partner1Name: string;
    partner2Name: string;
    startDate: string;
    heroImageUrl?: string;
  }) => {
    if (!user) return { error: new Error('No user'), success: false };

    try {
      const result = await coupleApi.createCouple({
        partner1_name: data.partner1Name,
        partner2_name: data.partner2Name,
        start_date: data.startDate,
        hero_image_url: data.heroImageUrl,
      });

      setCouple(result.couple);
      return { error: null, success: true };
    } catch (error) {
      console.error('createCouple error:', error);
      return { error, success: false };
    }
  };

  return (
    <CoupleContext.Provider value={{ couple, loading, createCouple, refreshCouple }}>
      {children}
    </CoupleContext.Provider>
  );
}

export function useCouple() {
  const context = useContext(CoupleContext);
  if (context === undefined) {
    throw new Error('useCouple must be used within a CoupleProvider');
  }
  return context;
}
