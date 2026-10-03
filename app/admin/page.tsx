'use client';
import OrdersBoard from '@/components/OrdersBoard';
import OrderProfile from '@/components/OrderProfile';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Store,
  Bike,
  ClipboardList,
  Settings,
  Search,
  Check,
  Ban,

  Star,
  Crown,
  ExternalLink,
  Loader2,
  Save,
  Phone,
  XCircle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { LegalReview } from '@/components/Verification';
import { missingItems, type LegalProfile } from '@/lib/legal';
import MerchantAvatar from '@/components/MerchantAvatar';
import { PanelHeader, PushCard } from '@/components/panel';
import { ApprovalPill, BottomNav, Empty, Field, FullLoader, Sheet, useToast } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { apiFetch, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { PLANS, daysLeft, effectivePlan } from '@/lib/plans';
import { STATUS_CLASS, STATUS_SHORT, VEHICLE_LABEL, timeAgo, waLink } from '@/lib/delivery';
import { isValidPhone, normalizePhone } from '@/lib/validate';
import { cn, formatPrice } from '@/lib/utils';
import type { AppSettings, ApprovalStatus, DeliveryRequest, Driver, Merchant, PlanId } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type OpenLegal = (v: { userId: string; kind: 'merchant' | 'delivery'; vehicle?: string | null; title: string }) => void;

/** Botón con el estado de la verificación (datos + documentos) */
function LegalButton({ missing, onClick }: { missing: string[] | null; onClick: () => void }) {
  const ok = missing !== null && missing.length === 0;
  return (
    <button
      onClick={onClick}
      className={cn('btn-ghost px-3 py-2 text-xs', ok ? 'text-laguna-700' : 'text-ocre-600')}
      title={ok ? 'Verificación completa' : missing ? `Falta: ${missing.join(', ')}` : 'Sin datos legales'}
    >
      {ok ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />} {ok ? 'Verificado' : missing ? `Faltan ${missing.length}` : 'Sin datos'}
    </button>
  );
}

const confirmApproval = (name: string, missing: string[] | null) => {
  if(missing && missing.length===0) return true;
  alert(`${name} no puede aprobarse todavía. Completa y revisa: ${missing?.join(', ') || 'datos legales y documentos'}.`);
  return false;
};

type Tab = 'resumen' | 'comercios' | 'repartidores' | 'pedidos' | 'ajustes';
type Order = DeliveryRequest & { merchant: { name: string } | null; driver: { full_name: string } | null };
const TABS: Tab[] = ['resumen', 'comercios', 'repartidores', 'pedidos', 'ajustes'];

function AdminInner() {
  const params = useSearchParams();
  const { loading, session, supabase: sb } = useAuth('admin');
  const { notify, toastNode } = useToast();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'resumen');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [legal, setLegal] = useState<Record<string, LegalProfile>>({});
  const [legalFor, setLegalFor] = useState<{ userId: string; kind: 'merchant' | 'delivery'; vehicle?: string | null; title: string } | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    const [m, d, o, s, l] = await Promise.all([
      sb.from('merchants').select('*').order('created_at', { ascending: false }),
      sb.from('drivers').select('*').order('created_at', { ascending: false }),
      sb
        .from('delivery_requests')
        .select('*, merchant:merchants(name), driver:drivers(full_name)')
        .order('created_at', { ascending: false })
        .limit(150),
      sb.from('app_settings').select('*').eq('id', 1).maybeSingle(),
      sb.from('legal_profiles').select('*'),
    ]);
    setLegal(Object.fromEntries(((l.data ?? []) as LegalProfile[]).map((r) => [r.user_id, r])));
    setMerchants((m.data ?? []) as Merchant[]);
    setDrivers((d.data ?? []) as Driver[]);
    setOrders((o.data ?? []) as Order[]);
    setSettings(s.data as AppSettings);
    setReady(true);
  }, [sb]);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !sb || !session || !ready) return <FullLoader />;

  const pendingM = merchants.filter((m) => m.status === 'pending').length;
  const pendingD = drivers.filter((d) => d.status === 'pending').length;

  const updateMerchant = async (id: string, patch: Partial<Merchant>, msg: string) => {
    const { data, error } = await sb.from('merchants').update(patch).eq('id', id).select().single();
    if (error) return notify(friendlyError(error), 'err');
    setMerchants((l) => l.map((x) => (x.id === id ? (data as Merchant) : x)));
    notify(msg);
  };
  const updateDriver = async (id: string, patch: Partial<Driver>, msg: string) => {
    const { data, error } = await sb.from('drivers').update(patch).eq('id', id).select().single();
    if (error) return notify(friendlyError(error), 'err');
    setDrivers((l) => l.map((x) => (x.id === id ? (data as Driver) : x)));
    notify(msg);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-32">
      <PanelHeader sb={sb} avatar={<LogoMark className="rounded-xl" />} title="Administración" subtitle="Lagunillas Central" />

      <div className="space-y-4 px-4 pt-4">
        {tab === 'resumen' && (
          <Overview sb={sb} userId={session.user.id} merchants={merchants} drivers={drivers} orders={orders} go={setTab} notify={notify} />
        )}
        {tab === 'comercios' && <MerchantsTab merchants={merchants} update={updateMerchant} legal={legal} openLegal={setLegalFor} />}
        {tab === 'repartidores' && <DriversTab drivers={drivers} orders={orders} update={updateDriver} legal={legal} openLegal={setLegalFor} />}
        {tab === 'pedidos' && <><OrdersBoard sb={sb} role="admin" /><details><summary>Pedidos anteriores</summary><OrdersTab sb={sb} orders={orders} reload={load} notify={notify} /></details></>}
        {tab === 'ajustes' && <OrderProfile sb={sb} role="admin" />}
        {tab === 'ajustes' && settings && (
          <SettingsTab
            settings={settings}
            onSave={async (patch) => {
              const { data, error } = await sb.from('app_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1).select().single();
              if (error) return notify(friendlyError(error), 'err');
              setSettings(data as AppSettings);
              notify('Ajustes guardados');
            }}
          />
        )}
      </div>

      <BottomNav
        items={[
          ['resumen', 'Resumen', LayoutDashboard],
          ['comercios', 'Comercios', Store],
          ['repartidores', 'Repartid.', Bike],
          ['pedidos', 'Pedidos', ClipboardList],
          ['ajustes', 'Ajustes', Settings],
        ] as const}
        active={tab}
        onChange={setTab}
        badges={{ comercios: pendingM || undefined, repartidores: pendingD || undefined }}
      />
      {legalFor && (
        <Sheet title={legalFor.title} onClose={() => setLegalFor(null)}>
          <LegalReview
            sb={sb}
            userId={legalFor.userId}
            kind={legalFor.kind}
            vehicle={legalFor.vehicle}
            row={legal[legalFor.userId] ?? null}
            notify={notify}
            onChanged={(r) => setLegal((x) => ({ ...x, [r.user_id]: r }))}
          />
        </Sheet>
      )}
      {toastNode}
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <AdminInner />
    </Suspense>
  );
}

/* ================================================================ */

function Overview({
  sb,
  userId,
  merchants,
  drivers,
  orders,
  go,
  notify,
}: {
  sb: SupabaseClient;
  userId: string;
  merchants: Merchant[];
  drivers: Driver[];
  orders: Order[];
  go: (t: Tab) => void;
  notify: (m: string, k?: 'ok' | 'err') => void;
}) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = orders.filter((o) => new Date(o.created_at) >= start);
  const stats = [
    { label: 'Comercios activos', value: merchants.filter((m) => m.status === 'approved').length, tab: 'comercios' as Tab },
    { label: 'Por aprobar', value: merchants.filter((m) => m.status === 'pending').length + drivers.filter((d) => d.status === 'pending').length, tab: 'comercios' as Tab, hot: true },
    { label: 'Repartidores en línea', value: drivers.filter((d) => d.is_online).length, tab: 'repartidores' as Tab },
    { label: 'Pedidos hoy', value: today.length, tab: 'pedidos' as Tab },
    { label: 'Entregados hoy', value: today.filter((o) => o.status === 'delivered').length, tab: 'pedidos' as Tab },
    { label: 'Buscando repartidor', value: orders.filter((o) => o.status === 'searching').length, tab: 'pedidos' as Tab, hot: true },
  ];
  const paid = merchants.filter((m) => effectivePlan(m) !== 'gratis');
  const expiring = paid.filter((m) => (daysLeft(m.plan_expires_at) ?? 99) <= 5);

  return (
    <>
      <h1 className="heading text-3xl">Hola 👋</h1>
      <PushCard sb={sb} userId={userId} compact text="Te avisaremos cuando un comercio o repartidor nuevo se registre." onError={(m) => notify(m, 'err')} />
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <button key={s.label} onClick={() => go(s.tab)} className="card p-3.5 text-left transition active:scale-[0.98]">
            <p className={cn('text-3xl font-extrabold tabular-nums', s.hot && s.value > 0 ? 'text-teja-500' : 'text-tinta-900')}>{s.value}</p>
            <p className="text-xs font-medium text-tinta-500">{s.label}</p>
          </button>
        ))}
      </div>
      <div className="card p-4">
        <p className="text-sm font-bold text-tinta-900">Membresías</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {(['gratis', 'pro', 'premium'] as PlanId[]).map((p) => (
            <div key={p} className="rounded-2xl bg-cal-100 p-2">
              <p className="text-xl font-extrabold text-tinta-900">{merchants.filter((m) => m.status === 'approved' && effectivePlan(m) === p).length}</p>
              <p className="text-[11px] text-tinta-500">{PLANS[p].name}</p>
            </div>
          ))}
        </div>
        {expiring.length > 0 && (
          <p className="mt-3 rounded-2xl bg-ocre-100 p-3 text-xs text-ocre-600">
            Vencen pronto: {expiring.map((m) => m.name).join(', ')}
          </p>
        )}
      </div>
    </>
  );
}

/* ---------------- Comercios ---------------- */
function MerchantsTab({
  merchants,
  update,
  legal,
  openLegal,
}: {
  merchants: Merchant[];
  update: (id: string, p: Partial<Merchant>, msg: string) => Promise<void>;
  legal: Record<string, LegalProfile>;
  openLegal: OpenLegal;
}) {
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>(merchants.some((m) => m.status === 'pending') ? 'pending' : 'approved');
  const [q, setQ] = useState('');
  const [planFor, setPlanFor] = useState<Merchant | null>(null);
  const list = merchants.filter(
    (m) => (filter === 'all' || m.status === filter) && (!q || `${m.name} ${m.category} ${m.whatsapp_number}`.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <section className="space-y-3">
      <h2 className="heading text-2xl">Comercios</h2>
      <FilterBar
        value={filter}
        onChange={setFilter}
        counts={{
          pending: merchants.filter((m) => m.status === 'pending').length,
          approved: merchants.filter((m) => m.status === 'approved').length,
          suspended: merchants.filter((m) => m.status === 'suspended').length,
          all: merchants.length,
        }}
      />
      <SearchBox value={q} onChange={setQ} placeholder="Buscar comercio…" />
      {list.length === 0 ? (
        <Empty icon={Store} title="No hay comercios aquí" />
      ) : (
        list.map((m) => {
          const plan = effectivePlan(m);
          const left = daysLeft(m.plan_expires_at);
          const missing = m.user_id && legal[m.user_id] ? missingItems('merchant', legal[m.user_id]) : null;
          return (
            <div key={m.id} className="card p-4">
              <div className="flex items-start gap-3">
                <MerchantAvatar name={m.name} category={m.category} logoUrl={m.logo_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-tinta-900">
                    {m.name} {m.is_featured && <Star size={13} className="inline fill-ocre-400 text-ocre-400" />}
                  </p>
                  <p className="text-xs text-tinta-500">
                    {m.category} · registrado {timeAgo(m.created_at)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ApprovalPill status={m.status} />
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', plan === 'gratis' ? 'bg-cal-200 text-tinta-500' : 'bg-ocre-100 text-ocre-600')}>
                      {PLANS[plan].name}
                      {plan !== 'gratis' && left !== null ? ` · ${left} d` : ''}
                    </span>
                    {!m.is_active && <span className="rounded-full bg-cal-200 px-2 py-0.5 text-[11px] font-semibold text-tinta-500">Oculto por el dueño</span>}
                  </div>
                  {m.address && <p className="mt-1.5 text-xs text-tinta-500">{m.address}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {m.status !== 'approved' && (
                  <button onClick={() => confirmApproval(m.name, missing) && update(m.id, { status: 'approved' }, `${m.name} aprobado`)} className="btn-primary flex-1 px-3 py-2 text-xs">
                    <Check size={14} /> {m.status === 'pending' ? 'Aprobar' : 'Reactivar'}
                  </button>
                )}
                {m.status === 'approved' && (
                  <button onClick={() => confirm(`¿Suspender ${m.name}? Dejará de verse en la app.`) && update(m.id, { status: 'suspended' }, `${m.name} suspendido`)} className="btn-ghost px-3 py-2 text-xs text-teja-500">
                    <Ban size={14} /> Suspender
                  </button>
                )}
                {m.user_id && <LegalButton missing={missing} onClick={() => openLegal({ userId: m.user_id!, kind: 'merchant', title: m.name })} />}
                <button onClick={() => setPlanFor(m)} className="btn-ghost px-3 py-2 text-xs">
                  <Crown size={14} /> Plan
                </button>
                <button onClick={() => update(m.id, { is_featured: !m.is_featured }, m.is_featured ? 'Quitado de destacados' : 'Marcado como destacado')} className="btn-ghost px-3 py-2 text-xs">
                  <Star size={14} /> {m.is_featured ? 'Quitar' : 'Destacar'}
                </button>
                <a href={waLink(m.whatsapp_number)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-2 text-xs">
                  <Phone size={14} />
                </a>
                {m.status === 'approved' && (
                  <Link href={`/comercio/${m.slug}`} target="_blank" className="btn-ghost px-3 py-2 text-xs">
                    <ExternalLink size={14} />
                  </Link>
                )}
              </div>
            </div>
          );
        })
      )}
      {planFor && (
        <PlanSheet
          merchant={planFor}
          onClose={() => setPlanFor(null)}
          onSave={async (plan, expires) => {
            await update(planFor.id, { plan, plan_expires_at: expires }, `Plan ${PLANS[plan].name} asignado a ${planFor.name}`);
            setPlanFor(null);
          }}
        />
      )}
    </section>
  );
}

function PlanSheet({ merchant, onClose, onSave }: { merchant: Merchant; onClose: () => void; onSave: (p: PlanId, expires: string | null) => Promise<void> }) {
  const [plan, setPlan] = useState<PlanId>(merchant.plan);
  const [months, setMonths] = useState(1);
  const [saving, setSaving] = useState(false);
  // Si el plan sigue vigente, se suma desde su vencimiento; si no, desde hoy
  const base = merchant.plan === plan && merchant.plan_expires_at && new Date(merchant.plan_expires_at) > new Date() ? new Date(merchant.plan_expires_at) : new Date();
  const until = new Date(base);
  until.setMonth(until.getMonth() + months);
  return (
    <Sheet title={`Plan de ${merchant.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['gratis', 'pro', 'premium'] as PlanId[]).map((p) => (
            <button key={p} onClick={() => setPlan(p)} className={cn('rounded-2xl border py-3 text-sm font-bold transition', plan === p ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-white text-tinta-500')}>
              {PLANS[p].name}
            </button>
          ))}
        </div>
        {plan !== 'gratis' && (
          <Field label="Duración (pago recibido)">
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((n) => (
                <button key={n} onClick={() => setMonths(n)} className={cn('rounded-xl border py-2 text-xs font-semibold', months === n ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-white text-tinta-600')}>
                  {n} {n === 1 ? 'mes' : 'meses'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-tinta-600">
              Vence el <b>{until.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
            </p>
          </Field>
        )}
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(plan, plan === 'gratis' ? null : until.toISOString());
            setSaving(false);
          }}
          className="btn-primary w-full py-3.5"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Guardar plan
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- Repartidores ---------------- */
function DriversTab({
  drivers,
  orders,
  update,
  legal,
  openLegal,
}: {
  drivers: Driver[];
  orders: Order[];
  update: (id: string, p: Partial<Driver>, msg: string) => Promise<void>;
  legal: Record<string, LegalProfile>;
  openLegal: OpenLegal;
}) {
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>(drivers.some((d) => d.status === 'pending') ? 'pending' : 'approved');
  const [q, setQ] = useState('');
  const delivered = useMemo(() => {
    const c: Record<string, number> = {};
    orders.forEach((o) => o.status === 'delivered' && o.driver_id && (c[o.driver_id] = (c[o.driver_id] ?? 0) + 1));
    return c;
  }, [orders]);
  const list = drivers.filter((d) => (filter === 'all' || d.status === filter) && (!q || `${d.full_name} ${d.phone} ${d.plate ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <section className="space-y-3">
      <h2 className="heading text-2xl">Repartidores</h2>
      <FilterBar
        value={filter}
        onChange={setFilter}
        counts={{
          pending: drivers.filter((d) => d.status === 'pending').length,
          approved: drivers.filter((d) => d.status === 'approved').length,
          suspended: drivers.filter((d) => d.status === 'suspended').length,
          all: drivers.length,
        }}
      />
      <SearchBox value={q} onChange={setQ} placeholder="Buscar repartidor…" />
      {list.length === 0 ? (
        <Empty icon={Bike} title="No hay repartidores aquí" />
      ) : (
        list.map((d) => {
          const missing = legal[d.user_id] ? missingItems('delivery', legal[d.user_id], d.vehicle) : null;
          return (
          <div key={d.id} className="card p-4">
            <div className="flex items-center gap-3">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-laguna-100 text-2xl">🛵</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-bold text-tinta-900">
                  {d.full_name}
                  {d.is_online && <span className="h-2 w-2 rounded-full bg-laguna-500" title="En línea" />}
                </p>
                <p className="text-xs text-tinta-500">
                  {VEHICLE_LABEL[d.vehicle]}
                  {d.plate ? ` · ${d.plate}` : ''} · {delivered[d.id] ?? 0} entregas
                </p>
                <div className="mt-1">
                  <ApprovalPill status={d.status} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {d.status !== 'approved' ? (
                <button onClick={() => confirmApproval(d.full_name, missing) && update(d.id, { status: 'approved' }, `${d.full_name} aprobado`)} className="btn-primary flex-1 px-3 py-2 text-xs">
                  <Check size={14} /> {d.status === 'pending' ? 'Aprobar' : 'Reactivar'}
                </button>
              ) : (
                <button onClick={() => confirm(`¿Suspender a ${d.full_name}?`) && update(d.id, { status: 'suspended' }, `${d.full_name} suspendido`)} className="btn-ghost flex-1 px-3 py-2 text-xs text-teja-500">
                  <Ban size={14} /> Suspender
                </button>
              )}
              <LegalButton missing={missing} onClick={() => openLegal({ userId: d.user_id, kind: 'delivery', vehicle: d.vehicle, title: d.full_name })} />
              <a href={waLink(d.phone)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-2 text-xs">
                <Phone size={14} />
              </a>
            </div>
          </div>
          );
        })
      )}
    </section>
  );
}

/* ---------------- Pedidos ---------------- */
function OrdersTab({ sb, orders, reload, notify }: { sb: SupabaseClient; orders: Order[]; reload: () => void; notify: (m: string, k?: 'ok' | 'err') => void }) {
  const [filter, setFilter] = useState<'activos' | 'todos'>('activos');
  const list = orders.filter((o) => filter === 'todos' || ['searching', 'accepted', 'picked_up'].includes(o.status));
  const cancel = async (o: Order) => {
    if (!confirm(`¿Cancelar el pedido ${o.code}?`)) return;
    try {
      await apiFetch(sb, `/api/deliveries/${o.id}/action`, { action: 'cancel', reason: 'Cancelado por la administración' });
      notify('Pedido cancelado');
    } catch (e: any) {
      notify(e.message, 'err');
    }
    reload();
  };
  return (
    <section className="space-y-3">
      <h2 className="heading text-2xl">Pedidos con delivery</h2>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-cal-200 p-1">
        {(['activos', 'todos'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('rounded-xl py-2 text-sm font-semibold capitalize', filter === f ? 'bg-white text-tinta-900 shadow-soft' : 'text-tinta-500')}>
            {f}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon={ClipboardList} title={filter === 'activos' ? 'No hay pedidos en curso' : 'Aún no hay pedidos'} />
      ) : (
        list.map((o) => (
          <div key={o.id} className="card p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_CLASS[o.status])}>{STATUS_SHORT[o.status]}</span>
              <span className="text-xs text-tinta-400">
                <b className="font-mono text-tinta-600">{o.code}</b> · {timeAgo(o.created_at)}
              </span>
            </div>
            <p className="mt-2 font-bold text-tinta-900">
              {o.merchant?.name} → {o.customer_name}
            </p>
            <p className="text-xs text-tinta-500">{o.address}</p>
            <p className="mt-1 text-xs text-tinta-500">
              {o.driver ? `Repartidor: ${o.driver.full_name}` : 'Sin repartidor'} · {formatPrice(o.subtotal)} + {formatPrice(o.delivery_fee)}
            </p>
            {o.cancel_reason && <p className="mt-1 text-xs text-tinta-400">{o.cancel_reason}</p>}
            <div className="mt-2 flex gap-3">
              <a href={waLink(o.customer_phone)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-laguna-600">
                Escribir al cliente
              </a>
              {(o.status === 'searching' || o.status === 'accepted') && (
                <button onClick={() => cancel(o)} className="flex items-center gap-1 text-xs font-semibold text-teja-500">
                  <XCircle size={13} /> Cancelar
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/* ---------------- Ajustes ---------------- */
function SettingsTab({ settings, onSave }: { settings: AppSettings; onSave: (p: Partial<AppSettings>) => Promise<void> }) {
  const [fee, setFee] = useState(String(settings.delivery_fee));
  const [wa, setWa] = useState(settings.admin_whatsapp ?? '');
  const [pro, setPro] = useState(String(settings.price_pro));
  const [premium, setPremium] = useState(String(settings.price_premium));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (s: string) => Number(s.replace(',', '.'));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!(num(fee) >= 0) || !(num(pro) >= 0) || !(num(premium) >= 0)) return setError('Revisa los montos.');
    if (wa && !isValidPhone(wa)) return setError('Escribe un WhatsApp válido.');
    setSaving(true);
    await onSave({ delivery_fee: num(fee), admin_whatsapp: wa ? normalizePhone(wa) : null, price_pro: num(pro), price_premium: num(premium) });
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="heading text-2xl">Ajustes</h2>
      <div className="card space-y-4 p-4">
        <Field label="Precio del delivery (USD)" hint="Lo que paga el cliente y gana el repartidor por cada entrega.">
          <input className="input" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
        <Field label="Tu WhatsApp para cobrar membresías" hint="Los comercios te escribirán aquí para activar su plan.">
          <input className="input" inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="0414-1234567" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan Pro (USD/mes)">
            <input className="input" inputMode="decimal" value={pro} onChange={(e) => setPro(e.target.value)} />
          </Field>
          <Field label="Plan Premium (USD/mes)">
            <input className="input" inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} />
          </Field>
        </div>
      </div>
      {error && <p className="rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary w-full py-3.5">
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar ajustes
      </button>
      <p className="text-center text-xs text-tinta-400">
        Los límites de cada plan (productos, ofertas, portada) están en la base de datos. Pídelos cambiar si los necesitas distintos.
      </p>
    </form>
  );
}

/* ---------------- Piezas ---------------- */
function FilterBar<T extends string>({ value, onChange, counts }: { value: T; onChange: (v: T) => void; counts: Record<string, number> }) {
  const items: [string, string][] = [
    ['pending', 'Por aprobar'],
    ['approved', 'Activos'],
    ['suspended', 'Suspendidos'],
    ['all', 'Todos'],
  ];
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {items.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k as T)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition',
            value === k ? 'border-transparent bg-laguna-600 text-white' : 'border-cal-300 bg-cal-50 text-tinta-600'
          )}
        >
          {label}
          <span className={cn('text-[11px] font-bold', value === k ? 'text-white/70' : k === 'pending' && counts[k] ? 'text-teja-500' : 'text-tinta-400')}>{counts[k]}</span>
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-400" />
      <input className="input h-11 pl-10 text-sm" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

