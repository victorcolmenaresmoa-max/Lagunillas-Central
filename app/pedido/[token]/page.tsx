'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, MapPin, Store, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Landscape from '@/components/Landscape';
import MerchantAvatar from '@/components/MerchantAvatar';
import { STATUS_LABEL, VEHICLE_LABEL, waLink } from '@/lib/delivery';
import { cn, formatPrice } from '@/lib/utils';
import type { DeliveryStatus, TrackingInfo } from '@/lib/types';

const STEPS: { key: DeliveryStatus; label: string; at: keyof TrackingInfo }[] = [
  { key: 'searching', label: 'Pedido recibido', at: 'created_at' },
  { key: 'accepted', label: 'Repartidor asignado', at: 'accepted_at' },
  { key: 'picked_up', label: 'Recogido en el comercio', at: 'picked_up_at' },
  { key: 'delivered', label: 'Entregado', at: 'delivered_at' },
];
const ORDER: DeliveryStatus[] = ['searching', 'accepted', 'picked_up', 'delivered'];

const hour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' }) : '';

export default function TrackingPage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deliveries/track/${params.token}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setInfo(json);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'No pudimos cargar tu pedido.');
    }
  }, [params.token]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
      setNow(Date.now());
    }, 8000);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const cancel = async () => {
    if (!confirm('¿Cancelar la solicitud de repartidor?')) return;
    setCancelling(true);
    const res = await fetch(`/api/deliveries/track/${params.token}/cancel`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    setCancelling(false);
    if (!res.ok) alert(json.error || 'No se pudo cancelar.');
    load();
  };

  if (error && !info) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <XCircle size={40} className="text-tinta-400" />
        <p className="heading mt-3 text-2xl">{error}</p>
        <Link href="/" className="btn-primary mt-6">Volver al inicio</Link>
      </main>
    );
  }
  if (!info) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-laguna-500" size={32} />
      </main>
    );
  }

  const idx = ORDER.indexOf(info.status);
  const cancelled = info.status === 'cancelled';
  const delivered = info.status === 'delivered';
  const waitingLong = info.status === 'searching' && now - new Date(info.created_at).getTime() > 15 * 60 * 1000;

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-16">
      <header className="relative h-[210px] overflow-hidden bg-[#79a9c6]">
        <Landscape variant={delivered ? 'ocaso' : 'laguna'} priority position="center 40%" className="absolute inset-0" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#10263a]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-cal-100/60 to-cal-100" />
        <div className="pt-safe-top relative px-4">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30 text-white ring-1 ring-white/40 backdrop-blur-md" aria-label="Inicio">
            <ArrowLeft size={20} />
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-white/90 drop-shadow">Pedido {info.code}</p>
        </div>
      </header>

      <section className="relative -mt-16 px-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
                cancelled ? 'bg-cal-200' : delivered ? 'bg-laguna-100' : 'bg-ocre-100'
              )}
            >
              {cancelled ? '✖️' : delivered ? '✅' : info.status === 'searching' ? '🔎' : '🛵'}
            </span>
            <div>
              <h1 className="heading text-2xl leading-tight">{STATUS_LABEL[info.status]}</h1>
              {!cancelled && !delivered && (
                <p className="flex items-center gap-1.5 text-xs text-tinta-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-laguna-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-laguna-500" />
                  </span>
                  Se actualiza solo
                </p>
              )}
              {cancelled && info.cancel_reason && <p className="text-xs text-tinta-500">{info.cancel_reason}</p>}
            </div>
          </div>

          {!cancelled && (
            <ol className="mt-5 space-y-0">
              {STEPS.map((s, i) => {
                const done = i <= idx;
                const current = i === idx && !delivered;
                return (
                  <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < STEPS.length - 1 && (
                      <span className={cn('absolute left-[11px] top-6 h-full w-0.5', i < idx ? 'bg-laguna-500' : 'bg-cal-300')} />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                        done ? 'border-laguna-500 bg-laguna-500 text-white' : 'border-cal-300 bg-cal-50',
                        current && 'ring-4 ring-laguna-400/25'
                      )}
                    >
                      {done && <CheckCircle2 size={14} />}
                    </span>
                    <div className="flex flex-1 justify-between gap-2">
                      <span className={cn('text-sm', done ? 'font-semibold text-tinta-900' : 'text-tinta-400')}>{s.label}</span>
                      <span className="text-xs tabular-nums text-tinta-400">{hour(info[s.at] as string | null)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {waitingLong && (
            <p className="mt-4 rounded-2xl bg-ocre-100 p-3 text-xs text-ocre-600">
              Todavía no hay repartidor disponible. Puedes seguir esperando o escribirle al comercio para coordinar la entrega.
            </p>
          )}

          {info.status === 'searching' && (
            <button onClick={cancel} disabled={cancelling} className="mt-4 w-full text-center text-sm font-semibold text-teja-500">
              {cancelling ? 'Cancelando…' : 'Cancelar solicitud'}
            </button>
          )}
        </div>
      </section>

      {/* Repartidor */}
      {info.driver && !cancelled && (
        <section className="mt-4 px-4">
          <div className="card flex items-center gap-3 p-4">
            {info.driver.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.driver.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-laguna-100 text-2xl">🛵</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-tinta-400">Tu repartidor</p>
              <p className="truncate font-bold text-tinta-900">{info.driver.full_name}</p>
              <p className="text-xs text-tinta-500">
                {VEHICLE_LABEL[info.driver.vehicle]}
                {info.driver.plate ? ` · ${info.driver.plate}` : ''}
              </p>
            </div>
            {info.driver.phone && (
              <div className="flex gap-2">
                <a href={`tel:+${info.driver.phone}`} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cal-200 text-tinta-700" aria-label="Llamar">
                  <Phone size={18} />
                </a>
                <a href={waLink(info.driver.phone, `Hola ${info.driver.full_name}, soy el cliente del pedido ${info.code}.`)} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center rounded-2xl bg-[#25d366] px-3 text-sm font-bold text-white">
                  WhatsApp
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Resumen */}
      <section className="mt-4 px-4">
        <div className="card divide-y divide-cal-200">
          <div className="flex items-center gap-3 p-4">
            <MerchantAvatar name={info.merchant.name} category={info.merchant.category} logoUrl={info.merchant.logo_url} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-tinta-900">{info.merchant.name}</p>
              {info.merchant.address && <p className="truncate text-xs text-tinta-500">{info.merchant.address}</p>}
            </div>
            <a href={waLink(info.merchant.whatsapp_number, `Hola, sobre mi pedido ${info.code}…`)} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cal-200 text-tinta-700" aria-label="Escribir al comercio">
              <Store size={17} />
            </a>
          </div>
          <div className="flex items-start gap-3 p-4 text-sm">
            <MapPin size={17} className="mt-0.5 shrink-0 text-laguna-600" />
            <p className="text-tinta-700">{info.address}</p>
          </div>
          <ul className="space-y-1 p-4 text-sm">
            {info.items.map((i) => (
              <li key={i.product_id} className="flex justify-between gap-2">
                <span className="text-tinta-700">
                  {i.qty}× {i.title}
                </span>
                <span className="tabular-nums text-tinta-500">{formatPrice(i.qty * i.price)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-cal-200 pt-2 text-tinta-500">
              <span>Delivery</span>
              <span className="tabular-nums">{formatPrice(info.delivery_fee)}</span>
            </li>
            <li className="flex justify-between font-extrabold text-tinta-900">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(Number(info.subtotal) + Number(info.delivery_fee))}</span>
            </li>
          </ul>
          <p className="flex items-center gap-1.5 p-4 text-xs text-tinta-400">
            <Clock size={12} /> El pago se coordina con el comercio y con el repartidor.
          </p>
        </div>
      </section>
    </main>
  );
}
