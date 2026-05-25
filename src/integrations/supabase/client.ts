import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseAdminKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const adminSupabase = createClient<Database>(supabaseUrl, supabaseAdminKey || supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});