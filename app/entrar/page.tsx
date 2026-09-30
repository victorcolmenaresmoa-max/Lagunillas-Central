'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Mail, Store, Bike } from 'lucide-react';
import { AuthShell, Divider, FormAlert, NoAccountNeeded, PasswordField, TextField, emailSuggestion, isEmail } from '@/components/auth';
import VerifyEmail from '@/components/VerifyEmail';
import { getBrowserClient } from '@/lib/supabase-browser';
import { homeForRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { Role } from '@/lib/types';

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(
    params.get('error') === 'enlace' ? 'Ese enlace ya no es válido. Si querías cambiar tu contraseña, pide un código nuevo.' : null
  );
  const [info, setInfo] = useState<string | null>(
    params.get('clave') === 'ok' ? '¡Contraseña actualizada! Ya puedes iniciar sesión.' : params.get('confirmado') === 'ok' ? '¡Cuenta confirmada! Inicia sesión.' : null
  );
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  const go = async (userId: string) => {
    const sb = getBrowserClient()!;
    const { data } = await sb.from('profiles').select('role').eq('user_id', userId).maybeSingle();
    const home = homeForRole(data?.role as Role);
    router.replace(next && next.startsWith('/') && home !== '/' && next.startsWith(home) ? next : home);
    router.refresh();
  };

  useEffect(() => {
    // Recuerda el último correo usado en este teléfono
    try {
      const last = localStorage.getItem('lc-ultimo-correo');
      if (last) setEmail(last);
    } catch {}
    const sb = getBrowserClient();
    if (!sb) return setChecking(false);
    sb.auth.getSession().then(({ data }) => (data.session ? go(data.session.user.id) : setChecking(false)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfo(null);
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'Escribe tu correo.';
    else if (!isEmail(email)) errs.email = 'Ese correo no parece válido.';
    if (!password) errs.password = 'Escribe tu contraseña.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const sb = getBrowserClient();
    if (!sb) return setFormError('La app aún no está conectada a la base de datos.');
    setLoading(true);
    const clean = email.trim().toLowerCase();
    let { data, error } = await sb.auth.signInWithPassword({ email: clean, password });
    // El teclado del teléfono a veces agrega un espacio al final sin que se note
    if (error && /Invalid login credentials/i.test(error.message) && password !== password.trim()) {
      ({ data, error } = await sb.auth.signInWithPassword({ email: clean, password: password.trim() }));
    }
    if (error) {
      setLoading(false);
      if (/Email not confirmed/i.test(error.message)) {
        await sb.auth.resend({ type: 'signup', email: clean }).catch(() => {});
        return setUnconfirmed(true);
      }
      if (/Invalid login credentials/i.test(error.message)) {
        setPassword('');
        passRef.current?.focus();
        return setErrors({ password: 'Correo o contraseña incorrectos. Revisa e intenta de nuevo.' });
      }
      return setFormError(friendlyError(error));
    }
    try {
      localStorage.setItem('lc-ultimo-correo', clean);
    } catch {}
    await go(data.user!.id);
  };

  if (unconfirmed) {
    return (
      <AuthShell title="Confirma tu correo" subtitle="Tu cuenta existe, pero falta confirmar el correo." onBack={() => setUnconfirmed(false)} showTabs={false}>
        <VerifyEmail email={email.trim().toLowerCase()} onVerified={go} onChangeEmail={() => setUnconfirmed(false)} />
      </AuthShell>
    );
  }

  const suggestion = emailSuggestion(email);

  return (
    <AuthShell
      tab="entrar"
      title="¡Hola de nuevo!"
      subtitle="Inicia sesión para entrar a tu panel de comercio, repartidor o administración."
      footer={<NoAccountNeeded />}
    >
      {checking ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-laguna-500" />
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} noValidate className="card space-y-4 rounded-[28px] p-5">
            {info && <FormAlert kind="ok">{info}</FormAlert>}
            <TextField
              id="email"
              label="Correo"
              icon={Mail}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
              }}
              error={errors.email}
              hint={
                suggestion ? (
                  <button type="button" onClick={() => setEmail(suggestion)} className="font-semibold text-laguna-600">
                    ¿Quisiste decir {suggestion}?
                  </button>
                ) : undefined
              }
            />
            <PasswordField
              ref={passRef}
              id="password"
              label="Contraseña"
              icon={Lock}
              autoComplete="current-password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
              }}
              error={errors.password}
              right={
                <Link href={`/entrar/recuperar${email ? `?correo=${encodeURIComponent(email.trim())}` : ''}`} className="text-xs font-bold text-laguna-600">
                  ¿La olvidaste?
                </Link>
              }
            />
            {formError && <FormAlert>{formError}</FormAlert>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Iniciar sesión'}
            </button>
          </form>

          <Divider>¿No tienes cuenta?</Divider>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/registro?tipo=comercio" className="card flex flex-col items-center gap-2 p-4 text-center transition active:scale-[0.97]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teja-100 text-teja-600">
                <Store size={21} />
              </span>
              <span className="text-sm font-bold leading-tight text-tinta-900">Registrar mi comercio</span>
            </Link>
            <Link href="/registro?tipo=repartidor" className="card flex flex-col items-center gap-2 p-4 text-center transition active:scale-[0.97]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-laguna-100 text-laguna-600">
                <Bike size={21} />
              </span>
              <span className="text-sm font-bold leading-tight text-tinta-900">Quiero ser repartidor</span>
            </Link>
          </div>
          <Link href="/registro" className="btn-ghost mt-3 w-full py-3">
            Crear una cuenta
          </Link>
        </>
      )}
    </AuthShell>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
