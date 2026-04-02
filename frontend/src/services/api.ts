// src/services/api.ts
// Axios instance with Supabase auth token injection
// Token refresh is handled automatically by the Supabase JS client

import axios, { type AxiosError } from 'axios';
import type { ApiError } from '@/types/api';
import { supabase } from '@/config/supabase';
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

// Response interceptor — handle 401 (revoked token)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Token was revoked server-side — sign out and redirect
      await supabase.auth.signOut();
      queryClient.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
