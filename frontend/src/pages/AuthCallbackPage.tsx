// src/pages/AuthCallbackPage.tsx
// Handles the redirect after Google OAuth sign-in
// Supabase JS client picks up tokens from the URL hash automatically

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle both SIGNED_IN (normal flow) and INITIAL_SESSION (session already
    // established before listener registered — can happen in Supabase JS v2.39+)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        navigate('/photos', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-white" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Signing you in...</p>
      </div>
    </div>
  );
}
