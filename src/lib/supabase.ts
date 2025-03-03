import { createClient } from '@supabase/supabase-js';

// These will be populated when the user connects to Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// More explicit error handling
if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL is undefined. Check your environment variables.');
  // Provide a fallback or throw an informative error
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Supabase URL is missing. Check console for details.</div>';
  throw new Error('VITE_SUPABASE_URL is undefined');
}

if (!supabaseAnonKey) {
  console.error('VITE_SUPABASE_ANON_KEY is undefined. Check your environment variables.');
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Supabase key is missing. Check console for details.</div>';
  throw new Error('VITE_SUPABASE_ANON_KEY is undefined');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type HungerRecord = {
  id: string;
  created_at: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
};