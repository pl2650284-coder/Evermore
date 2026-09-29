'use client';

import { API_BASE_URL } from './api';

// 上传文件到服务器
export async function uploadFile(file: File, folder: string = 'uploads'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error('文件上传失败');
  }

  const result = await response.json();
  return result.url;
}
