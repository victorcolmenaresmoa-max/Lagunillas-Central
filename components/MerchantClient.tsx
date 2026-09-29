'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Share2,
  MapPin,
  Clock,
  Search,
  Minus,
  Plus,
  ShoppingBag,
  X,
  Flame,
  Bike,
  Store,
  PackageX,
  Sparkles,
  Check,
} from 'lucide-react';
import MerchantAvatar from './MerchantAvatar';
import { styleFor } from '@/lib/categories';
import type { FlashDealFull, Merchant, Product } from '@/lib/types';
import { useCountdown, pad2 } from '@/lib/useCountdown';
import { cn, formatPrice, formatTime, isOpenNow, normalizeWhatsapp } from '@/lib/utils';

function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.99 6.67 2.77a9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43m8.03-17.46A11.3 11.3 0 0 0 12.05.7C5.8.7.7 5.8.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.3l5.73-1.5a11.3 11.3 0 0 0 5.72 1.46h.01c6.25 0 11.34-5.09 11.35-11.35 0-3.03-1.18-5.88-3.33-8.02" />
    </svg>
  );
}

function DealBanner({ deal }: { deal: FlashDealFull }) {
  const { hours, minutes, seconds, expired } = useCountdown(deal.expires_at);
  if (expired) return null;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-orange-400/30 bg-gradient-to-r from-orange-500/15 via-rose-500/10 to-transparent p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-300">
            <Flame size={13} /> Oferta flash
          </p>
          <p className="mt-1 truncate font-bold text-white">{deal.product.title}</p>
          <p className="text-sm">
            <span className="font-extrabold text-orange-200">{formatPrice(deal.discount_price)}</span>{' '}
            <span className="text-white/40 line-through">{formatPrice(deal.product.price)}</span>
          </p>
        </div>
        <div suppressHydrationWarning className="shrink-0 rounded-2xl bg-black/30 px-3 py-2 text-center font-extrabold tabular-nums text-white">
          {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
        </div>
      </div>
    </div>
  );
}

export default function MerchantClient({
  merchant: m,
  products,
  deals,
}: {
  merchant: Merchant;
  products: Product[];
  deals: FlashDealFull[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [bump, setBump] = useState(0);
  const [copied, setCopied] = useState(false);

  const open = isOpenNow(m);
  const { gradient, chip } = styleFor(m.category);

  // Precio con descuento si el producto tiene oferta flash vigente
  const dealPrice = useMemo(() => {
    const map: Record<string, number> = {};
    deals.forEach((d) => {
      if (new Date(d.expires_at).getTime() > Date.now()) map[d.product_id] = Number(d.discount_price);
    });
    return map;
  }, [deals]);

  const priceOf = (p: Product) => dealPrice[p.id] ?? Number(p.price);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!onlyAvailable || p.is_available) &&
        (!q || `${p.title} ${p.description ?? ''}`.toLowerCase().includes(q))
    );
  }, [products, query, onlyAvailable]);

  const items = products.filter((p) => cart[p.id] > 0);
  const count = items.reduce((s, p) => s + cart[p.id], 0);
  const total = items.reduce((s, p) => s + cart[p.id] * priceOf(p), 0);

  const setQty = (id: string, delta: number) => {
    setCart((c) => {
      const next = Math.max(0, Math.min(99, (c[id] ?? 0) + delta));
      const copy = { ...c, [id]: next };
      if (next === 0) delete copy[id];
      return copy;
    });
    if (delta > 0) setBump((b) => b + 1);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: m.name, text: `Mira ${m.name} en Lagunillas Central`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };

  const waNumber = normalizeWhatsapp(m.whatsapp_number);
  const generalMessage = `¡Hola, ${m.name}! 👋 Te escribo desde Lagunillas Central.`;

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-36">
      {/* ---------- PORTADA ---------- */}
      <div className="relative h-48 overflow-hidden">
        {m.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={cn('h-full w-full bg-gradient-to-br opacity-80', gradient)}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.35),transparent_50%)]" />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.05)_0_12px,transparent_12px_24px)]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
        <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <Link href="/" aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/35 text-white backdrop-blur-md transition active:scale-90">
            <ArrowLeft size={20} />
          </Link>
          <button onClick={share} aria-label="Compartir" className="flex h-10 items-center gap-1.5 rounded-2xl bg-black/35 px-3 text-sm font-semibold text-white backdrop-blur-md transition active:scale-90">
            {copied ? <Check size={18} /> : <Share2 size={18} />}
            {copied ? 'Copiado' : ''}
          </button>
        </div>
      </div>

      {/* ---------- INFO DEL COMERCIO ---------- */}
      <section className="relative -mt-14 animate-fade-up px-4">
        <MerchantAvatar name={m.name} category={m.category} logoUrl={m.logo_url} size="xl" className="shadow-2xl shadow-black/50 ring-4 ring-ink-950" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-white">
            {m.name}
            {m.is_featured && <Sparkles size={18} className="ml-1.5 inline fill-amber-300 text-amber-300" />}
          </h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', chip)}>{m.category}</span>
          <span
            suppressHydrationWarning
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              open ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', open ? 'animate-pulse bg-emerald-400' : 'bg-rose-400')} />
            {open ? 'Abierto ahora' : 'Cerrado ahora'}
          </span>
        </div>

        {m.description && <p className="mt-3 text-[15px] leading-relaxed text-slate-300">{m.description}</p>}

        <div className="glass mt-4 divide-y divide-slate-800/80 rounded-3xl">
          <div className="flex items-center gap-3 p-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-laguna-300"><Clock size={17} /></span>
            <div className="text-sm">
              <p className="text-slate-400">Horario</p>
              <p className="font-semibold text-white">{formatTime(m.opens_at)} – {formatTime(m.closes_at)}</p>
            </div>
          </div>
          {m.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.address}, Lagunillas, Mérida, Venezuela`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3.5 transition active:bg-white/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-laguna-300"><MapPin size={17} /></span>
              <div className="min-w-0 text-sm">
                <p className="text-slate-400">Dirección</p>
                <p className="truncate font-semibold text-white">{m.address}</p>
              </div>
              <span className="ml-auto text-xs font-semibold text-laguna-400">Ver mapa</span>
            </a>
          )}
        </div>

        {deals.length > 0 && (
          <div className="mt-4 space-y-3">
            {deals.map((d) => (
              <DealBanner key={d.id} deal={d} />
            ))}
          </div>
        )}
      </section>

      {/* ---------- CATÁLOGO ---------- */}
      <section className="mt-7 animate-fade-up px-4" style={{ animationDelay: '120ms' }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">Menú y catálogo</h2>
          <span className="text-xs text-slate-500">{products.length} productos</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar productos…"
              className="input h-11 pl-10 text-sm"
              type="search"
            />
          </div>
          <button
            onClick={() => setOnlyAvailable((v) => !v)}
            className={cn(
              'shrink-0 rounded-2xl border px-3 text-xs font-semibold transition active:scale-95',
              onlyAvailable ? 'border-laguna-500/50 bg-laguna-500/15 text-laguna-300' : 'border-slate-800 bg-ink-850/70 text-slate-400'
            )}
          >
            Disponibles
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="glass mt-3 flex flex-col items-center rounded-3xl px-6 py-10 text-center">
            <PackageX size={32} className="text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No hay productos que coincidan.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {visible.map((p) => {
              const qty = cart[p.id] ?? 0;
              const hasDeal = dealPrice[p.id] !== undefined;
              return (
                <li
                  key={p.id}
                  className={cn(
                    'glass flex items-center gap-3 rounded-3xl p-3 transition',
                    qty > 0 && 'border-laguna-500/40 bg-laguna-500/[0.06]',
                    !p.is_available && 'opacity-50'
                  )}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.title} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-black text-white/90', gradient)}>
                      {p.title.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug text-white">{p.title}</p>
                    {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{p.description}</p>}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={cn('font-extrabold', hasDeal ? 'text-orange-300' : 'text-laguna-300')}>{formatPrice(priceOf(p))}</span>
                      {hasDeal && <span className="text-xs text-slate-500 line-through">{formatPrice(p.price)}</span>}
                      {hasDeal && <Flame size={13} className="text-orange-400" />}
                    </div>
                  </div>

                  {!p.is_available ? (
                    <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400">Agotado</span>
                  ) : qty === 0 ? (
                    <button
                      onClick={() => setQty(p.id, 1)}
                      aria-label={`Agregar ${p.title}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-laguna-400 to-sky-500 text-ink-950 shadow-glow transition active:scale-90"
                    >
                      <Plus size={20} strokeWidth={2.8} />
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-slate-700 bg-ink-950/70 p-1">
                      <button onClick={() => setQty(p.id, -1)} aria-label="Quitar uno" className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition active:scale-90 active:bg-white/10">
                        <Minus size={16} strokeWidth={2.6} />
                      </button>
                      <span key={qty} className="w-6 animate-pop text-center font-extrabold tabular-nums text-white">{qty}</span>
                      <button onClick={() => setQty(p.id, 1)} aria-label="Agregar uno" className="flex h-8 w-8 items-center justify-center rounded-xl bg-laguna-500 text-ink-950 transition active:scale-90">
                        <Plus size={16} strokeWidth={2.8} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- BARRA FLOTANTE ---------- */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3">
        {count > 0 ? (
          <button
            onClick={() => setSheet(true)}
            className="flex w-full animate-slide-up items-center gap-3 rounded-3xl bg-gradient-to-r from-[#25d366] to-[#128c7e] p-2 pr-4 text-left text-white shadow-[0_12px_40px_-8px_rgba(37,211,102,0.55)] transition active:scale-[0.98]"
          >
            <span key={bump} className="relative flex h-12 w-12 animate-pop items-center justify-center rounded-2xl bg-black/20">
              <ShoppingBag size={22} />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-black text-[#128c7e]">{count}</span>
            </span>
            <span className="flex-1">
              <span className="block text-xs font-medium text-white/80">Total del pedido</span>
              <span className="block text-lg font-extrabold tabular-nums leading-tight">{formatPrice(total)}</span>
            </span>
            <span className="flex items-center gap-2 font-bold">
              <WhatsAppIcon size={20} /> Pedir
            </span>
          </button>
        ) : (
          <div className="flex justify-end">
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(generalMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escribir por WhatsApp"
              className="flex h-14 items-center gap-2 rounded-full bg-[#25d366] px-5 font-bold text-white shadow-[0_12px_40px_-8px_rgba(37,211,102,0.6)] transition active:scale-95"
            >
              <WhatsAppIcon /> Escribir
            </a>
          </div>
        )}
      </div>

      {sheet && (
        <OrderSheet
          merchant={m}
          items={items.map((p) => ({ product: p, qty: cart[p.id], price: priceOf(p) }))}
          total={total}
          waNumber={waNumber}
          open={open}
          onClose={() => setSheet(false)}
          onQty={setQty}
        />
      )}
    </main>
  );
}

/* ================================================================ */

function OrderSheet({
  merchant,
  items,
  total,
  waNumber,
  open,
  onClose,
  onQty,
}: {
  merchant: Merchant;
  items: { product: Product; qty: number; price: number }[];
  total: number;
  waNumber: string;
  open: boolean;
  onClose: () => void;
  onQty: (id: string, d: number) => void;
}) {
  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  const lines = items.map((i) => `• ${i.qty}x ${i.product.title} (${formatPrice(i.qty * i.price)})`);
  const message = [
    `¡Hola, ${merchant.name}! 👋 Quisiera pedir:`,
    '',
    ...lines,
    '',
    `*Total: ${formatPrice(total)}*`,
    '',
    name.trim() ? `Nombre: ${name.trim()}` : null,
    mode === 'delivery'
      ? `Dirección de entrega: ${address.trim() || '(por confirmar)'}`
      : 'Paso a retirarlo por el local.',
    note.trim() ? `Nota: ${note.trim()}` : null,
    '',
    '_Pedido enviado desde Lagunillas Central_',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const href = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  const canSend = items.length > 0 && (mode === 'pickup' || address.trim().length > 3);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 animate-[fade-up_0.2s_ease-out] bg-black/60 backdrop-blur-sm" />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[32px] border-t border-slate-800 bg-ink-900 px-5 pt-3">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-700" />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-white">Tu pedido</h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/5" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-400">{merchant.name}</p>

        {!open && (
          <p className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Este comercio está cerrado ahora. Puedes enviar el pedido y te responderán al abrir.
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {items.map(({ product, qty, price }) => (
            <li key={product.id} className="flex items-center gap-3 rounded-2xl bg-ink-950/60 p-2.5 pl-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{product.title}</p>
                <p className="text-xs text-slate-500">{formatPrice(price)} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onQty(product.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 active:scale-90" aria-label="Quitar uno">
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-sm font-bold tabular-nums text-white">{qty}</span>
                <button onClick={() => onQty(product.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-laguna-500 text-ink-950 active:scale-90" aria-label="Agregar uno">
                  <Plus size={14} />
                </button>
              </div>
              <span className="w-16 text-right text-sm font-bold tabular-nums text-laguna-300">{formatPrice(qty * price)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-800 px-4 py-3">
          <span className="font-semibold text-slate-300">Total</span>
          <span className="text-xl font-extrabold tabular-nums text-white">{formatPrice(total)}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-ink-950/70 p-1">
          {([
            ['delivery', 'Delivery', Bike],
            ['pickup', 'Retiro en local', Store],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
                mode === key ? 'bg-ink-800 text-white shadow' : 'text-slate-500'
              )}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="o-name">Tu nombre</label>
            <input id="o-name" className="input" placeholder="Ej: María Rangel" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          {mode === 'delivery' && (
            <div>
              <label className="label" htmlFor="o-addr">Dirección de entrega *</label>
              <input id="o-addr" className="input" placeholder="Sector, calle, casa y punto de referencia" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="o-note">Nota (opcional)</label>
            <input id="o-note" className="input" placeholder="Sin cebolla, pago en efectivo…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <a
          href={canSend ? href : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!canSend}
          onClick={(e) => !canSend && e.preventDefault()}
          className={cn(
            'mb-4 mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition active:scale-[0.98]',
            canSend ? 'bg-gradient-to-r from-[#25d366] to-[#128c7e] shadow-[0_12px_40px_-8px_rgba(37,211,102,0.55)]' : 'cursor-not-allowed bg-slate-800 text-slate-500'
          )}
        >
          <WhatsAppIcon /> Enviar pedido por WhatsApp
        </a>
        {!canSend && mode === 'delivery' && (
          <p className="-mt-2 mb-4 text-center text-xs text-slate-500">Escribe tu dirección para continuar</p>
        )}
      </div>
    </div>
  );
}
