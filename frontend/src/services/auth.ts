// src/services/auth.ts
// Authentication API service
// Handles login, register, refresh, logout, and user profile

import api from './api';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshResponse,
  MeResponse,
  LogoutResponse,
  User,
} from '@/types/api';

export const authService = {
  /**
   * Login with email and password
   * Stores tokens and user in Zustand store
   */
  async login(credentials: LoginRequest): Promise<User> {
    useAuthStore.getState().setLoading(true);

    try {
      const { data } = await api.post<AuthResponse>('/auth/login', credentials);
      const { user, accessToken, refreshToken } = data;

      // Store in Zustand (automatically persisted to localStorage)
      useAuthStore.getState().setAuth(user, accessToken, refreshToken);

      return user;
    } catch (error) {
      useAuthStore.getState().setLoading(false);
      throw error;
    }
  },

  /**
   * Register a new user account
   * Automatically logs in after successful registration
   */
  async register(userData: RegisterRequest): Promise<User> {
    useAuthStore.getState().setLoading(true);

    try {
      const { data } = await api.post<AuthResponse>('/auth/register', userData);
      const { user, accessToken, refreshToken } = data;

      // Store in Zustand (automatically persisted to localStorage)
      useAuthStore.getState().setAuth(user, accessToken, refreshToken);

      return user;
    } catch (error) {
      useAuthStore.getState().setLoading(false);
      throw error;
    }
  },

  /**
   * Refresh access token using refresh token
   * Called automatically by axios interceptor on 401
   */
  async refresh(): Promise<RefreshResponse> {
    const refreshToken = useAuthStore.getState().refreshToken;

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const { data } = await api.post<RefreshResponse>('/auth/refresh', {
      refreshToken,
    });

    // Update tokens in store
    useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);

    return data;
  },

  /**
   * Logout user
   * Clears local state and optionally notifies server
   */
  async logout(): Promise<void> {
    try {
      // Notify server (optional, JWT is stateless)
      await api.post<LogoutResponse>('/auth/logout');
    } catch {
      // Ignore errors - we're logging out anyway
    } finally {
      // Always clear local state and query cache
      useAuthStore.getState().logout();
      queryClient.clear();
    }
  },

  /**
   * Get current user profile
   * Useful for validating stored session on app load
   */
  async getMe(): Promise<User> {
    const { data } = await api.get<MeResponse>('/auth/me');
    const { user } = data;

    // Update user in store (in case it changed)
    useAuthStore.getState().setUser(user);

    return user;
  },

  /**
   * Check if user is authenticated
   * Validates stored tokens by calling /auth/me
   */
  async validateSession(): Promise<boolean> {
    const { accessToken, isAuthenticated } = useAuthStore.getState();

    if (!accessToken || !isAuthenticated) {
      return false;
    }

    try {
      await authService.getMe();
      return true;
    } catch {
      // Token invalid or expired, clear state
      useAuthStore.getState().logout();
      return false;
    }
  },
};
