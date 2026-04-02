// src/config/supabase.ts
// Supabase client for frontend auth operations
// Uses the publishable (anon) key — safe for browser

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
