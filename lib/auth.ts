'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getBrowserClient } from './supabase-browser';
import type { Profile, Role } from './types';

export function homeForRole(role: Role | undefined | null) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'merchant':
      return '/panel';
    case 'delivery':
      return '/repartidor';
    case 'client':
      return '/mis-pedidos';
    default:
      return '/';
  }
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  supabase: SupabaseClient | null;
}

/**
 * Sesión + perfil del usuario. Si se pasa `role`, redirige a quien no tenga ese rol:
 *  - sin sesión → /entrar
 *  - con otro rol → a su propio panel
 */
export function useAuth(role?: Role): AuthState {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ loading: true, session: null, profile: null, supabase: null });

  useEffect(() => {
    const sb = getBrowserClient();
    if (!sb) {
      setState({ loading: false, session: null, profile: null, supabase: null });
      return;
    }
    let cancelled = false;

    const load = async (session: Session | null) => {
      if (!session) {
        if (role) router.replace(`/entrar?${role === 'client' ? '' : 'acceso=negocio&'}next=${encodeURIComponent(window.location.pathname)}`);
        if (!cancelled) setState({ loading: false, session: null, profile: null, supabase: sb });
        return;
      }
      const { data: profile } = await sb.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
      if (cancelled) return;
      if (role && profile?.role !== role) {
        router.replace(homeForRole(profile?.role));
        return;
      }
      setState({ loading: false, session, profile: (profile as Profile) ?? null, supabase: sb });
    };

    sb.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') load(null);
      if (event === 'TOKEN_REFRESHED' && session) setState((s) => ({ ...s, session }));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [role, router]);

  return state;
}

/** Llama a nuestras rutas /api con la sesión del usuario */
export async function apiFetch<T = any>(sb: SupabaseClient | null, url: string, body?: unknown): Promise<T> {
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined;
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Ocurrió un error. Intenta de nuevo.');
  return json as T;
}
