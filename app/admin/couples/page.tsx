'use client';

import { useEffect, useState } from 'react';
import { Heart, Search, Trash2, Eye, Calendar, Users as UsersIcon } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface AdminCouple {
  id: string;
  partner1_name: string;
  partner2_name: string;
  start_date: string;
  created_at: string;
  photo_count: number;
  event_count: number;
}

export default function AdminCouples() {
  const [couples, setCouples] = useState<AdminCouple[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCouples = async () => {
      try {
        const response = await adminApi.getCouples() as { couples: AdminCouple[] };
        setCouples(response.couples);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取情侣空间列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadCouples();
  }, []);

  const filteredCouples = couples.filter(
    couple =>
      couple.partner1_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      couple.partner2_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个情侣空间吗？所有相关数据都将被删除。')) {
      try {
        await adminApi.deleteCouple(id);
        setCouples(currentCouples => currentCouples.filter(couple => couple.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : '删除情侣空间失败');
      }
    }
  };

  const daysTogether = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">情侣空间管理</h1>
          <p className="text-gray-500 dark:text-gray-400">管理所有情侣空间和相关数据</p>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索情侣空间..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 情侣空间列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                情侣
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                相恋天数
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                照片数
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                事件数
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  正在加载情侣空间...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filteredCouples.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  暂无情侣空间
                </td>
              </tr>
            )}
            {filteredCouples.map((couple) => (
              <tr key={couple.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center">
                      <Heart className="w-6 h-6 text-white" fill="currentColor" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {couple.partner1_name} & {couple.partner2_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        始于 {new Date(couple.start_date).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{daysTogether(couple.start_date)} 天</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Eye className="w-4 h-4" />
                    <span>{Number(couple.photo_count)} 张</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <UsersIcon className="w-4 h-4" />
                    <span>{Number(couple.event_count)} 个</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                  {new Date(couple.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(couple.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 统计信息 */}
      <div className="mt-6 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>共 {filteredCouples.length} 个情侣空间</span>
      </div>
    </div>
  );
}
