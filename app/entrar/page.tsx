'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle } from 'lucide-react';
import AuthHero from '@/components/AuthHero';
import { getBrowserClient } from '@/lib/supabase-browser';
import { homeForRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { Role } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error') === 'enlace' ? 'El enlace ya no es válido. Pide uno nuevo.' : null);
  const [info, setInfo] = useState<string | null>(params.get('registro') === 'ok' ? 'Te enviamos un correo para confirmar tu cuenta. Después, entra aquí.' : null);

  const go = async (userId: string) => {
    const sb = getBrowserClient()!;
    const { data } = await sb.from('profiles').select('role').eq('user_id', userId).maybeSingle();
    const home = homeForRole(data?.role as Role);
    router.replace(next && next.startsWith('/') && home !== '/' && next.startsWith(home) ? next : home);
    router.refresh();
  };

  // Si ya tiene sesión, va directo a su panel
  useEffect(() => {
    const sb = getBrowserClient();
    sb?.auth.getSession().then(({ data }) => data.session && go(data.session.user.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const sb = getBrowserClient();
    if (!sb) return setError('La app aún no está conectada a la base de datos.');
    setLoading(true);
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setLoading(false);
      return setError(friendlyError(error));
    }
    await go(data.user.id);
  };

  const onForgot = async () => {
    setError(null);
    const sb = getBrowserClient();
    if (!sb) return;
    if (!email.trim()) return setError('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".');
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/entrar/nueva-clave`,
    });
    if (error) return setError(friendlyError(error));
    setInfo('Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.');
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col pb-10">
      <AuthHero
        title="Entrar"
        subtitle={
          <>
            Para comercios, repartidores y administración de <span className="font-semibold text-laguna-600">Lagunillas Central</span>.
          </>
        }
      />

      <form onSubmit={onSubmit} className="card relative mx-5 mt-7 animate-fade-up space-y-4 rounded-[28px] p-5" style={{ animationDelay: '100ms' }}>
        <div>
          <label htmlFor="email" className="label">Correo</label>
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-400" />
            <input id="email" type="email" inputMode="email" autoComplete="email" required placeholder="tu@correo.com" className="input pl-11" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="password" className="label">Contraseña</label>
          <div className="relative">
            <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-400" />
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="••••••••" className="input px-11" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-tinta-400 hover:text-tinta-700" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-2xl border border-teja-400/40 bg-teja-100 p-3 text-sm text-teja-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {info && <p className="rounded-2xl border border-laguna-400/40 bg-laguna-100 p-3 text-sm text-laguna-700">{info}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
          {loading ? <Loader2 size={20} className="animate-spin" /> : 'Entrar'}
        </button>
        <button type="button" onClick={onForgot} className="w-full text-center text-sm font-medium text-tinta-500 hover:text-tinta-900">
          ¿Olvidaste tu contraseña?
        </button>
      </form>

      <div className="mx-5 mt-5 grid grid-cols-2 gap-3">
        <Link href="/registro?tipo=comercio" className="card p-4 text-center transition active:scale-[0.98]">
          <p className="text-2xl">🏪</p>
          <p className="mt-1 text-sm font-bold text-tinta-900">Registra tu comercio</p>
        </Link>
        <Link href="/registro?tipo=repartidor" className="card p-4 text-center transition active:scale-[0.98]">
          <p className="text-2xl">🛵</p>
          <p className="mt-1 text-sm font-bold text-tinta-900">Sé repartidor</p>
        </Link>
      </div>
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
