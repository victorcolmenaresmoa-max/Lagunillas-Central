'use client';

import OrdersBoard from '@/components/OrdersBoard';
import OrderProfile from '@/components/OrderProfile';
import { VerificationCard } from '@/components/Verification';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  History,
  UserRound,
  MapPin,
  Store,
  Phone,
  PackageCheck,
  Navigation,
  Loader2,
  Undo2,
  Radio,
  Coffee,
  Save,
} from 'lucide-react';
import { PanelHeader, PushCard, StatusBanner } from '@/components/panel';
import { BottomNav, Empty, Field, FullLoader, PhotoPicker, useToast } from '@/components/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { playChime, unlockAudio } from '@/lib/sound';
import { removeImage, uploadImage } from '@/lib/upload';
import { STATUS_CLASS, STATUS_SHORT, VEHICLE_LABEL, mapsLink, timeAgo, waLink } from '@/lib/delivery';
import { isValidPhone, normalizePhone } from '@/lib/validate';
import { cn, formatPrice } from '@/lib/utils';
import type { AvailableDelivery, DeliveryRequest, Driver, Merchant, Vehicle } from '@/lib/types';

type Tab = 'pedidos' | 'historial' | 'perfil';
type MyDelivery = DeliveryRequest & { merchant: Pick<Merchant, 'name' | 'address' | 'whatsapp_number' | 'category'> | null };

export default function RepartidorPage() {
  const { loading, session, supabase: sb } = useAuth('delivery');
  const { notify, toastNode } = useToast();
  const [driver, setDriver] = useState<Driver | null | undefined>(undefined);
  const [available, setAvailable] = useState<AvailableDelivery[]>([]);
  const [mine, setMine] = useState<MyDelivery[]>([]);
  const [tab, setTab] = useState<Tab>('pedidos');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const userId = session?.user.id;

  const loadDriver = useCallback(async () => {
    if (!sb || !userId) return;
    const { data } = await sb.from('drivers').select('*').eq('user_id', userId).maybeSingle();
    setDriver((data as Driver) ?? null);
  }, [sb, userId]);

  const loadDeliveries = useCallback(async () => {
    if (!sb || !driver || driver.status !== 'approved') return;
    const [{ data: av }, { data: my }] = await Promise.all([
      driver.is_online ? sb.rpc('available_deliveries') : Promise.resolve({ data: [] as AvailableDelivery[] }),
      sb
        .from('delivery_requests')
        .select('*, merchant:merchants(name, address, whatsapp_number, category)')
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false })
        .limit(60),
    ]);
    const list = (av ?? []) as AvailableDelivery[];
    // Suena si llegó un pedido nuevo mientras la pantalla está abierta
    if (seen.current) {
      if (list.some((d) => !seen.current!.has(d.id))) playChime();
    }
    seen.current = new Set(list.map((d) => d.id));
    setAvailable(list);
    setMine((my ?? []) as MyDelivery[]);
  }, [sb, driver]);

  useEffect(() => {
    loadDriver();
  }, [loadDriver]);

  // Aviso a la administración de un registro nuevo (una sola vez por teléfono)
  useEffect(() => {
    if (!driver || driver.status !== 'pending' || !sb) return;
    const key = `lc-aviso-${driver.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    apiFetch(sb, '/api/aviso-registro', {}).catch(() => {});
  }, [driver, sb]);

  // Revisa pedidos cada 10 s mientras la pantalla está visible + cuando llega una notificación
  useEffect(() => {
    loadDeliveries();
    const t = setInterval(() => document.visibilityState === 'visible' && loadDeliveries(), 10000);
    const onMsg = (e: MessageEvent) => e.data?.type === 'push' && loadDeliveries();
    const onVis = () => document.visibilityState === 'visible' && loadDeliveries();
    navigator.serviceWorker?.addEventListener('message', onMsg);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      navigator.serviceWorker?.removeEventListener('message', onMsg);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadDeliveries]);

  const setOnline = async (online: boolean) => {
    if (!sb) return;
    unlockAudio();
    setToggling(true);
    try {
      await apiFetch(sb,'/api/driver-position',{online});
      await loadDriver();
    } catch (e:any) { setToggling(false); return notify(e.message || 'Revisa tu conexión e intenta de nuevo.','err'); }
    setToggling(false);
    seen.current = null;
    notify(online ? '¡Estás disponible! Te avisaremos de cada pedido.' : 'Descansa. No recibirás pedidos.');
  };

  const act = async (id: string, action: 'accept' | 'release' | 'picked_up' | 'delivered', okMsg: string) => {
    unlockAudio();
    setBusyId(id);
    try {
      await apiFetch(sb, `/api/deliveries/${id}/action`, { action });
      notify(okMsg);
      if (action === 'accept') setTab('pedidos');
    } catch (e: any) {
      notify(e.message, 'err');
    } finally {
      setBusyId(null);
      loadDeliveries();
    }
  };

  const active = useMemo(() => mine.filter((d) => d.status === 'accepted' || d.status === 'picked_up'), [mine]);
  const past = useMemo(() => mine.filter((d) => d.status === 'delivered' || d.status === 'cancelled'), [mine]);

  if (loading || driver === undefined || !sb || !session) return <FullLoader />;

  if (driver === null) {
    return <CompleteDriver sb={sb} userId={session.user.id} onDone={loadDriver} />;
  }

  const approved = driver.status === 'approved';

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-32">
      <PanelHeader
        sb={sb}
        avatar={
          driver.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={driver.photo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-laguna-100 text-xl">🛵</span>
          )
        }
        title={driver.full_name}
        subtitle={`Repartidor · ${VEHICLE_LABEL[driver.vehicle]}${driver.plate ? ` · ${driver.plate}` : ''}`}
      />

      <div className="space-y-4 px-4 pt-4">
        <StatusBanner status={driver.status} kind="repartidor" />

        {tab === 'pedidos' && (
          <VerificationCard sb={sb} userId={session.user.id} kind="delivery" vehicle={driver.vehicle} approved={driver.status === 'approved'} prefill={{ legal_name: driver.full_name }} notify={notify} hideWhenComplete />
        )}

        {approved && tab !== 'perfil' && (
          <button
            onClick={() => setOnline(!driver.is_online)}
            disabled={toggling}
            className={cn(
              'relative flex w-full items-center gap-4 overflow-hidden rounded-[28px] p-5 text-left transition active:scale-[0.98]',
              driver.is_online ? 'bg-gradient-to-br from-laguna-500 to-laguna-700 text-white shadow-jade' : 'card'
            )}
          >
            <span
              className={cn(
                'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
                driver.is_online ? 'bg-white/15' : 'bg-cal-200 text-tinta-500'
              )}
            >
              {driver.is_online && <span className="absolute inset-0 animate-ping rounded-2xl bg-white/20" />}
              {toggling ? <Loader2 className="animate-spin" /> : driver.is_online ? <Radio size={26} /> : <Coffee size={26} />}
            </span>
            <span className="flex-1">
              <span className={cn('block text-lg font-extrabold', !driver.is_online && 'text-tinta-900')}>
                {driver.is_online ? 'Estás disponible' : 'No estás disponible'}
              </span>
              <span className={cn('block text-sm', driver.is_online ? 'text-white/80' : 'text-tinta-500')}>
                {driver.is_online ? 'Toca para dejar de recibir pedidos' : 'Toca para empezar a recibir pedidos'}
              </span>
            </span>
            <span className={cn('relative h-8 w-14 shrink-0 rounded-full transition', driver.is_online ? 'bg-white/30' : 'bg-cal-300')}>
              <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', driver.is_online ? 'left-7' : 'left-1')} />
            </span>
          </button>
        )}

        {approved && tab === 'pedidos' && (
          <PushCard sb={sb} userId={session.user.id} text="Te avisaremos con sonido cada vez que alguien pida un delivery, aunque tengas la app cerrada." onError={(m) => notify(m, 'err')} />
        )}

        {approved && tab === 'pedidos' && <><p className="card p-3 text-sm">Revisa las direcciones en Google Maps antes de aceptar. Los pedidos nuevos se pagan al recibir; confirma el pago del delivery en tu banco antes de cerrar la entrega.</p><OrdersBoard sb={sb} role="delivery" /></>}
        <details><summary>Pedidos anteriores por WhatsApp</summary>
        {/* ---------- PEDIDOS ANTERIORES ---------- */}
        {tab === 'pedidos' &&
          (approved ? (
            <>
              {active.length > 0 && (
                <section>
                  <h2 className="heading mb-2 text-xl">En curso</h2>
                  <div className="space-y-3">
                    {active.map((d) => (
                      <ActiveCard key={d.id} d={d} busy={busyId === d.id} onAct={act} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-2 flex items-end justify-between">
                  <h2 className="heading text-xl">Pedidos disponibles</h2>
                  {driver.is_online && (
                    <span className="flex items-center gap-1.5 text-xs text-tinta-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-laguna-500" /> en vivo
                    </span>
                  )}
                </div>
                {!driver.is_online ? (
                  <Empty icon={Coffee} title="Estás en descanso" text="Ponte disponible para ver y recibir pedidos." />
                ) : available.length === 0 ? (
                  <Empty icon={Bike} title="No hay pedidos por ahora" text="Deja la app abierta o activa las notificaciones: te avisaremos al instante." />
                ) : (
                  <div className="space-y-3">
                    {available.map((d) => (
                      <div key={d.id} className="card animate-fade-up overflow-hidden">
                        <div className="flex items-center justify-between bg-ocre-100 px-4 py-2 text-xs font-semibold text-ocre-600">
                          <span>Nuevo · {timeAgo(d.created_at)}</span>
                          <span className="font-mono">{d.code}</span>
                        </div>
                        <div className="space-y-2.5 p-4">
                          <p className="flex items-start gap-2 text-sm">
                            <Store size={16} className="mt-0.5 shrink-0 text-teja-500" />
                            <span>
                              <b className="text-tinta-900">Buscar en {d.merchant_name}</b>
                              {d.merchant_address && <span className="block text-tinta-500">{d.merchant_address}</span>}
                            </span>
                          </p>
                          <p className="flex items-start gap-2 text-sm">
                            <MapPin size={16} className="mt-0.5 shrink-0 text-laguna-600" />
                            <span>
                              <b className="text-tinta-900">Llevar a</b>
                              <span className="block text-tinta-500">{d.destination}</span>
                            </span>
                          </p>
                          <div className="flex items-center justify-between rounded-2xl bg-cal-100 px-3 py-2 text-sm">
                            <span className="text-tinta-500">
                              {d.items_count} artículo{d.items_count === 1 ? '' : 's'} · {formatPrice(d.subtotal)}
                            </span>
                            <span className="font-extrabold text-laguna-700">Ganas {formatPrice(d.delivery_fee)}</span>
                          </div>
                          <button onClick={() => act(d.id, 'accept', '¡Pedido tuyo! Ve a buscarlo.')} disabled={busyId === d.id} className="btn-primary w-full py-3.5 text-base">
                            {busyId === d.id ? <Loader2 className="animate-spin" size={18} /> : <Bike size={18} />} Aceptar pedido
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <Empty
              icon={Bike}
              title={driver.status === 'pending' ? 'Pronto podrás recibir pedidos' : 'Tu cuenta está suspendida'}
              text={driver.status === 'pending' ? 'Completa tu perfil con una foto mientras revisamos tu cuenta.' : undefined}
            />
          ))}

        </details>
        {/* ---------- HISTORIAL ---------- */}
        {tab === 'historial' && <HistoryTab past={past} />}

        {/* ---------- PERFIL ---------- */}
        {tab === 'perfil' && <OrderProfile sb={sb} role="delivery" />}
        {tab === 'perfil' && <DriverProfile sb={sb} userId={session.user.id} driver={driver} onSaved={(d) => { setDriver(d); notify('Perfil actualizado'); }} onError={(m) => notify(m, 'err')} />}
        {tab === 'perfil' && (
          <VerificationCard sb={sb} userId={session.user.id} kind="delivery" vehicle={driver.vehicle} approved={driver.status === 'approved'} prefill={{ legal_name: driver.full_name }} notify={notify} />
        )}
      </div>

      <BottomNav
        items={[
          ['pedidos', 'Pedidos', Bike],
          ['historial', 'Historial', History],
          ['perfil', 'Perfil', UserRound],
        ] as const}
        active={tab}
        onChange={setTab}
        badges={{ pedidos: available.length + active.length || undefined }}
      />
      {toastNode}
    </main>
  );
}

/* ================================================================ */

function ActiveCard({ d, busy, onAct }: { d: MyDelivery; busy: boolean; onAct: (id: string, a: any, msg: string) => void }) {
  const total = Number(d.subtotal) + Number(d.delivery_fee);
  const picked = d.status === 'picked_up';
  return (
    <div className="card overflow-hidden ring-2 ring-laguna-400">
      <div className="flex items-center justify-between bg-laguna-600 px-4 py-2.5 text-white">
        <span className="text-sm font-bold">{picked ? '2 · Llévalo al cliente' : '1 · Ve a buscarlo al comercio'}</span>
        <span className="font-mono text-xs">{d.code}</span>
      </div>
      <div className="divide-y divide-cal-200">
        {/* Comercio */}
        <div className={cn('flex items-start gap-3 p-4', picked && 'opacity-60')}>
          <Store size={18} className="mt-0.5 shrink-0 text-teja-500" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold text-tinta-900">{d.merchant?.name}</p>
            {d.merchant?.address && <p className="text-tinta-500">{d.merchant.address}</p>}
          </div>
          <div className="flex gap-1.5">
            {d.merchant?.address && (
              <a href={mapsLink(d.merchant.address)} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cal-200 text-tinta-700" aria-label="Cómo llegar al comercio">
                <Navigation size={16} />
              </a>
            )}
            {d.merchant?.whatsapp_number && (
              <a href={waLink(d.merchant.whatsapp_number, `Hola, soy el repartidor de Lagunillas Central. Voy por el pedido ${d.code}.`)} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center rounded-xl bg-[#25d366] px-2.5 text-xs font-bold text-white">
                WhatsApp
              </a>
            )}
          </div>
        </div>
        {/* Cliente */}
        <div className="flex items-start gap-3 p-4">
          <MapPin size={18} className="mt-0.5 shrink-0 text-laguna-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold text-tinta-900">{d.customer_name}</p>
            <p className="text-tinta-500">{d.address}</p>
            {d.notes && <p className="mt-1 rounded-xl bg-ocre-100 px-2 py-1 text-xs text-ocre-600">Nota: {d.notes}</p>}
          </div>
          <div className="flex gap-1.5">
            <a href={mapsLink(d.address)} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cal-200 text-tinta-700" aria-label="Cómo llegar al cliente">
              <Navigation size={16} />
            </a>
            <a href={`tel:+${d.customer_phone}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-cal-200 text-tinta-700" aria-label="Llamar al cliente">
              <Phone size={16} />
            </a>
            <a href={waLink(d.customer_phone, `Hola ${d.customer_name}, soy tu repartidor de Lagunillas Central (pedido ${d.code}).`)} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center rounded-xl bg-[#25d366] px-2.5 text-xs font-bold text-white">
              WhatsApp
            </a>
          </div>
        </div>
        {/* Detalle */}
        <div className="p-4 text-sm">
          <ul className="space-y-0.5 text-tinta-700">
            {d.items.map((i) => (
              <li key={i.product_id} className="flex justify-between">
                <span>
                  {i.qty}× {i.title}
                </span>
                <span className="tabular-nums text-tinta-500">{formatPrice(i.qty * i.price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between rounded-xl bg-cal-100 px-3 py-2">
            <span className="text-tinta-600">Total a cobrar (incluye tu delivery)</span>
            <span className="font-extrabold text-tinta-900">{formatPrice(total)}</span>
          </div>
        </div>
        <div className="flex gap-2 p-4">
          {!picked ? (
            <>
              <button onClick={() => confirm('¿Soltar este pedido? Volverá a los demás repartidores.') && onAct(d.id, 'release', 'Pedido liberado')} disabled={busy} className="btn-ghost px-3 text-sm">
                <Undo2 size={16} /> Soltar
              </button>
              <button onClick={() => onAct(d.id, 'picked_up', 'Recogido. ¡Buen viaje!')} disabled={busy} className="btn-primary flex-1 py-3.5">
                {busy ? <Loader2 className="animate-spin" size={18} /> : <PackageCheck size={18} />} Ya lo recogí
              </button>
            </>
          ) : (
            <button onClick={() => confirm('¿Confirmas que entregaste el pedido?') && onAct(d.id, 'delivered', '¡Entregado! Buen trabajo 🙌')} disabled={busy} className="btn-primary flex-1 py-3.5">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <PackageCheck size={18} />} Marcar como entregado
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ past }: { past: MyDelivery[] }) {
  const delivered = past.filter((d) => d.status === 'delivered');
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = Date.now() - 7 * 864e5;
  const sum = (list: MyDelivery[]) => list.reduce((s, d) => s + Number(d.delivery_fee), 0);
  const today = delivered.filter((d) => d.delivered_at && new Date(d.delivered_at) >= startOfDay);
  const week = delivered.filter((d) => d.delivered_at && new Date(d.delivered_at).getTime() >= weekAgo);
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Hoy', today],
          ['Últimos 7 días', week],
        ].map(([label, list]: any) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-semibold text-tinta-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-tinta-900">{formatPrice(sum(list))}</p>
            <p className="text-xs text-tinta-400">
              {list.length} entrega{list.length === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>
      <h2 className="heading text-xl">Tus entregas</h2>
      {past.length === 0 ? (
        <Empty icon={History} title="Aún no tienes entregas" />
      ) : (
        <ul className="space-y-2">
          {past.map((d) => (
            <li key={d.id} className="card flex items-center gap-3 p-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-tinta-900">{d.merchant?.name} → {d.customer_name}</p>
                <p className="text-xs text-tinta-400">
                  {d.code} · {timeAgo(d.delivered_at || d.cancelled_at || d.created_at)}
                </p>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_CLASS[d.status])}>{STATUS_SHORT[d.status]}</span>
              {d.status === 'delivered' && <span className="font-bold text-laguna-700">+{formatPrice(d.delivery_fee)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DriverProfile({
  sb,
  userId,
  driver,
  onSaved,
  onError,
}: {
  sb: any;
  userId: string;
  driver: Driver;
  onSaved: (d: Driver) => void;
  onError: (m: string) => void;
}) {
  const [phone, setPhone] = useState(driver.phone);
  const [vehicle, setVehicle] = useState<Vehicle>(driver.vehicle);
  const [plate, setPlate] = useState(driver.plate ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (patch: Partial<Driver>) => {
    const { data, error } = await sb.from('drivers').update(patch).eq('id', driver.id).select().single();
    if (error) throw error;
    onSaved(data as Driver);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone)) return onError('Escribe un teléfono válido.');
    setSaving(true);
    try {
      await save({ phone: normalizePhone(phone), vehicle, plate: plate.trim().toUpperCase() || null });
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="heading text-xl">Tu perfil</h2>
      <div className="card space-y-4 p-4">
        <Field label="Tu foto" hint="Ayuda a que el cliente y el comercio te reconozcan.">
          <PhotoPicker
            shape="round"
            value={driver.photo_url}
            onPick={async (f) => {
              try {
                const url = await uploadImage(sb, userId, f, 'perfil');
                const old = driver.photo_url;
                await save({ photo_url: url });
                await removeImage(sb, old);
              } catch (err) {
                onError(friendlyError(err));
              }
            }}
            onRemove={async () => {
              const old = driver.photo_url;
              await save({ photo_url: null });
              await removeImage(sb, old);
            }}
          />
        </Field>
        <Field label="Teléfono (WhatsApp)">
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Vehículo">
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(VEHICLE_LABEL) as Vehicle[]).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVehicle(v)}
                className={cn(
                  'rounded-2xl border py-2.5 text-xs font-semibold transition active:scale-95',
                  vehicle === v ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-white text-tinta-500'
                )}
              >
                {VEHICLE_LABEL[v]}
              </button>
            ))}
          </div>
        </Field>
        {(vehicle === 'moto' || vehicle === 'carro') && (
          <Field label="Placa">
            <input className="input uppercase" value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={12} />
          </Field>
        )}
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full py-3.5">
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar cambios
      </button>
    </form>
  );
}

/** Si la cuenta es de repartidor pero no completó sus datos */
function CompleteDriver({ sb, userId, onDone }: { sb: any; userId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>('moto');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) return setError('Escribe tu nombre completo.');
    if (!isValidPhone(phone)) return setError('Escribe un teléfono válido.');
    setSaving(true);
    const { error } = await sb.from('drivers').insert({ user_id: userId, full_name: name.trim(), phone: normalizePhone(phone), vehicle });
    setSaving(false);
    if (error) return setError(friendlyError(error));
    onDone();
  };
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="heading text-3xl">Completa tus datos</h1>
      <p className="mt-1 text-sm text-tinta-500">Solo falta esto para enviar tu solicitud de repartidor.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
        <Field label="Nombre completo">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Teléfono (WhatsApp)">
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0414-1234567" />
        </Field>
        <Field label="Vehículo">
          <select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value as Vehicle)}>
            {(Object.keys(VEHICLE_LABEL) as Vehicle[]).map((v) => (
              <option key={v} value={v}>
                {VEHICLE_LABEL[v]}
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">{error}</p>}
        <button className="btn-primary w-full" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : 'Enviar solicitud'}
        </button>
      </form>
    </main>
  );
}
