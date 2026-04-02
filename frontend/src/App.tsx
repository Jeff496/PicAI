import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useThemeStore, applyTheme } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/config/supabase';
import { authService } from '@/services/auth';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { PhotosPage } from '@/pages/PhotosPage';
import { PeoplePage } from '@/pages/PeoplePage';
import { PersonPhotosPage } from '@/pages/PersonPhotosPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { InvitePage } from '@/pages/InvitePage';
import { ChatPage } from '@/pages/ChatPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

function App() {
  // Apply theme on mount and when it changes
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Restore Supabase session on page load and listen for auth changes
  useEffect(() => {
    // 1. Restore session from Supabase storage (reads localStorage — near-instant).
    //    Resolve isLoading BEFORE calling the backend so the redirect to /photos
    //    fires immediately, matching the old Zustand-persist behavior.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().setLoading(false);

      // Populate user profile in the background (don't block the redirect)
      if (session) {
        try {
          const user = await authService.getMe();
          useAuthStore.getState().setUser(user);
        } catch {
          // Backend unreachable — auth state is still valid based on Supabase session
        }
      }
    });

    // 2. Listen for ongoing auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      useAuthStore.getState().setSession(session);

      if (session) {
        try {
          const user = await authService.getMe();
          useAuthStore.getState().setUser(user);
        } catch {
          // Backend unreachable — session remains valid
        }
      } else {
        useAuthStore.getState().setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Protected routes */}
        <Route
          path="/photos"
          element={
            <ProtectedRoute>
              <PhotosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people"
          element={
            <ProtectedRoute>
              <PeoplePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/:personId"
          element={
            <ProtectedRoute>
              <PersonPhotosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <ProtectedRoute>
              <GroupDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Public invite */}
        <Route path="/invite/:token" element={<InvitePage />} />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">404</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Page not found</p>
                <a
                  href="/photos"
                  className="mt-4 inline-block text-sm text-accent hover:text-accent-hover"
                >
                  Go to Photos
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
