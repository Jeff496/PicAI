// src/stores/authStore.ts
// Zustand store for authentication state with localStorage persistence
// Handles user session, tokens, and auth actions

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/api';
import { initializeTokenAccessors } from '@/services/api';

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      // Initial state
      ...initialState,

      // Set full auth state after login/register
      setAuth: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      // Update user profile
      setUser: (user) => set({ user }),

      // Update tokens (after refresh)
      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
        }),

      // Set loading state
      setLoading: (isLoading) => set({ isLoading }),

      // Clear all auth state
      logout: () => set(initialState),
    }),
    {
      name: 'picai-auth', // localStorage key
      partialize: (state) => ({
        // Only persist these fields (not isLoading)
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize token accessors for api.ts to avoid circular dependency
// This runs after the store is created
initializeTokenAccessors({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (accessToken, refreshToken) =>
    useAuthStore.getState().setTokens(accessToken, refreshToken),
  logout: () => useAuthStore.getState().logout(),
});
