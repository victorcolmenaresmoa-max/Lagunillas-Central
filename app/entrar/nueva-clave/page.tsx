'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import { AuthShell, FormAlert, PasswordField, passwordOk } from '@/components/auth';
import { getBrowserClient } from '@/lib/supabase-browser';
import { homeForRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { Role } from '@/lib/types';

/** Se llega aquí desde el botón del correo de recuperación */
export default function NuevaClavePage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrowserClient()?.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordOk(password)) return setError('Usa al menos 8 caracteres, con letras y números.');
    const sb = getBrowserClient()!;
    setSaving(true);
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      return setError(friendlyError(error));
    }
    const { data: p } = await sb.from('profiles').select('role').eq('user_id', data.user.id).maybeSingle();
    router.replace(homeForRole(p?.role as Role));
    router.refresh();
  };

  return (
    <AuthShell showTabs={false} title="Crea una contraseña nueva" subtitle="Elige una que recuerdes." backHref="/entrar">
      {ready === false ? (
        <FormAlert>
          El enlace venció o ya se usó.{' '}
          <Link href="/entrar/recuperar" className="font-bold underline">
            Pide un código nuevo
          </Link>
        </FormAlert>
      ) : (
        <form onSubmit={submit} noValidate className="card space-y-4 rounded-[28px] p-5">
          <PasswordField label="Contraseña nueva" icon={Lock} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} error={error} showRules placeholder="Mínimo 8 caracteres" />
          <button type="submit" disabled={saving || ready === null} className="btn-primary w-full py-3.5 text-base">
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar y entrar'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
