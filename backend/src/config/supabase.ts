// src/config/supabase.ts
// Supabase client for server-side auth verification
// Uses the secret (service_role) key for admin operations

import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
