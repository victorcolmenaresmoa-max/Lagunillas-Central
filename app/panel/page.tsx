'use client';

import OrdersBoard from '@/components/OrdersBoard';
import OrderProfile from '@/components/OrderProfile';
import { VerificationCard } from '@/components/Verification';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Store,
  Package,
  Zap,
  Crown,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  Flame,
  Clock,
  Save,
  Lock,
  Phone,
  Bike,
  XCircle,
} from 'lucide-react';
import MerchantAvatar from '@/components/MerchantAvatar';
import { PanelHeader, PushCard, StatusBanner } from '@/components/panel';
import { ApprovalPill, BottomNav, Empty, Field, FullLoader, PhotoPicker, Sheet, Toggle, useToast } from '@/components/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { PLANS, daysLeft, effectivePlan } from '@/lib/plans';
import { removeImage, uploadImage } from '@/lib/upload';
import { STATUS_CLASS, STATUS_SHORT, VEHICLE_LABEL, timeAgo, waLink } from '@/lib/delivery';
import { isValidPhone, normalizePhone } from '@/lib/validate';
import { useCountdown, pad2 } from '@/lib/useCountdown';
import { cn, formatPrice } from '@/lib/utils';
import { CATEGORIES, type AppSettings, type Category, type DeliveryRequest, type Driver, type FlashDeal, type Merchant, type PlanId, type Product } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type Tab = 'pedidos' | 'productos' | 'ofertas' | 'perfil' | 'plan';
type Order = DeliveryRequest & { driver: Pick<Driver, 'full_name' | 'phone' | 'vehicle' | 'plate'> | null };

function PanelInner() {
  const params = useSearchParams();
  const { loading, session, supabase: sb } = useAuth('merchant');
  const { notify, toastNode } = useToast();
  const [merchant, setMerchant] = useState<Merchant | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const initialTab = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initialTab && ['pedidos', 'productos', 'ofertas', 'perfil', 'plan'].includes(initialTab) ? initialTab : 'pedidos');
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!sb || !userId) return;
    const { data: m } = await sb.from('merchants').select('*').eq('user_id', userId).order('created_at').limit(1).maybeSingle();
    setMerchant((m as Merchant) ?? null);
    const { data: s } = await sb.from('app_settings').select('*').eq('id', 1).maybeSingle();
    setSettings(s as AppSettings);
    if (!m) return;
    const [p, d] = await Promise.all([
      sb.from('products').select('*').eq('merchant_id', m.id).order('created_at'),
      sb.from('flash_deals').select('*').eq('merchant_id', m.id).order('created_at', { ascending: false }).limit(30),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setDeals((d.data ?? []) as FlashDeal[]);
  }, [sb, userId]);

  const loadOrders = useCallback(async () => {
    if (!sb || !merchant) return;
    const { data } = await sb
      .from('delivery_requests')
      .select('*, driver:drivers(full_name, phone, vehicle, plate)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setOrders((data ?? []) as Order[]);
  }, [sb, merchant]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadOrders();
    const t = setInterval(() => document.visibilityState === 'visible' && loadOrders(), 15000);
    const onMsg = (e: MessageEvent) => e.data?.type === 'push' && loadOrders();
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => {
      clearInterval(t);
      navigator.serviceWorker?.removeEventListener('message', onMsg);
    };
  }, [loadOrders]);

  // Aviso a la administración de un registro nuevo (una sola vez)
  useEffect(() => {
    if (!merchant || merchant.status !== 'pending' || !sb) return;
    const key = `lc-aviso-${merchant.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    apiFetch(sb, '/api/aviso-registro', {}).catch(() => {});
  }, [merchant, sb]);

  if (loading || merchant === undefined || !sb || !session) return <FullLoader />;

  if (merchant === null) {
    return (
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-6">
        <ProfileTab
          sb={sb}
          userId={session.user.id}
          merchant={null}
          onSaved={(m) => {
            setMerchant(m);
            notify('¡Comercio creado! Lo revisaremos pronto.');
          }}
          onError={(m) => notify(m, 'err')}
        />
        {toastNode}
      </main>
    );
  }

  const planId = effectivePlan(merchant);
  const plan = PLANS[planId];
  const activeOrders = orders.filter((o) => ['searching', 'accepted', 'picked_up'].includes(o.status));
  const run = async <T,>(fn: () => PromiseLike<{ data: T | null; error: any }>, ok?: string): Promise<T | null> => {
    const { data, error } = await fn();
    if (error) {
      notify(friendlyError(error), 'err');
      return null;
    }
    if (ok) notify(ok);
    return data;
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-32">
      <PanelHeader
        sb={sb}
        avatar={<MerchantAvatar name={merchant.name} category={merchant.category} logoUrl={merchant.logo_url} size="sm" />}
        title={merchant.name}
        subtitle={
          <span className="flex items-center gap-1.5">
            <ApprovalPill status={merchant.status} /> Plan {plan.name}
          </span>
        }
        link={merchant.status === 'approved' ? `/comercio/${merchant.slug}` : undefined}
      />

      <div className="space-y-4 px-4 pt-4">
        <StatusBanner status={merchant.status} kind="comercio" />

        {tab === 'pedidos' && (
          <VerificationCard sb={sb} userId={session.user.id} kind="merchant" approved={merchant.status === 'approved'} notify={notify} hideWhenComplete />
        )}

        {tab === 'pedidos' && (
          <>
          <OrdersBoard sb={sb} role="merchant" />
          <details><summary>Pedidos anteriores por WhatsApp</summary>
          <OrdersTab
            sb={sb}
            userId={session.user.id}
            orders={orders}
            onChanged={loadOrders}
            notify={notify}
          /></details></>
        )}

        {tab === 'productos' && (
          <ProductsTab
            sb={sb}
            userId={session.user.id}
            merchant={merchant}
            products={products}
            maxProducts={plan.maxProducts}
            onAdd={async (input) => {
              const p = await run(() => sb.from('products').insert({ ...input, merchant_id: merchant.id }).select().single(), 'Producto agregado');
              if (p) setProducts((l) => [...l, p as Product]);
              return Boolean(p);
            }}
            onUpdate={async (id, input, msg) => {
              const p = await run(() => sb.from('products').update(input).eq('id', id).select().single(), msg);
              if (p) setProducts((l) => l.map((x) => (x.id === id ? (p as Product) : x)));
              return Boolean(p);
            }}
            onDelete={async (prod) => {
              const { error } = await sb.from('products').delete().eq('id', prod.id);
              if (error) return notify(friendlyError(error), 'err');
              await removeImage(sb, prod.image_url);
              setProducts((l) => l.filter((x) => x.id !== prod.id));
              setDeals((l) => l.filter((d) => d.product_id !== prod.id));
              notify('Producto eliminado');
            }}
            onError={(m) => notify(m, 'err')}
            onUpgrade={() => setTab('plan')}
          />
        )}

        {tab === 'ofertas' && (
          <DealsTab
            products={products}
            deals={deals}
            maxDeals={plan.maxDeals}
            onUpgrade={() => setTab('plan')}
            onPublish={async (productId, price, expiresAt) => {
              const d = await run(
                () => sb.from('flash_deals').insert({ merchant_id: merchant.id, product_id: productId, discount_price: price, expires_at: expiresAt }).select().single(),
                '¡Oferta publicada! 🔥'
              );
              if (d) setDeals((l) => [d as FlashDeal, ...l]);
              return Boolean(d);
            }}
            onEnd={async (id) => {
              const d = await run(() => sb.from('flash_deals').update({ is_active: false }).eq('id', id).select().single(), 'Oferta finalizada');
              if (d) setDeals((l) => l.map((x) => (x.id === id ? (d as FlashDeal) : x)));
            }}
          />
        )}

        {tab === 'perfil' && (
          <ProfileTab
            sb={sb}
            userId={session.user.id}
            merchant={merchant}
            canCover={plan.cover}
            onSaved={(m) => {
              setMerchant(m);
              notify('Perfil actualizado');
            }}
            onError={(m) => notify(m, 'err')}
            onUpgrade={() => setTab('plan')}
          />
        )}

        {tab === 'perfil' && <OrderProfile sb={sb} role="merchant" />}
        {tab === 'perfil' && <VerificationCard sb={sb} userId={session.user.id} kind="merchant" approved={merchant.status === 'approved'} notify={notify} />}

        {tab === 'plan' && <PlanTab merchant={merchant} settings={settings} productsCount={products.length} />}
      </div>

      <BottomNav
        items={[
          ['pedidos', 'Pedidos', ClipboardList],
          ['productos', 'Productos', Package],
          ['ofertas', 'Ofertas', Zap],
          ['perfil', 'Perfil', Store],
          ['plan', 'Plan', Crown],
        ] as const}
        active={tab}
        onChange={setTab}
        badges={{ pedidos: activeOrders.length || undefined }}
      />
      {toastNode}
    </main>
  );
}

export default function PanelPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <PanelInner />
    </Suspense>
  );
}

/* ================================================================
   Pedidos con delivery
   ================================================================ */
function OrdersTab({
  sb,
  userId,
  orders,
  onChanged,
  notify,
}: {
  sb: SupabaseClient;
  userId: string;
  orders: Order[];
  onChanged: () => void;
  notify: (m: string, k?: 'ok' | 'err') => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const active = orders.filter((o) => ['searching', 'accepted', 'picked_up'].includes(o.status));
  const done = orders.filter((o) => !active.includes(o));

  const cancel = async (o: Order) => {
    if (!confirm(`¿Cancelar el pedido ${o.code}?`)) return;
    setBusy(o.id);
    try {
      await apiFetch(sb, `/api/deliveries/${o.id}/action`, { action: 'cancel', reason: 'Cancelado por el comercio' });
      notify('Pedido cancelado');
    } catch (e: any) {
      notify(e.message, 'err');
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  return (
    <section className="space-y-4">
      <PushCard sb={sb} userId={userId} text="Te avisaremos cuando llegue un pedido con delivery y cuando el repartidor vaya en camino." onError={(m) => notify(m, 'err')} />
      <div>
        <h2 className="heading text-2xl">Pedidos con delivery</h2>
        <p className="text-sm text-tinta-500">Los que pidieron repartidor desde la app. Los demás te llegan solo por WhatsApp.</p>
      </div>

      {active.length === 0 && done.length === 0 && (
        <Empty icon={ClipboardList} title="Aún no hay pedidos con delivery" text="Cuando un cliente pida repartidor desde tu página, aparecerá aquí." />
      )}

      {active.map((o) => (
        <div key={o.id} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-cal-200 px-4 py-2.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_CLASS[o.status])}>{STATUS_SHORT[o.status]}</span>
            <span className="text-xs text-tinta-400">
              <b className="font-mono text-tinta-600">{o.code}</b> · {timeAgo(o.created_at)}
            </span>
          </div>
          <div className="space-y-2 p-4 text-sm">
            <p className="font-bold text-tinta-900">{o.customer_name}</p>
            <p className="text-tinta-500">{o.address}</p>
            <ul className="text-tinta-700">
              {o.items.map((i) => (
                <li key={i.product_id}>
                  {i.qty}× {i.title} <span className="text-tinta-400">({formatPrice(i.qty * i.price)})</span>
                </li>
              ))}
            </ul>
            {o.notes && <p className="rounded-xl bg-ocre-100 px-2 py-1 text-xs text-ocre-600">Nota: {o.notes}</p>}
            <p className="font-semibold text-tinta-900">Productos: {formatPrice(o.subtotal)}</p>

            {o.driver ? (
              <div className="flex items-center gap-3 rounded-2xl bg-cielo-100 p-3">
                <Bike size={18} className="text-cielo-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta-900">{o.driver.full_name}</p>
                  <p className="text-xs text-tinta-500">
                    {VEHICLE_LABEL[o.driver.vehicle]}
                    {o.driver.plate ? ` · ${o.driver.plate}` : ''}
                  </p>
                </div>
                <a href={waLink(o.driver.phone, `Hola ${o.driver.full_name}, sobre el pedido ${o.code}…`)} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-tinta-700" aria-label="Escribir al repartidor">
                  <Phone size={16} />
                </a>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl bg-ocre-100 p-3 text-xs font-semibold text-ocre-600">
                <Loader2 size={14} className="animate-spin" /> Buscando repartidor…
              </p>
            )}
            {(o.status === 'searching' || o.status === 'accepted') && (
              <button onClick={() => cancel(o)} disabled={busy === o.id} className="flex items-center gap-1 text-xs font-semibold text-teja-500">
                <XCircle size={14} /> Cancelar pedido
              </button>
            )}
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-tinta-400">Anteriores</h3>
          <ul className="space-y-2">
            {done.map((o) => (
              <li key={o.id} className="card flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta-900">{o.customer_name}</p>
                  <p className="text-xs text-tinta-400">
                    {o.code} · {timeAgo(o.created_at)}
                    {o.driver ? ` · ${o.driver.full_name}` : ''}
                  </p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_CLASS[o.status])}>{STATUS_SHORT[o.status]}</span>
                <span className="font-bold tabular-nums text-tinta-700">{formatPrice(o.subtotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ================================================================
   Productos
   ================================================================ */
type ProductInput = Pick<Product, 'title' | 'description' | 'price' | 'image_url' | 'is_available'>;

function ProductsTab({
  sb,
  userId,
  products,
  maxProducts,
  onAdd,
  onUpdate,
  onDelete,
  onError,
  onUpgrade,
}: {
  sb: SupabaseClient;
  userId: string;
  merchant: Merchant;
  products: Product[];
  maxProducts: number;
  onAdd: (i: ProductInput) => Promise<boolean>;
  onUpdate: (id: string, i: Partial<ProductInput>, msg?: string) => Promise<boolean>;
  onDelete: (p: Product) => Promise<void>;
  onError: (m: string) => void;
  onUpgrade: () => void;
}) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const full = products.length >= maxProducts;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="heading text-2xl">Productos</h2>
          <p className="text-sm text-tinta-500">
            {products.length} de {maxProducts >= 1000 ? '∞' : maxProducts} · toca el interruptor para marcar agotado
          </p>
        </div>
        <button onClick={() => (full ? onUpgrade() : setEditing('new'))} className="btn-primary px-4 py-2.5 text-sm">
          {full ? <Lock size={16} /> : <Plus size={17} strokeWidth={2.6} />} Nuevo
        </button>
      </div>

      {full && (
        <button onClick={onUpgrade} className="mb-3 w-full rounded-2xl bg-ocre-100 p-3 text-left text-sm text-ocre-600 ring-1 ring-ocre-400/40">
          Llegaste al límite de tu plan. <b>Mejora tu plan</b> para agregar más productos.
        </button>
      )}

      {products.length === 0 ? (
        <Empty icon={Package} title="Aún no tienes productos" text="Agrega el primero con su foto para que los clientes puedan pedir." />
      ) : (
        <ul className="space-y-2.5">
          {products.map((p) => (
            <li key={p.id} className={cn('card p-3 transition', !p.is_available && 'opacity-60')}>
              <div className="flex items-center gap-3">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cal-200 text-lg font-black text-tinta-500">{p.title.charAt(0)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-tinta-900">{p.title}</p>
                  <p className="text-sm font-extrabold text-laguna-600">{formatPrice(p.price)}</p>
                </div>
                <Toggle
                  on={p.is_available}
                  label="Disponible"
                  onChange={(v) => onUpdate(p.id, { is_available: v }, v ? 'Marcado como disponible' : 'Marcado como agotado')}
                />
              </div>
              {confirmDel === p.id ? (
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-teja-100 p-2 pl-3">
                  <p className="flex-1 text-xs font-semibold text-teja-600">¿Eliminar este producto?</p>
                  <button onClick={() => setConfirmDel(null)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-tinta-600">No</button>
                  <button onClick={async () => { await onDelete(p); setConfirmDel(null); }} className="rounded-xl bg-teja-500 px-3 py-1.5 text-xs font-bold text-white">
                    Sí, eliminar
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditing(p)} className="btn-ghost flex-1 py-2 text-xs">
                    <Pencil size={14} /> Editar
                  </button>
                  <button onClick={() => setConfirmDel(p.id)} className="btn-ghost py-2 text-xs text-teja-500">
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductSheet
          sb={sb}
          userId={userId}
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onError={onError}
          onSave={async (input) => {
            const ok = editing === 'new' ? await onAdd(input) : await onUpdate(editing.id, input, 'Producto actualizado');
            if (ok) {
              if (editing !== 'new' && editing.image_url && editing.image_url !== input.image_url) await removeImage(sb, editing.image_url);
              setEditing(null);
            }
            return ok;
          }}
        />
      )}
    </section>
  );
}

function ProductSheet({
  sb,
  userId,
  product,
  onClose,
  onSave,
  onError,
}: {
  sb: SupabaseClient;
  userId: string;
  product: Product | null;
  onClose: () => void;
  onSave: (i: ProductInput) => Promise<boolean>;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState(product?.title ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [available, setAvailable] = useState(product?.is_available ?? true);
  const [saving, setSaving] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);

  const close = async () => {
    // Borra fotos subidas en esta ventana que no se guardaron
    for (const u of uploaded) if (u !== product?.image_url) await removeImage(sb, u);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(price.replace(',', '.'));
    if (!title.trim()) return onError('Escribe el nombre del producto.');
    if (Number.isNaN(n) || n < 0) return onError('Escribe un precio válido.');
    setSaving(true);
    const ok = await onSave({ title: title.trim(), description: description.trim() || null, price: Math.round(n * 100) / 100, image_url: imageUrl, is_available: available });
    setSaving(false);
    if (ok) for (const u of uploaded) if (u !== imageUrl) await removeImage(sb, u);
  };

  return (
    <Sheet title={product ? 'Editar producto' : 'Nuevo producto'} onClose={close}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Foto">
          <PhotoPicker
            value={imageUrl}
            label="Subir foto"
            onPick={async (f) => {
              try {
                const url = await uploadImage(sb, userId, f, 'producto');
                setUploaded((l) => [...l, url]);
                setImageUrl(url);
              } catch (err) {
                onError(friendlyError(err));
              }
            }}
            onRemove={() => setImageUrl(null)}
          />
        </Field>
        <Field label="Nombre">
          <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Hamburguesa clásica" maxLength={80} />
        </Field>
        <Field label="Precio (USD)">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-tinta-400">$</span>
            <input className="input pl-8" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
        </Field>
        <Field label="Descripción (opcional)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ingredientes, tamaño, presentación…" maxLength={160} />
        </Field>
        <div className="flex items-center justify-between rounded-2xl border border-cal-300 bg-white px-4 py-3">
          <span className="text-sm font-semibold text-tinta-700">Disponible para pedir</span>
          <Toggle on={available} onChange={setAvailable} />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full py-3.5">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {product ? 'Guardar cambios' : 'Agregar producto'}
        </button>
      </form>
    </Sheet>
  );
}

/* ================================================================
   Ofertas flash
   ================================================================ */
function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function DealsTab({
  products,
  deals,
  maxDeals,
  onPublish,
  onEnd,
  onUpgrade,
}: {
  products: Product[];
  deals: FlashDeal[];
  maxDeals: number;
  onPublish: (productId: string, price: number, expiresAt: string) => Promise<boolean>;
  onEnd: (id: string) => Promise<void>;
  onUpgrade: () => void;
}) {
  const available = products.filter((p) => p.is_available);
  const [productId, setProductId] = useState(available[0]?.id ?? '');
  const [price, setPrice] = useState('');
  const [expires, setExpires] = useState(() => toLocalInput(new Date(Date.now() + 2 * 3600_000)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = deals.filter((d) => d.is_active && new Date(d.expires_at).getTime() > Date.now());
  const past = deals.filter((d) => !active.includes(d)).slice(0, 6);
  const product = products.find((p) => p.id === productId);
  const n = Number(price.replace(',', '.'));
  const pct = product && n > 0 ? Math.round((1 - n / Number(product.price)) * 100) : 0;

  const setQuick = (v: number | 'today') => {
    const d = new Date();
    if (v === 'today') d.setHours(23, 59, 0, 0);
    else d.setTime(Date.now() + v * 3600_000);
    setExpires(toLocalInput(d));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!product) return setError('Elige un producto.');
    if (!(n > 0) || n >= Number(product.price)) return setError('El precio de oferta debe ser menor al precio normal.');
    const exp = new Date(expires);
    if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) return setError('La hora de cierre debe ser en el futuro.');
    setSaving(true);
    const ok = await onPublish(product.id, n, exp.toISOString());
    setSaving(false);
    if (ok) setPrice('');
  };

  if (maxDeals === 0) {
    return (
      <section className="space-y-4">
        <h2 className="heading text-2xl">Ofertas flash</h2>
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-ocaso-400 to-teja-500 p-6 text-white shadow-ocaso">
          <Flame size={32} />
          <p className="heading mt-3 text-2xl text-white">Aparece en la portada con cuenta regresiva</p>
          <p className="mt-2 text-sm text-white/85">Las ofertas flash se muestran primero en el inicio de la app. Disponibles desde el plan Pro.</p>
          <button onClick={onUpgrade} className="mt-4 rounded-2xl bg-cal-50 px-4 py-2.5 text-sm font-bold text-ocaso-600">
            Ver planes
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="heading text-2xl">Publicar oferta flash</h2>
        <p className="text-sm text-tinta-500">
          Aparece destacada en el inicio con cuenta regresiva · {active.length} de {maxDeals} activas
        </p>
      </div>

      {available.length === 0 ? (
        <p className="card p-5 text-center text-sm text-tinta-500">Necesitas al menos un producto disponible.</p>
      ) : active.length >= maxDeals ? (
        <button onClick={onUpgrade} className="w-full rounded-2xl bg-ocre-100 p-4 text-left text-sm text-ocre-600 ring-1 ring-ocre-400/40">
          Tienes el máximo de ofertas activas de tu plan. Finaliza una o <b>mejora tu plan</b>.
        </button>
      ) : (
        <form onSubmit={submit} className="relative overflow-hidden rounded-[28px] border border-ocaso-300/50 bg-gradient-to-br from-ocre-100 via-cal-50 to-cal-50 p-4 shadow-soft">
          <div className="relative space-y-4">
            <Field label="Producto">
              <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {formatPrice(p.price)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Precio de oferta (USD)">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-tinta-400">$</span>
                <input className="input pl-8 pr-20" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                {pct > 0 && pct < 100 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-teja-500 px-2 py-0.5 text-xs font-black text-white">-{pct}%</span>
                )}
              </div>
            </Field>
            <Field label="Termina">
              <div className="mb-2 flex gap-2">
                {([
                  ['1 h', 1],
                  ['3 h', 3],
                  ['Hoy', 'today'],
                  ['24 h', 24],
                ] as const).map(([label, v]) => (
                  <button key={label} type="button" onClick={() => setQuick(v)} className="flex-1 rounded-xl border border-cal-300 bg-white py-2 text-xs font-semibold text-tinta-700 active:scale-95">
                    {label}
                  </button>
                ))}
              </div>
              <input className="input" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </Field>
            {error && <p className="rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">{error}</p>}
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-ocaso-500 to-teja-500 py-3.5 font-bold text-white shadow-ocaso transition active:scale-[0.98] disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />} Publicar oferta
            </button>
          </div>
        </form>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-tinta-500">Activas ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-sm text-tinta-400">No tienes ofertas activas ahora.</p>
        ) : (
          <ul className="space-y-2.5">
            {active.map((d) => (
              <ActiveDeal key={d.id} deal={d} product={products.find((p) => p.id === d.product_id)} onEnd={() => onEnd(d.id)} />
            ))}
          </ul>
        )}
      </div>
      {past.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-tinta-400">Anteriores</h3>
          <ul className="space-y-2">
            {past.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-2xl border border-cal-300 px-4 py-2.5 text-sm text-tinta-400">
                <span className="truncate">{products.find((x) => x.id === d.product_id)?.title ?? 'Producto'}</span>
                <span>{formatPrice(d.discount_price)} · finalizada</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ActiveDeal({ deal, product, onEnd }: { deal: FlashDeal; product?: Product; onEnd: () => void }) {
  const { hours, minutes, seconds } = useCountdown(deal.expires_at);
  return (
    <li className="card flex items-center gap-3 p-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-ocaso-400 to-teja-500 text-white">
        <Flame size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-tinta-900">{product?.title ?? 'Producto'}</p>
        <p className="text-sm">
          <span className="font-extrabold text-ocaso-600">{formatPrice(deal.discount_price)}</span>{' '}
          {product && <span className="text-tinta-400 line-through">{formatPrice(product.price)}</span>}
        </p>
        <p suppressHydrationWarning className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-tinta-500">
          <Clock size={12} /> {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
        </p>
      </div>
      <button onClick={onEnd} className="rounded-xl border border-cal-300 px-3 py-2 text-xs font-semibold text-tinta-700 active:scale-95">
        Finalizar
      </button>
    </li>
  );
}

/* ================================================================
   Perfil del negocio
   ================================================================ */
function ProfileTab({
  sb,
  userId,
  merchant,
  canCover = false,
  onSaved,
  onError,
  onUpgrade,
}: {
  sb: SupabaseClient;
  userId: string;
  merchant: Merchant | null;
  canCover?: boolean;
  onSaved: (m: Merchant) => void;
  onError: (m: string) => void;
  onUpgrade?: () => void;
}) {
  const [form, setForm] = useState({
    name: merchant?.name ?? '',
    category: (merchant?.category ?? 'Comida') as Category,
    whatsapp_number: merchant?.whatsapp_number ?? '',
    description: merchant?.description ?? '',
    address: merchant?.address ?? '',
    opens_at: merchant?.opens_at?.slice(0, 5) ?? '08:00',
    closes_at: merchant?.closes_at?.slice(0, 5) ?? '20:00',
    is_active: merchant?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const savePhoto = async (field: 'logo_url' | 'cover_url', file: File | null) => {
    if (!merchant) return;
    try {
      const old = merchant[field];
      const url = file ? await uploadImage(sb, userId, file, field === 'logo_url' ? 'logo' : 'portada') : null;
      const { data, error } = await sb.from('merchants').update({ [field]: url }).eq('id', merchant.id).select().single();
      if (error) {
        if (url) await removeImage(sb, url);
        throw error;
      }
      await removeImage(sb, old);
      onSaved(data as Merchant);
    } catch (err) {
      onError(friendlyError(err));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return onError('Escribe el nombre del negocio.');
    if (!isValidPhone(form.whatsapp_number)) return onError('Escribe un número de WhatsApp válido.');
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      whatsapp_number: normalizePhone(form.whatsapp_number),
      description: form.description.trim() || null,
      address: form.address.trim() || null,
    };
    const q = merchant
      ? sb.from('merchants').update(payload).eq('id', merchant.id).select().single()
      : sb.from('merchants').insert({ ...payload, user_id: userId, slug: 'nuevo' }).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return onError(friendlyError(error));
    onSaved(data as Merchant);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="heading text-2xl">{merchant ? 'Perfil del negocio' : 'Crea tu comercio'}</h2>
        <p className="text-sm text-tinta-500">Así te verán los clientes en la app.</p>
      </div>

      {merchant && (
        <div className="card space-y-4 p-4">
          <Field label="Logo">
            <PhotoPicker value={merchant.logo_url} onPick={(f) => savePhoto('logo_url', f)} onRemove={() => savePhoto('logo_url', null)} label="Subir logo" />
          </Field>
          <Field label="Foto de portada" hint={canCover ? 'Una foto horizontal de tu local o tus productos.' : undefined}>
            <PhotoPicker
              shape="wide"
              value={canCover ? merchant.cover_url : null}
              onPick={(f) => savePhoto('cover_url', f)}
              onRemove={() => savePhoto('cover_url', null)}
              label="Subir portada"
              locked={canCover ? undefined : 'Disponible desde el plan Pro'}
            />
            {!canCover && onUpgrade && (
              <button type="button" onClick={onUpgrade} className="mt-2 text-xs font-semibold text-laguna-600">
                Ver planes →
              </button>
            )}
          </Field>
          <div className="flex items-center justify-between rounded-2xl border border-cal-300 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-tinta-900">Mostrar mi comercio en la app</p>
              <p className="text-xs text-tinta-500">Apágalo si cierras por vacaciones.</p>
            </div>
            <Toggle on={form.is_active} onChange={(v) => set('is_active', v)} />
          </div>
        </div>
      )}

      <div className="card space-y-4 rounded-[28px] p-4">
        <Field label="Nombre del negocio">
          <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
        </Field>
        <Field label="Categoría">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => set('category', c)}
                className={cn(
                  'rounded-2xl border py-2.5 text-xs font-semibold transition active:scale-95',
                  form.category === c ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-white text-tinta-500'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="WhatsApp" hint="Aquí te llegan los pedidos. Ej: 0414-1234567">
          <input className="input" required inputMode="tel" value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Abre">
            <input className="input" type="time" value={form.opens_at} onChange={(e) => set('opens_at', e.target.value)} />
          </Field>
          <Field label="Cierra">
            <input className="input" type="time" value={form.closes_at} onChange={(e) => set('closes_at', e.target.value)} />
          </Field>
        </div>
        <Field label="Dirección">
          <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Calle, sector y punto de referencia" maxLength={160} />
        </Field>
        <Field label="Descripción">
          <textarea className="input min-h-[90px] resize-none" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="¿Qué vendes? ¿Qué te hace especial?" maxLength={280} />
        </Field>
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full py-3.5">
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        {merchant ? 'Guardar cambios' : 'Crear mi comercio'}
      </button>
    </form>
  );
}

/* ================================================================
   Membresía
   ================================================================ */
function PlanTab({ merchant, settings, productsCount }: { merchant: Merchant; settings: AppSettings | null; productsCount: number }) {
  const current = effectivePlan(merchant);
  const left = daysLeft(merchant.plan_expires_at);
  const expired = merchant.plan !== 'gratis' && current === 'gratis';
  const price = (id: PlanId) => (id === 'gratis' ? 0 : id === 'pro' ? Number(settings?.price_pro ?? 10) : Number(settings?.price_premium ?? 25));
  const ask = (id: PlanId) =>
    settings?.admin_whatsapp
      ? waLink(
          settings.admin_whatsapp,
          `Hola, soy ${merchant.name} en Lagunillas Central. Quiero ${current === id ? 'renovar' : 'activar'} el plan ${PLANS[id].name} (${`$${price(id)}`}/mes). ¿Cómo hago el pago?`
        )
      : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="heading text-2xl">Tu membresía</h2>
        <p className="text-sm text-tinta-500">
          Plan actual: <b className="text-tinta-900">{PLANS[current].name}</b>
          {current !== 'gratis' && left !== null && ` · vence en ${left} día${left === 1 ? '' : 's'}`}
        </p>
        {expired && <p className="mt-2 rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">Tu plan {PLANS[merchant.plan].name} venció. Renuévalo para recuperar sus beneficios.</p>}
        {current !== 'gratis' && left !== null && left <= 5 && left > 0 && (
          <p className="mt-2 rounded-2xl bg-ocre-100 p-3 text-sm text-ocre-600">Tu plan vence pronto. Renuévalo para no perder tus beneficios.</p>
        )}
      </div>

      {(['gratis', 'pro', 'premium'] as PlanId[]).map((id) => {
        const p = PLANS[id];
        const isCurrent = id === current;
        const link = ask(id);
        return (
          <div key={id} className={cn('card relative overflow-hidden p-5', isCurrent && 'ring-2 ring-laguna-500', id === 'premium' && 'bg-gradient-to-br from-ocre-100 to-cal-50')}>
            {isCurrent && <span className="absolute right-4 top-4 rounded-full bg-laguna-600 px-2.5 py-0.5 text-[11px] font-bold text-white">Tu plan</span>}
            <p className="heading text-2xl">
              {p.name} {id === 'premium' && '⭐'}
            </p>
            <p className="text-sm text-tinta-500">{p.tagline}</p>
            <p className="mt-2">
              <span className="text-3xl font-black text-tinta-900">${price(id)}</span>
              <span className="text-sm text-tinta-500">{id === 'gratis' ? ' para siempre' : ' al mes'}</span>
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-tinta-700">
              {p.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-laguna-600" /> {perk}
                </li>
              ))}
            </ul>
            {id === current && id !== 'gratis' && link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-4 w-full">
                Renovar por WhatsApp
              </a>
            )}
            {id !== 'gratis' && id !== current && (
              link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 w-full">
                  Quiero el plan {p.name}
                </a>
              ) : (
                <p className="mt-4 text-xs text-tinta-400">Escríbele a la administración para activarlo.</p>
              )
            )}
            {id === 'gratis' && productsCount > p.maxProducts && !isCurrent && null}
          </div>
        );
      })}
      <p className="text-center text-xs text-tinta-400">
        El pago se hace por pago móvil, transferencia o Zelle. Al confirmarlo, activamos tu plan desde la administración.
      </p>
    </section>
  );
}
