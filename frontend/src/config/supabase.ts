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

export const supabase = createClient(supabaseUrl, supabaseKey);
