// src/services/api.ts
// Axios instance with Supabase auth token injection.
// The request interceptor reads the access token from the Zustand store
// (synchronous) rather than calling supabase.auth.getSession() (async),
// avoiding navigator.locks contention that causes production auth stalls.

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

// Request interceptor — inject access token from Zustand store.
// Reading from the store is synchronous and avoids calling getSession(),
// which acquires navigator.locks and can stall/deadlock on production
// page refresh (the root cause of the post-refresh auth failure).
// The store stays fresh via onAuthStateChange in App.tsx (handles
// INITIAL_SESSION, TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT, etc.).
api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;
  if (session?.access_token && config.headers) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor — on 401, try refreshing the session before giving up
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as
      | (typeof error.config & { _retried?: boolean })
      | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;

      // Attempt to refresh the Supabase session (access token may have expired)
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (data.session && !refreshError) {
        // Update the store so subsequent requests use the fresh token
        useAuthStore.getState().setSession(data.session);
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
