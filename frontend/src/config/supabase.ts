// src/config/supabase.ts
// Supabase client for frontend auth operations
// Uses the publishable (anon) key — safe for browser

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment. ' +
      'Ensure your .env has the VITE_ prefix (Vite only exposes VITE_-prefixed vars).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Bypass navigator.locks to prevent auth stalls on production page refresh.
    // The default Supabase client uses navigator.locks (Web Locks API) to
    // serialize session operations across tabs. On production (HTTPS + Azure
    // SWA), the lock acquired during initialization (which may include a token
    // refresh network call) can stall getSession(), refreshSession(), and
    // signOut() — causing the post-refresh "authenticated but broken" state.
    // A no-op lock is safe for PicAI: single-user per browser, and the
    // in-memory Supabase client state prevents actual data corruption.
    lock: <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
  },
});
