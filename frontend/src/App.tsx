import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useThemeStore, applyTheme } from '@/stores/themeStore';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { PhotosPage } from '@/pages/PhotosPage';
import { PeoplePage } from '@/pages/PeoplePage';
import { PersonPhotosPage } from '@/pages/PersonPhotosPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { InvitePage } from '@/pages/InvitePage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

// Temporary — remove after theme is finalized
import { SampleIndex } from '@/pages/samples/SampleIndex';
import { ModernMinimalSample } from '@/pages/samples/ModernMinimalSample';
import { GlassFrostedSample } from '@/pages/samples/GlassFrostedSample';
import { BoldVibrantSample } from '@/pages/samples/BoldVibrantSample';
import { DarkPremiumSample } from '@/pages/samples/DarkPremiumSample';
import { RefinedLandingSample } from '@/pages/samples/RefinedLandingSample';
import { RefinedAppSample } from '@/pages/samples/RefinedAppSample';

function App() {
  // Apply theme on mount and when it changes
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Theme samples (temporary) */}
        <Route path="/samples" element={<SampleIndex />} />
        <Route path="/samples/modern-minimal" element={<ModernMinimalSample />} />
        <Route path="/samples/glass-frosted" element={<GlassFrostedSample />} />
        <Route path="/samples/bold-vibrant" element={<BoldVibrantSample />} />
        <Route path="/samples/dark-premium" element={<DarkPremiumSample />} />
        <Route path="/samples/refined-landing" element={<RefinedLandingSample />} />
        <Route path="/samples/refined-app" element={<RefinedAppSample />} />

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
