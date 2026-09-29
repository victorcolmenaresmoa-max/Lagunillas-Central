'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  Package,
  Zap,
  LogOut,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  Flame,
  Clock,
  Info,
  AlertTriangle,
  Save,
} from 'lucide-react';
import MerchantAvatar from '@/components/MerchantAvatar';
import { createAdminStore, type AdminState, type AdminStore, type MerchantInput, type ProductInput } from '@/lib/admin-store';
import { CATEGORIES, type Category, type FlashDeal, type Merchant, type Product } from '@/lib/types';
import { useCountdown, pad2 } from '@/lib/useCountdown';
import { cn, formatPrice } from '@/lib/utils';

type Tab = 'perfil' | 'productos' | 'ofertas';

/* ================================================================
   Página
   ================================================================ */
export default function DashboardPage() {
  const router = useRouter();
  const storeRef = useRef<AdminStore | null>(null);
  const [state, setState] = useState<AdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('productos');
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  const notify = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    storeRef.current = createAdminStore();
    storeRef.current
      .load()
      .then((s) => {
        if (!s) {
          router.replace('/admin/login');
          return;
        }
        setState(s);
        if (!s.merchant) setTab('perfil');
      })
      .catch((e) => notify(e.message, 'err'))
      .finally(() => setLoading(false));
  }, [router]);

  const store = storeRef.current;

  const run = async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    try {
      const r = await fn();
      if (okMsg) notify(okMsg);
      return r;
    } catch (e: any) {
      notify(e?.message ?? 'Ocurrió un error', 'err');
    }
  };

  const signOut = async () => {
    await store?.signOut();
    router.replace(store?.demo ? '/' : '/admin/login');
    router.refresh();
  };

  if (loading || !state || !store) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-laguna-400" size={32} />
      </main>
    );
  }

  const { merchant, products, deals } = state;
  const activeDeals = deals.filter((d) => d.is_active && new Date(d.expires_at).getTime() > Date.now());

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-32">
      {/* ---------- HEADER ---------- */}
      <header className="pt-safe sticky top-0 z-30 border-b border-slate-800/60 bg-ink-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          {merchant ? (
            <MerchantAvatar name={merchant.name} category={merchant.category} logoUrl={merchant.logo_url} size="sm" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 text-slate-400"><Store size={18} /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{merchant?.name ?? 'Nuevo comercio'}</p>
            <p className="truncate text-xs text-slate-500">{state.email}</p>
          </div>
          {merchant && (
            <Link href={`/comercio/${merchant.slug}`} target="_blank" className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-800 px-3 text-xs font-semibold text-slate-300 active:scale-95">
              <ExternalLink size={14} /> Ver
            </Link>
          )}
          <button onClick={signOut} aria-label="Cerrar sesión" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 text-slate-400 active:scale-95">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {store.demo && (
        <div className="mx-4 mt-4 flex gap-2.5 rounded-2xl border border-sky-400/30 bg-sky-400/10 p-3 text-xs text-sky-200">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p><b>Modo demostración:</b> los cambios no se guardan. Conecta Supabase para usarlo de verdad.</p>
        </div>
      )}

      {/* ---------- RESUMEN ---------- */}
      {merchant && (
        <section className="mt-4 grid grid-cols-3 gap-2.5 px-4">
          {[
            { label: 'Productos', value: products.length, icon: Package },
            { label: 'Disponibles', value: products.filter((p) => p.is_available).length, icon: Check },
            { label: 'Ofertas activas', value: activeDeals.length, icon: Flame, hot: activeDeals.length > 0 },
          ].map(({ label, value, icon: Icon, hot }) => (
            <div key={label} className="glass rounded-3xl p-3">
              <Icon size={16} className={hot ? 'text-orange-400' : 'text-laguna-400'} />
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-white">{value}</p>
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </section>
      )}

      <div className="mt-5 px-4">
        {tab === 'perfil' && (
          <ProfilePanel
            merchant={merchant}
            onSave={async (input) => {
              const saved = await run(() => store.saveMerchant(merchant, input), merchant ? 'Perfil actualizado' : '¡Comercio creado!');
              if (saved) setState((s) => s && { ...s, merchant: saved });
            }}
          />
        )}
        {tab === 'productos' && merchant && (
          <ProductsPanel
            products={products}
            onAdd={async (input) => {
              const p = await run(() => store.addProduct(merchant.id, input), 'Producto agregado');
              if (p) setState((s) => s && { ...s, products: [...s.products, p] });
              return Boolean(p);
            }}
            onUpdate={async (id, input, msg) => {
              const p = await run(() => store.updateProduct(id, input), msg);
              if (p) setState((s) => s && { ...s, products: s.products.map((x) => (x.id === id ? p : x)) });
              return Boolean(p);
            }}
            onDelete={async (id) => {
              const ok = await run(() => store.deleteProduct(id).then(() => true), 'Producto eliminado');
              if (ok) setState((s) => s && { ...s, products: s.products.filter((x) => x.id !== id), deals: s.deals.filter((d) => d.product_id !== id) });
            }}
          />
        )}
        {tab === 'ofertas' && merchant && (
          <DealsPanel
            products={products}
            deals={deals}
            onPublish={async (productId, price, expiresAt) => {
              const d = await run(() => store.addDeal(merchant.id, productId, price, expiresAt), '¡Oferta publicada! 🔥');
              if (d) setState((s) => s && { ...s, deals: [d, ...s.deals] });
              return Boolean(d);
            }}
            onEnd={async (id) => {
              const ok = await run(() => store.endDeal(id).then(() => true), 'Oferta finalizada');
              if (ok) setState((s) => s && { ...s, deals: s.deals.map((d) => (d.id === id ? { ...d, is_active: false } : d)) });
            }}
          />
        )}
        {tab !== 'perfil' && !merchant && (
          <p className="text-center text-sm text-slate-500">Primero completa el perfil de tu comercio.</p>
        )}
      </div>

      {/* ---------- NAVEGACIÓN INFERIOR ---------- */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3">
        <div className="glass grid grid-cols-3 gap-1 rounded-3xl p-1.5 shadow-2xl shadow-black/60">
          {([
            ['perfil', 'Perfil', Store],
            ['productos', 'Productos', Package],
            ['ofertas', 'Oferta Flash', Zap],
          ] as const).map(([key, label, Icon]) => {
            const active = tab === key;
            const disabled = !merchant && key !== 'perfil';
            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => setTab(key)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition active:scale-95 disabled:opacity-30',
                  active ? 'bg-gradient-to-br from-laguna-400 to-sky-500 text-ink-950 shadow-glow' : 'text-slate-400'
                )}
              >
                <Icon size={19} strokeWidth={2.3} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ---------- TOAST ---------- */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] mx-auto flex max-w-md justify-center px-4">
          <div
            className={cn(
              'flex animate-fade-up items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl',
              toast.kind === 'ok' ? 'bg-emerald-500 text-emerald-950' : 'bg-rose-500 text-white'
            )}
          >
            {toast.kind === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />}
            {toast.msg}
          </div>
        </div>
      )}
    </main>
  );
}

/* ================================================================
   Perfil del negocio
   ================================================================ */
function ProfilePanel({ merchant, onSave }: { merchant: Merchant | null; onSave: (i: MerchantInput) => Promise<void> }) {
  const [form, setForm] = useState<MerchantInput>({
    name: merchant?.name ?? '',
    category: merchant?.category ?? 'Comida',
    whatsapp_number: merchant?.whatsapp_number ?? '',
    description: merchant?.description ?? '',
    address: merchant?.address ?? '',
    opens_at: merchant?.opens_at?.slice(0, 5) ?? '08:00',
    closes_at: merchant?.closes_at?.slice(0, 5) ?? '20:00',
    logo_url: merchant?.logo_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MerchantInput>(k: K, v: MerchantInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, logo_url: form.logo_url || null, description: form.description || null, address: form.address || null });
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="animate-fade-up space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-white">{merchant ? 'Perfil del negocio' : 'Crea tu comercio'}</h2>
        <p className="text-sm text-slate-500">Así te verán los clientes en la app.</p>
      </div>

      <div className="glass space-y-4 rounded-[28px] p-4">
        <Field label="Nombre del negocio">
          <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Arepera El Páramo" />
        </Field>

        <Field label="Categoría">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => set('category', c as Category)}
                className={cn(
                  'rounded-2xl border py-2.5 text-xs font-semibold transition active:scale-95',
                  form.category === c ? 'border-laguna-500/60 bg-laguna-500/15 text-laguna-200' : 'border-slate-800 bg-ink-950/50 text-slate-400'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="WhatsApp" hint="Con código de país. Ej: 584141234567 o 0414-1234567">
          <input className="input" required inputMode="tel" value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="584141234567" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Abre">
            <input className="input" type="time" value={form.opens_at ?? ''} onChange={(e) => set('opens_at', e.target.value)} />
          </Field>
          <Field label="Cierra">
            <input className="input" type="time" value={form.closes_at ?? ''} onChange={(e) => set('closes_at', e.target.value)} />
          </Field>
        </div>

        <Field label="Dirección">
          <input className="input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="Calle, sector y punto de referencia" />
        </Field>

        <Field label="Descripción">
          <textarea className="input min-h-[90px] resize-none" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="¿Qué vendes? ¿Qué te hace especial?" maxLength={280} />
        </Field>

        <Field label="Logo (enlace a imagen, opcional)">
          <input className="input" type="url" value={form.logo_url ?? ''} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://…" />
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
   Productos (CRUD)
   ================================================================ */
function ProductsPanel({
  products,
  onAdd,
  onUpdate,
  onDelete,
}: {
  products: Product[];
  onAdd: (i: ProductInput) => Promise<boolean>;
  onUpdate: (id: string, i: Partial<ProductInput>, msg?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <section className="animate-fade-up">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white">Productos</h2>
          <p className="text-sm text-slate-500">Toca el interruptor para marcar agotado.</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary px-4 py-2.5 text-sm">
          <Plus size={17} strokeWidth={2.6} /> Nuevo
        </button>
      </div>

      {products.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
          <Package size={36} className="text-slate-600" />
          <p className="mt-3 font-semibold text-slate-200">Aún no tienes productos</p>
          <p className="mt-1 text-sm text-slate-500">Agrega el primero para que los clientes puedan pedir.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {products.map((p) => (
            <li key={p.id} className={cn('glass rounded-3xl p-3 transition', !p.is_available && 'opacity-60')}>
              <div className="flex items-center gap-3">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink-800 text-lg font-black text-slate-400">{p.title.charAt(0)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{p.title}</p>
                  <p className="text-sm font-extrabold text-laguna-300">{formatPrice(p.price)}</p>
                </div>
                <Toggle
                  on={p.is_available}
                  onChange={(v) => onUpdate(p.id, { is_available: v }, v ? 'Marcado como disponible' : 'Marcado como agotado')}
                />
              </div>

              {confirmDel === p.id ? (
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-500/10 p-2 pl-3">
                  <p className="flex-1 text-xs font-semibold text-rose-200">¿Eliminar este producto?</p>
                  <button onClick={() => setConfirmDel(null)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300">No</button>
                  <button
                    onClick={async () => {
                      await onDelete(p.id);
                      setConfirmDel(null);
                    }}
                    className="rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Sí, eliminar
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditing(p)} className="btn-ghost flex-1 py-2 text-xs">
                    <Pencil size={14} /> Editar
                  </button>
                  <button onClick={() => setConfirmDel(p.id)} className="btn-ghost py-2 text-xs text-rose-300">
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
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const ok = editing === 'new' ? await onAdd(input) : await onUpdate(editing.id, input, 'Producto actualizado');
            if (ok) setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function ProductSheet({ product, onClose, onSave }: { product: Product | null; onClose: () => void; onSave: (i: ProductInput) => Promise<void> }) {
  const [title, setTitle] = useState(product?.title ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [available, setAvailable] = useState(product?.is_available ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(price.replace(',', '.'));
    if (!title.trim() || Number.isNaN(n) || n < 0) return;
    setSaving(true);
    await onSave({ title: title.trim(), description: description.trim() || null, price: n, image_url: imageUrl.trim() || null, is_available: available });
    setSaving(false);
  };

  return (
    <Sheet title={product ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre">
          <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Hamburguesa clásica" />
        </Field>
        <Field label="Precio (USD)">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">$</span>
            <input className="input pl-8" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
        </Field>
        <Field label="Descripción (opcional)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ingredientes, tamaño, presentación…" />
        </Field>
        <Field label="Foto (enlace, opcional)">
          <input className="input" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 px-4 py-3">
          <span className="text-sm font-semibold text-slate-200">Disponible para pedir</span>
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

function DealsPanel({
  products,
  deals,
  onPublish,
  onEnd,
}: {
  products: Product[];
  deals: FlashDeal[];
  onPublish: (productId: string, price: number, expiresAt: string) => Promise<boolean>;
  onEnd: (id: string) => Promise<void>;
}) {
  const available = products.filter((p) => p.is_available);
  const [productId, setProductId] = useState(available[0]?.id ?? '');
  const [price, setPrice] = useState('');
  const [expires, setExpires] = useState(() => toLocalInput(new Date(Date.now() + 2 * 3600_000)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId);
  const n = Number(price.replace(',', '.'));
  const pct = product && n > 0 ? Math.round((1 - n / Number(product.price)) * 100) : 0;

  const quick = [
    ['1 h', 1],
    ['3 h', 3],
    ['Hoy', 'today'],
    ['24 h', 24],
  ] as const;

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
    if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) return setError('La fecha de expiración debe ser en el futuro.');
    setSaving(true);
    const ok = await onPublish(product.id, n, exp.toISOString());
    setSaving(false);
    if (ok) setPrice('');
  };

  const active = deals.filter((d) => d.is_active && new Date(d.expires_at).getTime() > Date.now());
  const past = deals.filter((d) => !active.includes(d)).slice(0, 5);

  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-white">
          <Zap size={20} className="fill-orange-400 text-orange-400" /> Publicar oferta flash
        </h2>
        <p className="text-sm text-slate-500">Aparecerá destacada en el inicio con cuenta regresiva.</p>
      </div>

      {available.length === 0 ? (
        <p className="glass rounded-3xl p-5 text-center text-sm text-slate-400">Necesitas al menos un producto disponible.</p>
      ) : (
        <form onSubmit={submit} className="relative overflow-hidden rounded-[28px] border border-orange-400/25 bg-gradient-to-br from-orange-500/10 via-ink-900 to-ink-900 p-4">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="relative space-y-4">
            <Field label="Producto">
              <select className="input appearance-none" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {formatPrice(p.price)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Precio de oferta (USD)">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">$</span>
                <input className="input pl-8 pr-20" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                {pct > 0 && pct < 100 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-black text-white">-{pct}%</span>
                )}
              </div>
            </Field>

            <Field label="Termina">
              <div className="mb-2 flex gap-2">
                {quick.map(([label, v]) => (
                  <button key={label} type="button" onClick={() => setQuick(v)} className="flex-1 rounded-xl border border-slate-800 bg-ink-950/60 py-2 text-xs font-semibold text-slate-300 active:scale-95">
                    {label}
                  </button>
                ))}
              </div>
              <input className="input" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </Field>

            {error && <p className="rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 py-3.5 font-bold text-white shadow-glow-hot transition active:scale-[0.98] disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />} Publicar oferta
            </button>
          </div>
        </form>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Activas ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">No tienes ofertas activas ahora.</p>
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
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Anteriores</h3>
          <ul className="space-y-2">
            {past.map((d) => {
              const p = products.find((x) => x.id === d.product_id);
              return (
                <li key={d.id} className="flex items-center justify-between rounded-2xl border border-slate-800/70 px-4 py-2.5 text-sm text-slate-500">
                  <span className="truncate">{p?.title ?? 'Producto'}</span>
                  <span>{formatPrice(d.discount_price)} · finalizada</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function ActiveDeal({ deal, product, onEnd }: { deal: FlashDeal; product?: Product; onEnd: () => void }) {
  const { hours, minutes, seconds } = useCountdown(deal.expires_at);
  return (
    <li className="glass flex items-center gap-3 rounded-3xl p-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white">
        <Flame size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-white">{product?.title ?? 'Producto'}</p>
        <p className="text-sm">
          <span className="font-extrabold text-orange-300">{formatPrice(deal.discount_price)}</span>{' '}
          {product && <span className="text-slate-500 line-through">{formatPrice(product.price)}</span>}
        </p>
        <p suppressHydrationWarning className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-slate-400">
          <Clock size={12} /> {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
        </p>
      </div>
      <button onClick={onEnd} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 active:scale-95">
        Finalizar
      </button>
    </li>
  );
}

/* ================================================================
   Piezas pequeñas
   ================================================================ */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-laguna-500' : 'bg-slate-700')}
    >
      <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[32px] border-t border-slate-800 bg-ink-900 px-5 pt-3">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-700" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/5" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}
