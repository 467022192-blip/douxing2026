import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { env } from '../config/env';

const supabaseUrl = env.supabaseUrl || (env.isDev ? 'http://localhost:54321' : '');
const supabaseAnonKey = env.supabaseAnonKey || (env.isDev ? 'mock-key-for-development' : '');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
