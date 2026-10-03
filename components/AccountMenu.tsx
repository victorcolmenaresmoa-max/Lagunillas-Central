'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bike, ChevronRight, LayoutDashboard, LogIn, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase-browser';
import { homeForRole } from '@/lib/auth';
import type { Role } from '@/lib/types';

const ROLE_LABEL: Record<string, string> = { admin: 'Administración', merchant: 'Panel de mi comercio', delivery: 'Panel de repartidor', client: 'Mis pedidos' };

/** Botón de cuenta en la portada: abre un menú claro con todas las opciones */
export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const sb = getBrowserClient();
    sb?.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: p } = await sb.from('profiles').select('role, full_name').eq('user_id', data.session.user.id).maybeSingle();
      if (p) {
        setRole(p.role as Role);
        setName(p.full_name);
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const loggedIn = Boolean(role);

  return (
    <>
      {loggedIn ? (
        <Link
          href={homeForRole(role)}
          className="flex h-10 items-center gap-1.5 rounded-2xl bg-white/25 px-3 text-xs font-bold text-white ring-1 ring-white/40 backdrop-blur-md transition active:scale-95"
        >
          <LayoutDashboard size={16} /> {role === 'client' ? 'Mis pedidos' : 'Mi panel'}
        </Link>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-10 items-center gap-1.5 rounded-2xl bg-white/25 px-3 text-xs font-bold text-white ring-1 ring-white/40 backdrop-blur-md transition active:scale-95"
          aria-haspopup="dialog"
        >
          <UserRound size={16} /> Iniciar sesión
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Tu cuenta">
          <button aria-label="Cerrar" onClick={() => setOpen(false)} className="absolute inset-0 bg-tinta-900/40 backdrop-blur-sm" />
          <div className="pb-safe relative w-full max-w-md animate-slide-up rounded-t-[32px] bg-cal-50 px-5 pt-3 shadow-lift">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cal-300" />
            <div className="mb-1 flex items-center justify-between">
              <h2 className="heading text-2xl">{name ? `Hola, ${name.split(' ')[0]}` : 'Tu cuenta'}</h2>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-tinta-500 hover:bg-cal-200" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-ocre-100 p-3 text-sm text-tinta-700">
              <ShoppingBag size={18} className="shrink-0 text-ocre-600" />
              <span>
                <b>Explora sin cuenta.</b> Para pagar y seguir pedidos en la app necesitas una cuenta de cliente.
              </span>
            </div>

            <Link href="/entrar" onClick={() => setOpen(false)} className="btn-primary w-full py-3.5 text-base">
              <LogIn size={18} /> Iniciar sesión
            </Link>

            <p className="mb-2 mt-5 text-center text-sm font-semibold text-tinta-500">¿No tienes cuenta? Crea una:</p>
            <div className="space-y-2.5 pb-5">
              {(
                [
                  ['/registro/cliente', ShoppingBag, 'Crear mi cuenta para comprar', 'Direcciones, pagos y seguimiento de pedidos', 'bg-cielo-100 text-cielo-600'],
                ] as const
              ).map(([href, Icon, title, text, tone]) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="card flex items-center gap-3 p-3.5 transition active:scale-[0.98]">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
                    <Icon size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-tinta-900">{title}</span>
                    <span className="block text-xs text-tinta-500">{text}</span>
                  </span>
                  <ChevronRight size={18} className="text-tinta-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
