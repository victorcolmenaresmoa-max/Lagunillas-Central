'use client';

import Link from 'next/link';
import { Flame, Timer, ChevronRight, Zap } from 'lucide-react';
import type { FlashDealFull } from '@/lib/types';
import { useCountdown, pad2 } from '@/lib/useCountdown';
import { styleFor } from '@/lib/categories';
import { cn, formatPrice } from '@/lib/utils';

function discountPct(price: number, deal: number) {
  if (!price) return 0;
  return Math.round((1 - deal / price) * 100);
}

function TimeBox({ value, label, hot }: { value: number; label: string; hot: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span
        suppressHydrationWarning
        className={cn(
          'min-w-[46px] rounded-xl border px-2 py-1.5 text-center text-xl font-extrabold tabular-nums',
          hot ? 'border-orange-400/40 bg-orange-500/15 text-orange-200' : 'border-white/15 bg-black/25 text-white'
        )}
      >
        {pad2(value)}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">{label}</span>
    </div>
  );
}

function FeaturedDeal({ deal }: { deal: FlashDealFull }) {
  const { hours, minutes, seconds, urgent, expired } = useCountdown(deal.expires_at);
  const pct = discountPct(deal.product.price, deal.discount_price);
  const { icon: Icon } = styleFor(deal.merchant.category);
  if (expired) return null;

  return (
    <Link
      href={`/comercio/${deal.merchant.slug}`}
      className="group relative block overflow-hidden rounded-[28px] p-[1.5px] shadow-glow-hot transition active:scale-[0.98]"
    >
      {/* borde animado */}
      <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,#fb713c,#f43f5e,#fbbf24,#fb713c)] bg-[length:200%_100%]" />
      <div className="relative overflow-hidden rounded-[27px] bg-gradient-to-br from-[#2a1210] via-[#1a0f1a] to-ink-900 p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-orange-500/25 blur-3xl" />
        <Icon className="pointer-events-none absolute -bottom-4 -right-3 h-32 w-32 rotate-[-12deg] text-white/[0.04]" />

        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
            <Flame size={13} className="animate-pulse" /> Drop del momento
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-sm font-black text-rose-600">-{pct}%</span>
        </div>

        <h3 className="relative mt-4 text-2xl font-extrabold leading-tight text-white">{deal.product.title}</h3>
        <p className="relative mt-1 text-sm text-white/70">en {deal.merchant.name}</p>

        <div className="relative mt-4 flex items-end gap-3">
          <span className="text-4xl font-black tracking-tight text-white">{formatPrice(deal.discount_price)}</span>
          <span className="mb-1.5 text-base font-semibold text-white/45 line-through">{formatPrice(deal.product.price)}</span>
        </div>

        <div className="relative mt-5 flex items-end justify-between">
          <div>
            <p className={cn('mb-2 flex items-center gap-1.5 text-xs font-semibold', urgent ? 'text-orange-300' : 'text-white/70')}>
              <Timer size={14} /> {urgent ? '¡Se acaba ya!' : 'Termina en'}
            </p>
            <div className="flex gap-1.5">
              <TimeBox value={hours} label="hrs" hot={urgent} />
              <TimeBox value={minutes} label="min" hot={urgent} />
              <TimeBox value={seconds} label="seg" hot={urgent} />
            </div>
          </div>
          <span className="flex h-12 w-12 animate-pulse-ring items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white transition group-hover:translate-x-0.5">
            <ChevronRight size={24} strokeWidth={2.5} />
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
      className="glass flex w-[72%] shrink-0 snap-start items-center gap-3 rounded-3xl p-3 transition active:scale-[0.97]"
    >
      <div className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br', gradient)}>
        <Icon size={24} className="text-white" />
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white ring-2 ring-ink-950">
          -{pct}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{deal.product.title}</p>
        <p className="truncate text-xs text-slate-400">{deal.merchant.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-extrabold text-laguna-300">{formatPrice(deal.discount_price)}</span>
          <span suppressHydrationWarning className={cn('text-[11px] font-semibold tabular-nums', urgent ? 'text-orange-300' : 'text-slate-500')}>
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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-white">
          <Zap size={18} className="fill-orange-400 text-orange-400" /> Flash Deals
        </h2>
        <span className="text-xs font-medium text-slate-500">Por tiempo limitado</span>
      </div>
      <FeaturedDeal deal={first} />
      {rest.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {rest.map((d) => (
            <MiniDeal key={d.id} deal={d} />
          ))}
        </div>
      )}
    </section>
  );
}
