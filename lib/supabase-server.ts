import 'server-only';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Next.js guarda en caché las respuestas de fetch; los datos de la base siempre deben ser frescos
const noStore: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/** Cliente con la clave secreta. SOLO en el servidor (rutas /api). Se salta RLS: validar todo antes. */
export function getServiceClient(): SupabaseClient {
  if (!url || !serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: noStore } });
}

/** Cliente que actúa como el usuario que hace la petición (respeta RLS). */
export function getUserClient(accessToken: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` }, fetch: noStore },
  });
}

/** Lee el usuario desde la cabecera Authorization: Bearer <token>. */
export async function getRequestUser(req: Request): Promise<{ user: User; token: string } | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await getUserClient(token).auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}
