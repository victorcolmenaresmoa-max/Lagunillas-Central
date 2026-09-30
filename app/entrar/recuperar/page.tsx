'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import { AuthShell, CodeInput, FormAlert, PasswordField, ResendButton, TextField, emailSuggestion, isEmail, passwordOk } from '@/components/auth';
import { getBrowserClient } from '@/lib/supabase-browser';
import { homeForRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

type Step = 'correo' | 'codigo' | 'clave' | 'listo';

function Recuperar() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>('correo');
  const [email, setEmail] = useState(params.get('correo') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [home, setHome] = useState('/');

  const clean = email.trim().toLowerCase();

  const sendCode = async () => {
    const sb = getBrowserClient();
    if (!sb) throw new Error('La app aún no está conectada a la base de datos.');
    const { error } = await sb.auth.resetPasswordForEmail(clean, {
      redirectTo: `${window.location.origin}/auth/callback?next=/entrar/nueva-clave`,
    });
    if (error) throw error;
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isEmail(email)) return setError('Escribe el correo con el que te registraste.');
    setBusy(true);
    try {
      await sendCode();
      setStep('codigo');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (busy) return;
    const sb = getBrowserClient()!;
    setBusy(true);
    setError(null);
    const { data, error } = await sb.auth.verifyOtp({ email: clean, token: value, type: 'recovery' });
    setBusy(false);
    if (error || !data.session) {
      setCode('');
      return setError(friendlyError(error ?? 'Token has expired or is invalid'));
    }
    const { data: p } = await sb.from('profiles').select('role').eq('user_id', data.user!.id).maybeSingle();
    setHome(homeForRole(p?.role as Role));
    setStep('clave');
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordOk(password)) return setError('Usa al menos 8 caracteres, con letras y números, sin espacios al inicio ni al final.');
    const sb = getBrowserClient()!;
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setStep('listo');
    setTimeout(() => {
      router.replace(home);
      router.refresh();
    }, 1600);
  };

  const steps: Step[] = ['correo', 'codigo', 'clave'];
  const idx = steps.indexOf(step);
  const progress = (
    <div className="mb-4 flex gap-2" aria-hidden>
      {steps.map((s, i) => (
        <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= idx || step === 'listo' ? 'bg-laguna-500' : 'bg-cal-300')} />
      ))}
    </div>
  );

  if (step === 'listo') {
    return (
      <AuthShell title="¡Listo!" showTabs={false}>
        <div className="card flex flex-col items-center p-8 text-center">
          <CheckCircle2 size={56} className="animate-pop text-laguna-500" />
          <p className="mt-3 text-lg font-bold text-tinta-900">Tu contraseña fue actualizada</p>
          <p className="mt-1 text-sm text-tinta-500">Entrando a tu cuenta…</p>
          <Loader2 className="mt-4 animate-spin text-laguna-500" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      showTabs={false}
      title={step === 'correo' ? 'Recupera tu cuenta' : step === 'codigo' ? 'Revisa tu correo' : 'Crea una contraseña nueva'}
      subtitle={
        step === 'correo'
          ? 'Escribe tu correo y te enviaremos un código para crear una contraseña nueva.'
          : step === 'codigo'
            ? (
                <>
                  Enviamos un código de 6 dígitos a <b className="break-all text-tinta-900">{clean}</b>.
                </>
              )
            : 'Elige una contraseña que recuerdes. La usarás para entrar de ahora en adelante.'
      }
      onBack={step === 'codigo' ? () => (setStep('correo'), setError(null), setCode('')) : undefined}
      backHref="/entrar"
    >
      {progress}

      {step === 'correo' && (
        <form onSubmit={submitEmail} noValidate className="card space-y-4 rounded-[28px] p-5">
          <TextField
            label="Correo"
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoFocus
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            hint={
              emailSuggestion(email) ? (
                <button type="button" onClick={() => setEmail(emailSuggestion(email)!)} className="font-semibold text-laguna-600">
                  ¿Quisiste decir {emailSuggestion(email)}?
                </button>
              ) : undefined
            }
          />
          <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-base">
            {busy ? <Loader2 size={20} className="animate-spin" /> : 'Enviarme el código'}
          </button>
          <p className="text-center text-sm text-tinta-500">
            ¿Te acordaste?{' '}
            <Link href="/entrar" className="font-bold text-laguna-600">
              Inicia sesión
            </Link>
          </p>
        </form>
      )}

      {step === 'codigo' && (
        <div className="card space-y-5 rounded-[28px] p-5">
          <CodeInput value={code} onChange={setCode} onComplete={verify} error={error} disabled={busy} />
          <button onClick={() => verify(code)} disabled={busy || code.length < 6} className="btn-primary w-full py-3.5 text-base">
            {busy ? <Loader2 size={20} className="animate-spin" /> : 'Continuar'}
          </button>
          {info && <FormAlert kind="ok">{info}</FormAlert>}
          <div className="space-y-2 text-center">
            <ResendButton
              onResend={async () => {
                try {
                  setError(null);
                  await sendCode();
                  setInfo('Te enviamos un código nuevo. Usa el más reciente.');
                } catch (err) {
                  setError(friendlyError(err));
                }
              }}
            />
            <p className="text-xs text-tinta-400">¿No llega? Revisa spam o promociones. También puedes tocar el botón del correo.</p>
          </div>
        </div>
      )}

      {step === 'clave' && (
        <form onSubmit={savePassword} noValidate className="card space-y-4 rounded-[28px] p-5">
          <div className="flex items-center gap-2 rounded-2xl bg-laguna-50 p-3 text-sm font-semibold text-laguna-700 ring-1 ring-laguna-200">
            <KeyRound size={16} /> Código correcto. Ya casi terminas.
          </div>
          <PasswordField
            label="Contraseña nueva"
            icon={Lock}
            autoComplete="new-password"
            autoFocus
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            showRules
          />
          <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-base">
            {busy ? <Loader2 size={20} className="animate-spin" /> : 'Guardar y entrar'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function RecuperarPage() {
  return (
    <Suspense>
      <Recuperar />
    </Suspense>
  );
}
