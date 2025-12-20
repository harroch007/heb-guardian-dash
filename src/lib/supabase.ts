import { createClient, SupabaseClient } from '@supabase/supabase-js';

// You need to set these environment variables or replace with your Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database tables
export interface Device {
  id: string;
  name?: string;
  battery_level?: number;
  last_seen?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  created_at?: string;
}

export interface Alert {
  id: string;
  sender: string;
  content: string;
  risk_score: number;
  created_at: string;
  device_id?: string;
}
