'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Loader2,
} from 'lucide-react';
import MerchantAvatar from './MerchantAvatar';
import Landscape from './Landscape';
import { styleFor } from '@/lib/categories';
import type { FlashDealFull, Merchant, Product } from '@/lib/types';
import { useCountdown, pad2 } from '@/lib/useCountdown';
import { cn, formatPrice, formatTime, isOpenNow, normalizeWhatsapp } from '@/lib/utils';
import { isValidPhone } from '@/lib/validate';

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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-ocaso-500 to-teja-500 p-4 shadow-ocaso">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/85">
            <Flame size={13} /> Oferta flash
          </p>
          <p className="mt-1 truncate font-bold text-white">{deal.product.title}</p>
          <p className="text-sm">
            <span className="font-extrabold text-white">{formatPrice(deal.discount_price)}</span>{' '}
            <span className="text-white/65 line-through">{formatPrice(deal.product.price)}</span>
          </p>
        </div>
        <div suppressHydrationWarning className="shrink-0 rounded-2xl bg-white/20 px-3 py-2 ring-1 ring-white/30 text-center font-extrabold tabular-nums text-white">
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
  deliveryFee,
}: {
  merchant: Merchant;
  products: Product[];
  deals: FlashDealFull[];
  deliveryFee: number;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [bump, setBump] = useState(0);
  const [copied, setCopied] = useState(false);

  const open = isOpenNow(m);
  const { gradient, chip, sky } = styleFor(m.category);

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
      <div className="relative h-52 overflow-hidden">
        {m.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Landscape tint={sky} className="absolute inset-0" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-cal-100" />
        <div className="pt-safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 pb-4">
          <Link href="/" aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30 text-white ring-1 ring-white/40 backdrop-blur-md transition active:scale-90">
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
        <MerchantAvatar name={m.name} category={m.category} logoUrl={m.logo_url} size="xl" className="shadow-lift ring-4 ring-cal-100" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="heading text-[30px] leading-[1.05]">
            {m.name}
            {m.is_featured && <Sparkles size={18} className="ml-1.5 inline fill-ocre-400 text-ocre-400" />}
          </h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', chip)}>{m.category}</span>
          <span
            suppressHydrationWarning
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              open ? 'bg-laguna-100 text-laguna-700' : 'bg-teja-100 text-teja-600'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', open ? 'animate-pulse bg-laguna-500' : 'bg-teja-500')} />
            {open ? 'Abierto ahora' : 'Cerrado ahora'}
          </span>
        </div>

        {m.description && <p className="mt-3 text-[15px] leading-relaxed text-tinta-600">{m.description}</p>}

        <div className="card mt-4 divide-y divide-cal-200">
          <div className="flex items-center gap-3 p-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-laguna-50 text-laguna-600"><Clock size={17} /></span>
            <div className="text-sm">
              <p className="text-tinta-500">Horario</p>
              <p className="font-semibold text-tinta-900">{formatTime(m.opens_at)} – {formatTime(m.closes_at)}</p>
            </div>
          </div>
          {m.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.address}, Lagunillas, Mérida, Venezuela`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3.5 transition active:bg-cal-100"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-laguna-50 text-laguna-600"><MapPin size={17} /></span>
              <div className="min-w-0 text-sm">
                <p className="text-tinta-500">Dirección</p>
                <p className="truncate font-semibold text-tinta-900">{m.address}</p>
              </div>
              <span className="ml-auto text-xs font-semibold text-laguna-600">Ver mapa</span>
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
          <h2 className="heading text-[22px]">Menú y catálogo</h2>
          <span className="text-xs text-tinta-400">{products.length} productos</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-400" />
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
              onlyAvailable ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-cal-50 text-tinta-500'
            )}
          >
            Disponibles
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="card mt-3 flex flex-col items-center px-6 py-10 text-center">
            <PackageX size={32} className="text-tinta-400" />
            <p className="mt-2 text-sm text-tinta-500">No hay productos que coincidan.</p>
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
                    'card flex items-center gap-3 p-3 transition',
                    qty > 0 && 'border-laguna-400 bg-laguna-50',
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
                    <p className="font-bold leading-snug text-tinta-900">{p.title}</p>
                    {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-tinta-500">{p.description}</p>}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={cn('font-extrabold', hasDeal ? 'text-ocaso-600' : 'text-laguna-600')}>{formatPrice(priceOf(p))}</span>
                      {hasDeal && <span className="text-xs text-tinta-400 line-through">{formatPrice(p.price)}</span>}
                      {hasDeal && <Flame size={13} className="text-ocaso-500" />}
                    </div>
                  </div>

                  {!p.is_available ? (
                    <span className="shrink-0 rounded-full bg-cal-200 px-2.5 py-1 text-[11px] font-semibold text-tinta-500">Agotado</span>
                  ) : qty === 0 ? (
                    <button
                      onClick={() => setQty(p.id, 1)}
                      aria-label={`Agregar ${p.title}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-laguna-500 to-laguna-700 text-white shadow-jade transition active:scale-90"
                    >
                      <Plus size={20} strokeWidth={2.8} />
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-cal-300 bg-white p-1">
                      <button onClick={() => setQty(p.id, -1)} aria-label="Quitar uno" className="flex h-8 w-8 items-center justify-center rounded-xl text-tinta-600 transition active:scale-90 active:bg-cal-200">
                        <Minus size={16} strokeWidth={2.6} />
                      </button>
                      <span key={qty} className="w-6 animate-pop text-center font-extrabold tabular-nums text-tinta-900">{qty}</span>
                      <button onClick={() => setQty(p.id, 1)} aria-label="Agregar uno" className="flex h-8 w-8 items-center justify-center rounded-xl bg-laguna-600 text-white transition active:scale-90">
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
          deliveryFee={deliveryFee}
          onClose={() => setSheet(false)}
          onQty={setQty}
          onSent={() => setCart({})}
        />
      )}
    </main>
  );
}

/* ================================================================ */

type Fulfillment = 'pickup' | 'delivery';

function OrderSheet({
  merchant,
  items,
  total,
  waNumber,
  open,
  deliveryFee,
  onClose,
  onQty,
  onSent,
}: {
  merchant: Merchant;
  items: { product: Product; qty: number; price: number }[];
  total: number;
  waNumber: string;
  open: boolean;
  deliveryFee: number;
  onClose: () => void;
  onQty: (id: string, d: number) => void;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<Fulfillment>('delivery');
  const [wantsDriver, setWantsDriver] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [hp, setHp] = useState(''); // trampa anti-robots
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; token: string; subtotal: number; fee: number } | null>(null);

  // Recuerda los datos del cliente para el próximo pedido
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lc-cliente') || '{}');
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
      if (saved.address) setAddress(saved.address);
    } catch {}
  }, []);

  const useDriver = mode === 'delivery' && wantsDriver;
  const grandTotal = total + (useDriver ? deliveryFee : 0);

  const buildMessage = (extra?: { code: string; link: string }) =>
    [
      `¡Hola, ${merchant.name}! 👋 Quisiera pedir:`,
      '',
      ...items.map((i) => `• ${i.qty}x ${i.product.title} (${formatPrice(i.qty * i.price)})`),
      '',
      `*Total productos: ${formatPrice(total)}*`,
      extra ? `Delivery Lagunillas Central: ${formatPrice(deliveryFee)} (se le paga al repartidor)` : null,
      '',
      name.trim() ? `Nombre: ${name.trim()}` : null,
      phone.trim() ? `Teléfono: ${phone.trim()}` : null,
      mode === 'delivery' ? `Dirección de entrega: ${address.trim() || '(por confirmar)'}` : 'Paso a retirarlo por el local.',
      mode === 'delivery' && !extra ? 'Entrega: con el delivery del comercio.' : null,
      note.trim() ? `Nota: ${note.trim()}` : null,
      extra ? '' : null,
      extra ? `🛵 Ya pedí repartidor por la app · Código *${extra.code}*` : null,
      extra ? `Seguimiento: ${extra.link}` : null,
      '',
      '_Pedido enviado desde Lagunillas Central_',
    ]
      .filter((l) => l !== null)
      .join('\n');

  const remember = () => {
    try {
      localStorage.setItem('lc-cliente', JSON.stringify({ name: name.trim(), phone: phone.trim(), address: address.trim() }));
    } catch {}
  };

  const valid =
    items.length > 0 &&
    (mode === 'pickup' || address.trim().length >= 6) &&
    (!useDriver || (name.trim().length >= 2 && isValidPhone(phone)));

  const requestDriver = async () => {
    setError(null);
    if (!valid) {
      if (name.trim().length < 2) return setError('Escribe tu nombre.');
      if (!isValidPhone(phone)) return setError('Escribe un teléfono válido para que el repartidor te contacte.');
      return setError('Escribe tu dirección con un punto de referencia.');
    }
    setSending(true);
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchant.id,
          customer_name: name,
          customer_phone: phone,
          address,
          notes: note,
          website: hp,
          items: items.map((i) => ({ product_id: i.product.id, qty: i.qty })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No pudimos pedir el repartidor.');
      remember();
      setCreated({ code: json.code, token: json.tracking_token, subtotal: json.subtotal, fee: json.delivery_fee });
      try {
        const list = JSON.parse(localStorage.getItem('lc-pedidos') || '[]');
        list.unshift({ token: json.tracking_token, code: json.code, merchant: merchant.name, at: Date.now() });
        localStorage.setItem('lc-pedidos', JSON.stringify(list.slice(0, 10)));
      } catch {}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    if (created) onSent();
    onClose();
  };

  const trackUrl = created ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pedido/${created.token}` : '';
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    created ? buildMessage({ code: created.code, link: trackUrl }) : buildMessage()
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Cerrar" onClick={close} className="absolute inset-0 bg-tinta-900/40 backdrop-blur-sm" />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[32px] bg-cal-50 px-5 pt-3 shadow-lift">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cal-300" />

        {created ? (
          /* ---------- Repartidor solicitado ---------- */
          <div className="pb-4 text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-laguna-400/30" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-laguna-100 text-4xl">🛵</span>
            </div>
            <h3 className="heading mt-4 text-2xl">¡Buscando repartidor!</h3>
            <p className="mt-1 text-sm text-tinta-500">
              Avisamos a los repartidores de Lagunillas. Tu código es <b className="text-tinta-900">{created.code}</b>.
            </p>
            <div className="mt-4 rounded-2xl bg-white p-3 text-left text-sm ring-1 ring-cal-200">
              <div className="flex justify-between"><span className="text-tinta-500">Productos</span><span className="font-semibold">{formatPrice(created.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-tinta-500">Delivery</span><span className="font-semibold">{formatPrice(created.fee)}</span></div>
              <div className="mt-1 flex justify-between border-t border-cal-200 pt-1"><span className="font-semibold">Total</span><span className="font-extrabold">{formatPrice(Number(created.subtotal) + Number(created.fee))}</span></div>
            </div>
            <p className="mt-4 text-sm font-semibold text-tinta-700">Último paso: envía tu pedido al comercio</p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#25d366] to-[#128c7e] py-4 text-base font-bold text-white shadow-[0_12px_40px_-8px_rgba(37,211,102,0.55)] transition active:scale-[0.98]"
            >
              <WhatsAppIcon /> Enviar pedido por WhatsApp
            </a>
            <Link href={`/pedido/${created.token}`} onClick={() => onSent()} className="btn-ghost mt-3 w-full py-3">
              Seguir mi pedido
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="heading text-2xl">Tu pedido</h3>
              <button onClick={onClose} className="rounded-full p-2 text-tinta-500 hover:bg-cal-200" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-tinta-500">{merchant.name}</p>

            {!open && (
              <p className="mt-3 rounded-2xl border border-ocre-400/40 bg-ocre-100 px-3 py-2 text-xs text-ocre-600">
                Este comercio está cerrado ahora. Puedes enviar el pedido y te responderán al abrir.
              </p>
            )}

            <ul className="mt-4 space-y-2">
              {items.map(({ product, qty, price }) => (
                <li key={product.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 pl-3.5 ring-1 ring-cal-200">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-tinta-900">{product.title}</p>
                    <p className="text-xs text-tinta-400">{formatPrice(price)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onQty(product.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-cal-200 text-tinta-600 active:scale-90" aria-label="Quitar uno">
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums text-tinta-900">{qty}</span>
                    <button onClick={() => onQty(product.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-laguna-600 text-white active:scale-90" aria-label="Agregar uno">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="w-16 text-right text-sm font-bold tabular-nums text-laguna-600">{formatPrice(qty * price)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-cal-200 p-1">
              {([
                ['delivery', 'A domicilio', Bike],
                ['pickup', 'Retiro en local', Store],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
                    mode === key ? 'bg-white text-tinta-900 shadow-soft' : 'text-tinta-500'
                  )}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>

            {mode === 'delivery' && (
              <button
                type="button"
                onClick={() => setWantsDriver((v) => !v)}
                className={cn(
                  'mt-3 flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition',
                  wantsDriver ? 'border-laguna-400 bg-laguna-50' : 'border-cal-300 bg-white'
                )}
                aria-pressed={wantsDriver}
              >
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl', wantsDriver ? 'bg-laguna-100' : 'bg-cal-100')}>🛵</span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-tinta-900">Quiero que venga un delivery</span>
                  <span className="block text-xs text-tinta-500">
                    Un repartidor de Lagunillas Central lo busca y te lo trae · {formatPrice(deliveryFee)}
                  </span>
                </span>
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', wantsDriver ? 'border-laguna-600 bg-laguna-600 text-white' : 'border-cal-300')}>
                  {wantsDriver && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="o-name">Tu nombre{useDriver ? ' *' : ''}</label>
                <input id="o-name" className="input" placeholder="Ej: María Rangel" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              {useDriver && (
                <div>
                  <label className="label" htmlFor="o-phone">Tu teléfono *</label>
                  <input id="o-phone" className="input" inputMode="tel" placeholder="0414-1234567" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                </div>
              )}
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
              <input tabIndex={-1} aria-hidden autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
            </div>

            <div className="mt-4 space-y-1 rounded-2xl border border-cal-300 bg-white px-4 py-3 text-sm">
              <div className="flex justify-between text-tinta-500"><span>Productos</span><span className="tabular-nums">{formatPrice(total)}</span></div>
              {useDriver && <div className="flex justify-between text-tinta-500"><span>Delivery</span><span className="tabular-nums">{formatPrice(deliveryFee)}</span></div>}
              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-tinta-700">Total</span>
                <span className="text-xl font-extrabold tabular-nums text-tinta-900">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            {error && <p className="mt-3 rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">{error}</p>}

            {useDriver ? (
              <button
                onClick={requestDriver}
                disabled={sending}
                className="mb-4 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-laguna-500 to-laguna-700 py-4 text-base font-bold text-white shadow-jade transition active:scale-[0.98] disabled:opacity-60"
              >
                {sending ? <Loader2 size={20} className="animate-spin" /> : '🛵'} Pedir repartidor y continuar
              </button>
            ) : (
              <a
                href={valid ? waHref : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!valid}
                onClick={(e) => {
                  if (!valid) return e.preventDefault();
                  remember();
                  setTimeout(() => {
                    onSent();
                    onClose();
                  }, 400);
                }}
                className={cn(
                  'mb-4 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition active:scale-[0.98]',
                  valid ? 'bg-gradient-to-r from-[#25d366] to-[#128c7e] shadow-[0_12px_40px_-8px_rgba(37,211,102,0.55)]' : 'cursor-not-allowed bg-cal-200 text-tinta-400'
                )}
              >
                <WhatsAppIcon /> Enviar pedido por WhatsApp
              </a>
            )}
            {!valid && mode === 'delivery' && !useDriver && (
              <p className="-mt-2 mb-4 text-center text-xs text-tinta-400">Escribe tu dirección para continuar</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
