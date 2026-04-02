// src/services/auth.ts
// Authentication service using Supabase Auth
// Handles login, register, OAuth, logout, and session management

import { supabase } from '@/config/supabase';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';
import type { User } from '@/types/api';
import api from './api';
import type { MeResponse } from '@/types/api';

export const authService = {
  /**
   * Login with email and password via Supabase
   */
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /**
   * Register a new user via Supabase
   * Stores name in user_metadata for auto-create in backend middleware
   */
  async register(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with Google OAuth
   * Redirects to Google, then back to /auth/callback
   */
  async loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Logout — clears Supabase session, Zustand store, and query cache
   */
  async logout() {
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    queryClient.clear();
  },

  /**
   * Fetch the local user profile from backend (/auth/me)
   * The backend middleware auto-creates the local user record if needed
   */
  async getMe(): Promise<User> {
    const { data } = await api.get<MeResponse>('/auth/me');
    return data.user;
  },

  /**
   * Get the current Supabase session (for token access)
   */
  async getSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },
};
