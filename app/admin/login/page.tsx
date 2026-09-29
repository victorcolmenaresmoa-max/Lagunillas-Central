'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, Info } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import Landscape from '@/components/Landscape';
import { getBrowserClient } from '@/lib/supabase-browser';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const sb = getBrowserClient();
    if (!sb) {
      router.push('/admin/dashboard');
      return;
    }
    setLoading(true);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'Correo o contraseña incorrectos.'
          : error.message.includes('Email not confirmed')
            ? 'Debes confirmar tu correo antes de entrar.'
            : 'No pudimos iniciar sesión. Intenta de nuevo.'
      );
      return;
    }
    router.replace('/admin/dashboard');
    router.refresh();
  };

  const onForgot = async () => {
    setError(null);
    const sb = getBrowserClient();
    if (!sb) return;
    if (!email.trim()) {
      setError('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".');
      return;
    }
    await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin/dashboard` });
    setInfo('Si el correo está registrado, te enviamos un enlace para cambiar la contraseña.');
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col pb-10">
      <div className="relative h-[260px] overflow-hidden">
        <Landscape className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-cal-100" />
        <div className="pt-safe relative px-5 pt-4">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30 text-white ring-1 ring-white/40 backdrop-blur-md transition active:scale-90" aria-label="Volver">
            <ArrowLeft size={20} />
          </Link>
        </div>
      </div>

      <div className="relative -mt-24 flex animate-fade-up flex-col items-center px-5 text-center">
        <LogoMark className="h-16 w-16 rounded-2xl shadow-lift ring-4 ring-cal-100" />
        <h1 className="heading mt-4 text-[30px]">Panel de comercios</h1>
        <p className="mt-1.5 max-w-[290px] text-sm text-tinta-500">
          Gestiona tu negocio, tu catálogo y tus ofertas en <span className="font-semibold text-laguna-600">Lagunillas Central</span>.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card relative mx-5 mt-7 animate-fade-up space-y-4 rounded-[28px] p-5" style={{ animationDelay: '100ms' }}>
        {!isSupabaseConfigured && (
          <div className="flex gap-2.5 rounded-2xl border border-cielo-400/40 bg-cielo-100 p-3 text-xs text-cielo-600">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>
              <b>Modo demostración.</b> La base de datos aún no está conectada. Toca &quot;Entrar&quot; para explorar el panel con datos de ejemplo.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">Correo</label>
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-400" />
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required={isSupabaseConfigured}
              placeholder="tu@negocio.com"
              className="input pl-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="label">Contraseña</label>
          <div className="relative">
            <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-400" />
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required={isSupabaseConfigured}
              placeholder="••••••••"
              className="input px-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-tinta-400 hover:text-tinta-700"
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
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

        {isSupabaseConfigured && (
          <button type="button" onClick={onForgot} className="w-full text-center text-sm font-medium text-tinta-500 hover:text-tinta-900">
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </form>

      <p className="relative mt-6 px-5 text-center text-xs text-tinta-400">
        ¿Quieres registrar tu negocio? Escríbenos y te creamos tu acceso.
      </p>
    </main>
  );
}
