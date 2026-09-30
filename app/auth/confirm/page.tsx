'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { AuthShell, FormAlert } from '@/components/auth';
import { getBrowserClient } from '@/lib/supabase-browser';
import { friendlyError } from '@/lib/errors';

/**
 * Destino del botón que llega por correo.
 * Pide un toque antes de validar: algunos correos abren los enlaces solos
 * para revisarlos, y eso gastaría el enlace antes de que la persona lo use.
 */
function Confirm() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  const nextRaw = params.get('next') || '/entrar';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/entrar';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRecovery = type === 'recovery';

  const go = async () => {
    const sb = getBrowserClient();
    if (!sb || !tokenHash || !type) return setError('Este enlace está incompleto.');
    setBusy(true);
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      setBusy(false);
      return setError(friendlyError(error));
    }
    router.replace(isRecovery ? '/entrar/nueva-clave' : next === '/entrar' ? '/entrar?confirmado=ok' : next);
  };

  return (
    <AuthShell showTabs={false} title={isRecovery ? 'Cambiar contraseña' : 'Confirmar tu cuenta'} backHref="/entrar">
      <div className="card space-y-4 rounded-[28px] p-6 text-center">
        <ShieldCheck size={44} className="mx-auto text-laguna-500" />
        <p className="text-tinta-600">{isRecovery ? 'Toca el botón para crear tu contraseña nueva.' : 'Toca el botón para activar tu cuenta.'}</p>
        {error && (
          <FormAlert>
            {error}{' '}
            {isRecovery && (
              <Link href="/entrar/recuperar" className="font-bold underline">
                Pedir un código nuevo
              </Link>
            )}
          </FormAlert>
        )}
        <button onClick={go} disabled={busy || !tokenHash} className="btn-primary w-full py-3.5 text-base">
          {busy ? <Loader2 size={20} className="animate-spin" /> : 'Continuar'}
        </button>
      </div>
    </AuthShell>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <Confirm />
    </Suspense>
  );
}
