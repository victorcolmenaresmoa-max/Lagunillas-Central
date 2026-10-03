'use client';

import { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { CodeInput, FormAlert, OTP_LENGTH, OTP_VALID_TEXT, ResendButton } from './auth';
import { getBrowserClient } from '@/lib/supabase-browser';
import { friendlyError } from '@/lib/errors';

/**
 * Confirmar el correo con el código (cuando Supabase exige confirmación).
 * Se usa al crear cuenta y al intentar entrar con una cuenta sin confirmar.
 */
export default function VerifyEmail({ email, onVerified, onChangeEmail, next = '/entrar' }: { email: string; onVerified: (userId: string) => void; onChangeEmail?: () => void; next?: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async (value: string) => {
    const sb = getBrowserClient();
    if (!sb || busy) return;
    setBusy(true);
    setError(null);
    const { data, error } = await sb.auth.verifyOtp({ email, token: value, type: 'email' });
    setBusy(false);
    if (error || !data.user) {
      setCode('');
      return setError(friendlyError(error ?? 'Token has expired or is invalid'));
    }
    onVerified(data.user.id);
  };

  return (
    <div className="card space-y-5 rounded-[28px] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-laguna-100 text-laguna-600">
          <MailCheck size={24} />
        </span>
        <p className="text-sm text-tinta-600">
          Te enviamos un <b>código de {OTP_LENGTH} dígitos</b> a <b className="break-all text-tinta-900">{email}</b>. Escríbelo aquí para activar tu cuenta. Vale por {OTP_VALID_TEXT}.
        </p>
      </div>

      <CodeInput value={code} onChange={setCode} onComplete={verify} error={error} disabled={busy} />

      <button onClick={() => verify(code)} disabled={busy || code.length < OTP_LENGTH} className="btn-primary w-full py-3.5 text-base">
        {busy ? <Loader2 size={20} className="animate-spin" /> : 'Confirmar mi cuenta'}
      </button>

      {info && <FormAlert kind="ok">{info}</FormAlert>}

      <div className="flex flex-col items-center gap-2 text-center">
        <ResendButton
          onResend={async () => {
            const sb = getBrowserClient()!;
            const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
            if (error) setError(friendlyError(error));
            else setInfo('Listo, te enviamos un código nuevo.');
          }}
        />
        <p className="text-xs text-tinta-400">Revisa también spam o promociones. Si pides otro, usa siempre el más reciente.</p>
        {onChangeEmail && (
          <button type="button" onClick={onChangeEmail} className="text-xs font-semibold text-tinta-500 underline underline-offset-2">
            Me equivoqué de correo
          </button>
        )}
      </div>
    </div>
  );
}
