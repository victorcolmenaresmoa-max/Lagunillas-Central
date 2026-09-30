'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import AuthHero from '@/components/AuthHero';
import { getBrowserClient } from '@/lib/supabase-browser';
import { homeForRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { Role } from '@/lib/types';

/** Se llega aquí desde el enlace de "¿Olvidaste tu contraseña?" */
export default function NuevaClavePage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrowserClient()?.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    const sb = getBrowserClient()!;
    setSaving(true);
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      return setError(friendlyError(error));
    }
    const { data: p } = await sb.from('profiles').select('role').eq('user_id', data.user.id).maybeSingle();
    router.replace(homeForRole(p?.role as Role));
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col pb-10">
      <AuthHero title="Nueva contraseña" subtitle="Elige una contraseña que recuerdes." back="/entrar" />
      {ready === false ? (
        <p className="card mx-5 mt-7 p-5 text-center text-sm text-tinta-600">
          El enlace venció o ya se usó. Vuelve a <a href="/entrar" className="font-semibold text-laguna-600">Entrar</a> y pide uno nuevo.
        </p>
      ) : (
        <form onSubmit={submit} className="card mx-5 mt-7 space-y-4 rounded-[28px] p-5">
          {[
            ['Contraseña nueva', password, setPassword],
            ['Repítela', confirm, setConfirm],
          ].map(([label, value, set]: any) => (
            <div key={label}>
              <label className="label">{label}</label>
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-400" />
                <input type="password" autoComplete="new-password" className="input pl-11" value={value} onChange={(e) => set(e.target.value)} required minLength={8} />
              </div>
            </div>
          ))}
          {error && <p className="rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">{error}</p>}
          <button type="submit" disabled={saving || ready === null} className="btn-primary w-full py-3.5">
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </main>
  );
}
