// src/services/api.ts
// Axios instance with request/response interceptors for JWT authentication
// Uses getter functions to avoid circular dependency with auth store

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError, RefreshResponse } from '@/types/api';

// Token getter/setter functions - set by auth store initialization
let getAccessToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let setTokens: (accessToken: string, refreshToken: string) => void = () => {};
let logout: () => void = () => {};

// Initialize token accessors - called from authStore after creation
export function initializeTokenAccessors(accessors: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}) {
  getAccessToken = accessors.getAccessToken;
  getRefreshToken = accessors.getRefreshToken;
  setTokens = accessors.setTokens;
  logout = accessors.logout;
}

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: Add access token to all requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = getAccessToken();

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If no config or already retried, reject
    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      const errorCode = error.response.data?.code;

      // If token expired, try to refresh
      if (errorCode === 'TOKEN_EXPIRED') {
        if (isRefreshing) {
          // Queue this request until refresh completes
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = getRefreshToken();

          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          // Call refresh endpoint
          const response = await axios.post<RefreshResponse>(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/refresh`,
            { refreshToken }
          );

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            response.data;

          // Update store with new tokens
          setTokens(newAccessToken, newRefreshToken);

          // Process queued requests
          processQueue(null, newAccessToken);

          // Retry original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          processQueue(refreshError as Error, null);
          logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Other 401 errors (invalid token, etc.) - logout
      if (
        errorCode === 'INVALID_TOKEN' ||
        errorCode === 'NO_TOKEN' ||
        errorCode === 'REFRESH_TOKEN_EXPIRED'
      ) {
        logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
