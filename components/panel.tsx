'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, BellRing, LogOut, Share, PlusSquare, ExternalLink } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enablePush, getPushState, type PushState } from '@/lib/push-client';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';

/* ---------------- Cabecera de los paneles ---------------- */
export function PanelHeader({
  sb,
  avatar,
  title,
  subtitle,
  link,
  right,
}: {
  sb: SupabaseClient | null;
  avatar: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  link?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const signOut = async () => {
    await sb?.auth.signOut();
    router.replace('/entrar');
    router.refresh();
  };
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-cal-300 bg-cal-100/85 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-tinta-900">{title}</p>
          {subtitle && <div className="truncate text-xs text-tinta-500">{subtitle}</div>}
        </div>
        {right}
        {link && (
          <Link href={link} target="_blank" className="flex h-9 items-center gap-1.5 rounded-xl border border-cal-300 bg-white/70 px-3 text-xs font-semibold text-tinta-700 active:scale-95">
            <ExternalLink size={14} /> Ver
          </Link>
        )}
        <button onClick={signOut} aria-label="Cerrar sesión" className="flex h-9 w-9 items-center justify-center rounded-xl border border-cal-300 bg-white/70 text-tinta-500 active:scale-95">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

/* ---------------- Activar notificaciones ---------------- */
export function PushCard({
  sb,
  userId,
  text,
  compact,
  onError,
}: {
  sb: SupabaseClient;
  userId: string;
  text: string;
  compact?: boolean;
  onError?: (msg: string) => void;
}) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  if (state === null || state === 'on') {
    return state === 'on' && !compact ? (
      <p className="flex items-center gap-2 rounded-2xl bg-laguna-50 px-3 py-2 text-xs font-semibold text-laguna-700 ring-1 ring-laguna-200">
        <BellRing size={14} /> Notificaciones activadas en este teléfono
      </p>
    ) : null;
  }

  const activate = async () => {
    setBusy(true);
    try {
      setState(await enablePush(sb, userId));
    } catch (e) {
      onError?.(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('rounded-3xl border-2 border-dashed p-4', state === 'denied' ? 'border-teja-400/50 bg-teja-100/50' : 'border-ocre-400/50 bg-ocre-100/60')}>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', state === 'denied' ? 'bg-teja-100 text-teja-600' : 'bg-ocre-200 text-ocre-600')}>
          {state === 'denied' ? <BellOff size={19} /> : <Bell size={19} />}
        </span>
        <div className="flex-1 text-sm">
          {state === 'ios-needs-install' ? (
            <>
              <p className="font-bold text-tinta-900">Instala la app para recibir avisos</p>
              <p className="mt-1 text-tinta-600">En iPhone, las notificaciones solo funcionan con la app instalada:</p>
              <p className="mt-2 flex items-center gap-1.5 text-tinta-700">
                1. Toca <Share size={14} className="text-cielo-500" /> <b>Compartir</b>
              </p>
              <p className="flex items-center gap-1.5 text-tinta-700">
                2. Elige <PlusSquare size={14} className="text-cielo-500" /> <b>Agregar a inicio</b>
              </p>
              <p className="text-tinta-700">3. Abre la app desde tu pantalla y entra de nuevo.</p>
            </>
          ) : state === 'denied' ? (
            <>
              <p className="font-bold text-tinta-900">Las notificaciones están bloqueadas</p>
              <p className="mt-1 text-tinta-600">
                Actívalas en los ajustes del navegador para este sitio (ícono 🔒 junto a la dirección → Notificaciones → Permitir).
              </p>
            </>
          ) : state === 'unsupported' ? (
            <>
              <p className="font-bold text-tinta-900">Este navegador no recibe notificaciones</p>
              <p className="mt-1 text-tinta-600">Usa Chrome en Android o instala la app en tu iPhone. Mientras tanto, deja esta pantalla abierta: sonará al llegar un pedido.</p>
            </>
          ) : (
            <>
              <p className="font-bold text-tinta-900">Activa las notificaciones</p>
              <p className="mt-1 text-tinta-600">{text}</p>
              <button onClick={activate} disabled={busy} className="btn-primary mt-3 py-2.5 text-sm">
                <Bell size={16} /> {busy ? 'Activando…' : 'Activar notificaciones'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Aviso de estado (revisión / suspendido) ---------------- */
export function StatusBanner({ status, kind }: { status: 'pending' | 'approved' | 'suspended'; kind: 'comercio' | 'repartidor' }) {
  if (status === 'approved') return null;
  return status === 'pending' ? (
    <div className="flex gap-3 rounded-3xl bg-ocre-100 p-4 text-sm text-ocre-600 ring-1 ring-ocre-400/40">
      <span className="text-2xl">⏳</span>
      <div>
        <p className="font-bold text-tinta-900">Tu cuenta está en revisión</p>
        <p className="mt-0.5 text-tinta-600">
          {kind === 'comercio'
            ? 'Mientras tanto, sube tu logo y tus productos. Tu comercio aparecerá en la app apenas lo aprobemos.'
            : 'Te avisaremos cuando esté aprobada. Mientras tanto, sube una foto tuya para que los clientes te reconozcan.'}
        </p>
      </div>
    </div>
  ) : (
    <div className="flex gap-3 rounded-3xl bg-teja-100 p-4 text-sm ring-1 ring-teja-400/40">
      <span className="text-2xl">⛔</span>
      <div>
        <p className="font-bold text-tinta-900">Cuenta suspendida</p>
        <p className="mt-0.5 text-tinta-600">
          {kind === 'comercio' ? 'Tu comercio no se muestra en la app.' : 'No puedes recibir pedidos.'} Escríbele a la administración para más información.
        </p>
      </div>
    </div>
  );
}
