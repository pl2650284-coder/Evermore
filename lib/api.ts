// 工具类型：让可选字段支持 null
type AllowNull<T> = {
  [K in keyof T]: T[K] extends undefined ? T[K] | null : T[K];
};

// API 基础配置
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const REQUEST_TIMEOUT_MS = 15_000;

// 请求拦截器类型
interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

// 基础请求函数
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
}

// HTTP 方法封装
export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, data: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  // 文件上传
  upload: async (endpoint: string, file: File, folder: string): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error('上传失败');
    }

    return response.json();
  },
};

// ==================== 认证相关 API ====================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
  };
}

export const authApi = {
  getLocalSession: () => api.post<AuthResponse>('/auth/local', {}),
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
  logout: () => api.post('/auth/logout', {}),
  getCurrentUser: () => api.get<{ user: AuthResponse['user'] }>('/auth/me'),
};

// ==================== 管理员相关 API ====================

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export const adminApi = {
  login: (data: AdminLoginRequest) => api.post<AuthResponse>('/admin/login', data),
  getStats: () => api.get('/admin/stats'),
  getUsers: () => api.get('/admin/users'),
  getCouples: () => api.get('/admin/couples'),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  deleteCouple: (id: string) => api.delete(`/admin/couples/${id}`),
};

// ==================== 情侣空间 API ====================

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

export interface CreateCoupleRequest {
  start_date: string;
  partner1_name: string;
  partner2_name: string;
  hero_image_url?: string;
}

export const coupleApi = {
  getMyCouple: () => api.get<{ couple: Couple | null }>('/couple/my'),
  createCouple: (data: CreateCoupleRequest) => api.post<{ couple: Couple }>('/couple', data),
  updateCouple: (id: string, data: Partial<CreateCoupleRequest>) =>
    api.put<{ couple: Couple }>(`/couple/${id}`, data),
};

// ==================== 时间轴 API ====================

export interface TimelineEvent {
  id: string;
  couple_id: string;
  title: string;
  description?: string;
  event_date: string;
  image_url?: string;
  video_url?: string;
  location?: string;
  province?: string;
  city?: string;
  district?: string;
  created_at: string;
}

export const timelineApi = {
  getEvents: () => api.get<{ events: TimelineEvent[] }>('/timeline/events'),
  createEvent: (data: AllowNull<Omit<TimelineEvent, 'id' | 'couple_id' | 'created_at'>>) =>
    api.post<{ event: TimelineEvent }>('/timeline/events', data),
  updateEvent: (id: string, data: AllowNull<Partial<TimelineEvent>>) =>
    api.put<{ event: TimelineEvent }>(`/timeline/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/timeline/events/${id}`),
};

// ==================== 照片 API ====================

export interface Photo {
  id: string;
  couple_id: string;
  image_url: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  taken_at?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  province?: string;
  city?: string;
  district?: string;
  created_at: string;
  photo_tags?: { tag?: Tag }[];
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
}

export const photosApi = {
  getPhotos: () => api.get<{ photos: Photo[] }>('/photos'),
  createPhoto: (data: AllowNull<Omit<Photo, 'id' | 'couple_id' | 'created_at'>> & { tagIds?: string[] }) =>
    api.post<{ photo: Photo }>('/photos', data),
  deletePhoto: (id: string) => api.delete(`/photos/${id}`),
  getTags: () => api.get<{ tags: Tag[] }>('/photos/tags'),
  createTag: (name: string) => api.post<{ tag: Tag }>('/photos/tags', { name }),
};

// ==================== 年度报告 API ====================

export interface AnnualReportMonth {
  month: number;
  label: string;
  eventCount: number;
  photoCount: number;
  total: number;
}

export interface AnnualReportLocation {
  label: string;
  total: number;
  eventCount: number;
  photoCount: number;
}

export interface AnnualReport {
  year: number;
  availableYears: number[];
  summary: {
    placeCount: number;
    provinceCount: number;
    cityCount: number;
    photoCount: number;
    eventCount: number;
    activeDays: number;
    activeMonths: number;
  };
  monthly: AnnualReportMonth[];
  topLocations: AnnualReportLocation[];
  busiestMonth: AnnualReportMonth | null;
}

export const reportApi = {
  getAnnual: (year: number) =>
    api.get<{ report: AnnualReport }>(`/report/annual?year=${year}`),
};

// ==================== 愿望清单 API ====================

export interface WishlistItem {
  id: string;
  couple_id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string;
  completion_image_url?: string;
  created_at: string;
}

export const wishlistApi = {
  getItems: () => api.get<{ items: WishlistItem[] }>('/wishlist'),
  createItem: (data: AllowNull<Omit<WishlistItem, 'id' | 'couple_id' | 'created_at' | 'completed' | 'completed_at'>>) =>
    api.post<{ item: WishlistItem }>('/wishlist', data),
  updateItem: (id: string, data: AllowNull<Partial<WishlistItem>>) =>
    api.put<{ item: WishlistItem }>(`/wishlist/${id}`, data),
  deleteItem: (id: string) => api.delete(`/wishlist/${id}`),
};

// ==================== 时光胶囊 API ====================

export interface TimeCapsule {
  id: string;
  couple_id: string;
  title: string;
  content: string;
  unlock_date: string;
  is_unlocked: boolean;
  created_at: string;
}

export const capsulesApi = {
  getCapsules: () => api.get<{ capsules: TimeCapsule[] }>('/capsules'),
  createCapsule: (data: AllowNull<Omit<TimeCapsule, 'id' | 'couple_id' | 'created_at' | 'is_unlocked'>>) =>
    api.post<{ capsule: TimeCapsule }>('/capsules', data),
  updateCapsule: (id: string, data: AllowNull<Partial<TimeCapsule>>) =>
    api.put<{ capsule: TimeCapsule }>(`/capsules/${id}`, data),
  deleteCapsule: (id: string) => api.delete(`/capsules/${id}`),
  unlockCapsule: (id: string) => api.post<{ capsule: TimeCapsule }>(`/capsules/${id}/unlock`, {}),
};

// ==================== 成就 API ====================

export interface Achievement {
  id: string;
  couple_id: string;
  achievement_type: string;
  title: string;
  description: string | null;
  icon: string;
  is_custom: boolean;
  unlocked_at: string | null;
}

export interface AchievementInput {
  title: string;
  description?: string | null;
  icon?: string;
}

export const achievementsApi = {
  getAchievements: () => api.get<{ achievements: Achievement[] }>('/achievements'),
  createAchievement: (data: AchievementInput) =>
    api.post<{ achievement: Achievement }>('/achievements', data),
  updateAchievement: (id: string, data: Partial<AchievementInput> & { unlocked?: boolean }) =>
    api.put<{ achievement: Achievement }>(`/achievements/${id}`, data),
  deleteAchievement: (id: string) => api.delete(`/achievements/${id}`),
  unlockAchievement: (data: AchievementInput & { achievement_type: string }) =>
    api.post<{ achievement: Achievement }>('/achievements/unlock', data),
};

// ==================== 信件 API ====================

export interface Letter {
  id: string;
  couple_id: string;
  title: string;
  content: string;
  from_partner: string;
  to_partner: string;
  written_date: string;
  image_url?: string;
  created_at: string;
}

export const lettersApi = {
  getLetters: () => api.get<{ letters: Letter[] }>('/letters'),
  createLetter: (data: AllowNull<Omit<Letter, 'id' | 'couple_id' | 'created_at'>>) =>
    api.post<{ letter: Letter }>('/letters', data),
  updateLetter: (id: string, data: AllowNull<Partial<Letter>>) =>
    api.put<{ letter: Letter }>(`/letters/${id}`, data),
  deleteLetter: (id: string) => api.delete(`/letters/${id}`),
};

// ==================== 礼物 API ====================

export interface Gift {
  id: string;
  couple_id: string;
  title: string;
  description?: string;
  given_by: string;
  given_to: string;
  given_date: string;
  image_url?: string;
  category?: string;
  created_at: string;
}

export const giftsApi = {
  getGifts: () => api.get<{ gifts: Gift[] }>('/gifts'),
  createGift: (data: AllowNull<Omit<Gift, 'id' | 'couple_id' | 'created_at'>>) =>
    api.post<{ gift: Gift }>('/gifts', data),
  updateGift: (id: string, data: AllowNull<Partial<Gift>>) =>
    api.put<{ gift: Gift }>(`/gifts/${id}`, data),
  deleteGift: (id: string) => api.delete(`/gifts/${id}`),
};

// ==================== 门票 API ====================

export interface Ticket {
  id: string;
  couple_id: string;
  title: string;
  description?: string;
  event_date: string;
  image_url: string;
  category?: string;
  location?: string;
  created_at: string;
}

export const ticketsApi = {
  getTickets: () => api.get<{ tickets: Ticket[] }>('/tickets'),
  createTicket: (data: AllowNull<Omit<Ticket, 'id' | 'couple_id' | 'created_at'>>) =>
    api.post<{ ticket: Ticket }>('/tickets', data),
  updateTicket: (id: string, data: AllowNull<Partial<Ticket>>) =>
    api.put<{ ticket: Ticket }>(`/tickets/${id}`, data),
  deleteTicket: (id: string) => api.delete(`/tickets/${id}`),
};

// ==================== 对象存储同步 API ====================

export interface S3SyncConfiguration {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface S3SyncPublicConfiguration {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyIdHint: string;
}

export type SyncState =
  | 'unconfigured'
  | 'remote-empty'
  | 'upload-needed'
  | 'download-needed'
  | 'conflict'
  | 'synced';

export interface SyncStatus {
  state: SyncState;
  local: {
    isEmpty: boolean;
    fileCount: number;
    totalBytes: number;
  } | null;
  remote: {
    revision: string;
    createdAt: string;
    fileCount: number;
    totalBytes: number;
  } | null;
  lastSyncedAt: string | null;
}

export interface SyncRunResult {
  direction: 'upload' | 'download' | 'none';
  revision?: string;
  lastSyncedAt: string | null;
  recoveryCreated?: boolean;
}

export const syncApi = {
  getConfiguration: () =>
    api.get<{ configuration: S3SyncPublicConfiguration | null }>('/sync/s3/config'),
  saveConfiguration: (configuration: S3SyncConfiguration) =>
    api.put<{ configuration: S3SyncPublicConfiguration }>('/sync/s3/config', configuration),
  getStatus: () => api.get<SyncStatus>('/sync/status'),
  run: (direction: 'auto' | 'upload' | 'download' = 'auto') =>
    api.post<SyncRunResult>('/sync/run', { direction }),
};

export interface MediaCacheStatus {
  limitBytes: number;
  usedBytes: number;
  fileCount: number;
}

export const mediaCacheApi = {
  getStatus: () => api.get<MediaCacheStatus>('/media/cache/settings'),
  setLimit: (limitBytes: number) =>
    api.put<MediaCacheStatus>('/media/cache/settings', { limitBytes }),
};
