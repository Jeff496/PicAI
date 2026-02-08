// src/App.tsx
// Application router setup
// Defines routes and integrates ProtectedRoute for auth

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { PhotosPage } from '@/pages/PhotosPage';
import { PeoplePage } from '@/pages/PeoplePage';
import { PersonPhotosPage } from '@/pages/PersonPhotosPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { InvitePage } from '@/pages/InvitePage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

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

        {/* Public invite page (no auth required) */}
        <Route path="/invite/:token" element={<InvitePage />} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/photos" replace />} />

        {/* 404 fallback */}
        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">404</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Page not found</p>
                <a
                  href="/photos"
                  className="mt-4 inline-block text-primary hover:text-primary-dark"
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
