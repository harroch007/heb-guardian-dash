import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Separate Supabase client for admin sessions.
// Uses a unique storageKey so admin auth tokens don't collide
// with parent auth tokens in localStorage.
export const adminSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    storageKey: 'sb-admin-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
