// src/services/api.ts
// Axios instance with Supabase auth token injection
// Token refresh is handled automatically by the Supabase JS client

import axios, { type AxiosError } from 'axios';
import type { ApiError } from '@/types/api';
import { supabase } from '@/config/supabase';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor — inject Supabase access token
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token && config.headers) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor — on 401, try refreshing the session before giving up
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !(originalRequest as any)._retried
    ) {
      (originalRequest as any)._retried = true;

      // Attempt to refresh the Supabase session (access token may have expired)
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (data.session && !refreshError) {
        // Retry the original request with the fresh token
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
        return api(originalRequest);
      }

      // Refresh failed — session is truly invalid
      useAuthStore.getState().logout();
      queryClient.clear();
    }

    return Promise.reject(error);
  }
);

export default api;
