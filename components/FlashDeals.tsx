'use client';

import Link from 'next/link';
import { Sunset, Timer, ArrowRight } from 'lucide-react';
import type { FlashDealFull } from '@/lib/types';
import { useCountdown, pad2 } from '@/lib/useCountdown';
import { styleFor } from '@/lib/categories';
import { cn, formatPrice } from '@/lib/utils';
import Landscape from './Landscape';

function discountPct(price: number, deal: number) {
  if (!price) return 0;
  return Math.round((1 - deal / price) * 100);
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        suppressHydrationWarning
        className="min-w-[44px] rounded-xl bg-white/20 px-2 py-1.5 text-center text-xl font-extrabold tabular-nums text-white ring-1 ring-white/30 backdrop-blur-sm"
      >
        {pad2(value)}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/75">{label}</span>
    </div>
  );
}

/** Oferta principal: una tarjeta con el atardecer sobre la laguna */
function FeaturedDeal({ deal }: { deal: FlashDealFull }) {
  const { hours, minutes, seconds, urgent, expired } = useCountdown(deal.expires_at);
  const pct = discountPct(deal.product.price, deal.discount_price);
  if (expired) return null;

  return (
    <Link
      href={`/comercio/${deal.merchant.slug}`}
      className="group relative block overflow-hidden rounded-[30px] shadow-ocaso transition active:scale-[0.98]"
    >
      <Landscape variant="ocaso" className="absolute inset-0" />
      {/* velo para que el texto se lea bien */}
      <div className="absolute inset-0 bg-gradient-to-r from-ocaso-800/85 via-ocaso-800/45 to-transparent" />

      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white ring-1 ring-white/30 backdrop-blur-sm">
            <Sunset size={13} /> Oferta del atardecer
          </span>
          <span className="rounded-full bg-cal-50 px-2.5 py-1 text-sm font-black text-teja-600 shadow-soft">-{pct}%</span>
        </div>

        <h3 className="heading mt-5 text-[28px] leading-[1.05] text-white drop-shadow-sm">{deal.product.title}</h3>
        <p className="mt-1 text-sm font-medium text-white/85">en {deal.merchant.name}</p>

        <div className="mt-3 flex items-end gap-3">
          <span className="text-4xl font-black tracking-tight text-white drop-shadow-sm">{formatPrice(deal.discount_price)}</span>
          <span className="mb-1.5 text-base font-semibold text-white/60 line-through">{formatPrice(deal.product.price)}</span>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/90">
              <Timer size={14} /> {urgent ? '¡Se acaba ya!' : 'Termina en'}
            </p>
            <div className="flex gap-1.5">
              <TimeBox value={hours} label="hrs" />
              <TimeBox value={minutes} label="min" />
              <TimeBox value={seconds} label="seg" />
            </div>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cal-50 text-ocaso-600 shadow-lift transition group-hover:translate-x-0.5">
            <ArrowRight size={22} strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function MiniDeal({ deal }: { deal: FlashDealFull }) {
  const { hours, minutes, seconds, urgent, expired } = useCountdown(deal.expires_at);
  const pct = discountPct(deal.product.price, deal.discount_price);
  const { gradient, icon: Icon } = styleFor(deal.merchant.category);
  if (expired) return null;
  return (
    <Link
      href={`/comercio/${deal.merchant.slug}`}
      className="card flex w-[74%] shrink-0 snap-start items-center gap-3 p-3 transition active:scale-[0.97]"
    >
      <div className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br', gradient)}>
        <Icon size={24} className="text-white" />
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-teja-500 px-1.5 py-0.5 text-[10px] font-black text-white ring-2 ring-cal-50">
          -{pct}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-tinta-900">{deal.product.title}</p>
        <p className="truncate text-xs text-tinta-500">{deal.merchant.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-extrabold text-ocaso-600">{formatPrice(deal.discount_price)}</span>
          <span suppressHydrationWarning className={cn('text-[11px] font-semibold tabular-nums', urgent ? 'text-teja-500' : 'text-tinta-400')}>
            ⏱ {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function FlashDeals({ deals }: { deals: FlashDealFull[] }) {
  if (deals.length === 0) return null;
  const [first, ...rest] = deals;
  return (
    <section className="animate-fade-up px-4" style={{ animationDelay: '120ms' }}>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="heading text-[22px]">Ofertas flash</h2>
        <span className="text-xs font-medium text-tinta-400">Por tiempo limitado</span>
      </div>
      <FeaturedDeal deal={first} />
      {rest.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 pt-1">
          {rest.map((d) => (
            <MiniDeal key={d.id} deal={d} />
          ))}
        </div>
      )}
    </section>
  );
}
