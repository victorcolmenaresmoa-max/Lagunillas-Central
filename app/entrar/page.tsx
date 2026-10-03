'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { AuthShell, Divider, FormAlert, NoAccountNeeded, PasswordField, TextField, emailSuggestion, isEmail } from '@/components/auth';
import VerifyEmail from '@/components/VerifyEmail';
import { getBrowserClient } from '@/lib/supabase-browser';
import { homeForRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { buyerReturnPath } from '@/lib/buyer-navigation';
import type { Role } from '@/lib/types';

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const business = params.get('acceso') === 'negocio';
  const returnTo = buyerReturnPath(next);
  const signupHref = business ? '/aliados/registro' : `/registro/cliente?next=${encodeURIComponent(returnTo)}`;
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
    if (!business && data?.role !== 'client') {
      setChecking(false);
      setLoading(false);
      setFormError('Esta cuenta tiene un panel de trabajo. Para comprar, usa una cuenta de comprador.');
      return;
    }
    const home = homeForRole(data?.role as Role);
    router.replace(!business ? returnTo : next && next.startsWith('/') && !next.startsWith('//') && (next.startsWith(home) || data?.role === 'client' && /^\/(comercio\/|mi-cuenta|mis-pedidos)/.test(next)) ? next : home);
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
        await sb.auth.resend({ type: 'signup', email: clean, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(business ? '/entrar?acceso=negocio' : returnTo)}` } }).catch(() => {});
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
        <VerifyEmail next={business ? '/entrar?acceso=negocio' : returnTo} email={email.trim().toLowerCase()} onVerified={go} onChangeEmail={() => setUnconfirmed(false)} />
      </AuthShell>
    );
  }

  const suggestion = emailSuggestion(email);

  return (
    <AuthShell
      tab="entrar"
      title={business ? "Entrar a mi panel" : "Compra con confianza"}
      subtitle={business ? "Acceso para comercios, repartidores y administración." : "Guarda tus direcciones, confirma tus pagos y sigue tu pedido hasta la entrega."}
      loginHref={business ? "/entrar?acceso=negocio" : `/entrar?next=${encodeURIComponent(returnTo)}`}
      registerHref={signupHref}
      footer={business ? undefined : <NoAccountNeeded />}
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
            {formError && <FormAlert>{formError}{formError.startsWith("Esta cuenta") && <Link href="/entrar?acceso=negocio" className="mt-2 block font-bold underline">Entrar a mi panel de trabajo</Link>}</FormAlert>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Iniciar sesión'}
            </button>
          </form>

          <Divider>¿No tienes cuenta?</Divider>

          <Link href={signupHref} className="btn-primary w-full py-3.5">
            {business ? 'Registrar comercio o repartidor' : 'Crear mi cuenta para comprar'}
          </Link>
          {!business && <p className="mt-3 flex items-center justify-center gap-2 text-sm text-laguna-700"><ShieldCheck size={18} /> Tus direcciones y comprobantes son privados.</p>}

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
