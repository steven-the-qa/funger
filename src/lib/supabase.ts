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

export type CookieReward = {
  id: string;
  created_at: string;
  user_id: string;
  hunger_record_id: string;
  cookie_type: 'chocolate_chip' | 'sugar' | 'rainbow' | 'golden' | 'special';
  milestone: string | null;
  streak_count: number;
};

export type UserCookieStats = {
  id: string;
  user_id: string;
  total_cookies: number;
  current_streak: number;
  longest_streak: number;
  last_cookie_date: string | null;
};

// Cookie rarity probabilities
export const COOKIE_RARITIES = {
  chocolate_chip: 0.7, // 70% chance
  sugar: 0.2,         // 20% chance
  rainbow: 0.08,      // 8% chance
  golden: 0.02,       // 2% chance
  special: 0          // Special events only
};

// Cookie achievement definitions
export const COOKIE_ACHIEVEMENTS = [
  { id: 'first_cookie', name: 'First Bite', description: 'Earn your first cookie', requirement: 1 },
  { id: 'cookie_collector', name: 'Cookie Collector', description: 'Earn 10 cookies', requirement: 10 },
  { id: 'cookie_monster', name: 'Cookie Monster', description: 'Earn 25 cookies', requirement: 25 },
  { id: 'bakers_dozen', name: 'Baker\'s Dozen', description: 'Beat 13 cravings in a row', requirement: 13, isStreak: true },
  { id: 'cookie_master', name: 'Cookie Master', description: 'Earn 50 cookies', requirement: 50 },
];