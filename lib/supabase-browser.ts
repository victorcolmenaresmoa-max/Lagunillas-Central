'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabase';

let client: SupabaseClient | null = null;

/** Cliente con sesión (para el panel de comercios). null si Supabase no está configurado. */
export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) client = createClientComponentClient();
  return client;
}
