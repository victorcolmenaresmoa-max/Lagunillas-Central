import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true cuando las claves de Supabase están configuradas en .env.local / Vercel */
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('TU-PROYECTO'));

let publicClient: SupabaseClient | null = null;

/** Cliente de solo lectura pública (sirve en servidor y navegador) */
export function getPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!publicClient) {
    publicClient = createClient(url!, anonKey!, {
      auth: { persistSession: false },
      // Sin caché: comercios, ofertas y horarios siempre al día
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return publicClient;
}
