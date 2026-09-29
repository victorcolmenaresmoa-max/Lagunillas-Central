'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, X, ChevronRight, Store, SearchX, Star, Clock } from 'lucide-react';
import Logo from './Logo';
import Landscape from './Landscape';
import FlashDeals from './FlashDeals';
import InstallPrompt from './InstallPrompt';
import MerchantAvatar from './MerchantAvatar';
import { ALL_CATEGORY, CATEGORY_STYLES, styleFor } from '@/lib/categories';
import { CATEGORIES, type FlashDealFull, type Merchant } from '@/lib/types';
import { cn, formatTime, isOpenNow } from '@/lib/utils';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', hour: '2-digit', hour12: false }).format(new Date())
  ) % 24;
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function HomeClient({ merchants, deals }: { merchants: Merchant[]; deals: FlashDealFull[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('Todos');
  const [hello, setHello] = useState('Hola');
  useEffect(() => setHello(greeting()), []);

  const q = normalize(query.trim());

  const filteredMerchants = useMemo(
    () =>
      merchants.filter((m) => {
        if (category !== 'Todos' && m.category !== category) return false;
        if (!q) return true;
        return normalize(`${m.name} ${m.category} ${m.description ?? ''} ${m.address ?? ''}`).includes(q);
      }),
    [merchants, category, q]
  );

  const filteredDeals = useMemo(
    () =>
      deals.filter((d) => {
        if (category !== 'Todos' && d.merchant.category !== category) return false;
        if (!q) return true;
        return normalize(`${d.product.title} ${d.merchant.name}`).includes(q);
      }),
    [deals, category, q]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { Todos: merchants.length };
    merchants.forEach((m) => (c[m.category] = (c[m.category] ?? 0) + 1));
    return c;
  }, [merchants]);

  const openCount = filteredMerchants.filter(isOpenNow).length;

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-40">
      {/* ---------- PORTADA: el pueblo entre cerros y laguna ---------- */}
      <header className="relative h-[330px] overflow-hidden bg-[#5b9fd8]">
        {/* el paisaje ocupa la parte baja; arriba queda cielo limpio para el texto */}
        <Landscape className="absolute inset-x-0 bottom-0 !h-[230px]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cal-100" />

        <div className="pt-safe relative px-4 pt-4">
          <div className="flex items-center justify-between">
            <Logo light className="[&_p:first-child]:drop-shadow-sm" />
            <Link
              href="/admin/login"
              className="flex h-10 items-center gap-1.5 rounded-2xl bg-white/25 px-3 text-xs font-semibold text-white ring-1 ring-white/40 backdrop-blur-md transition active:scale-95"
              aria-label="Acceso para comercios"
            >
              <Store size={16} /> Comercios
            </Link>
          </div>

          <div className="mt-6 animate-fade-up">
            <p className="text-sm font-semibold text-white/90 drop-shadow-sm">
              {hello} 👋
            </p>
            <h1 className="heading mt-1 text-[32px] leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(23,36,33,0.25)]">
              Todo Lagunillas,
              <br />
              <em className="font-medium">en tu bolsillo.</em>
            </h1>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cielo-600/45 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur-md">
              <MapPin size={13} /> Lagunillas, Mérida · {merchants.length} comercios
            </p>
          </div>
        </div>
      </header>

      {/* ---------- BUSCADOR + CATEGORÍAS (se queda arriba al bajar) ---------- */}
      <div className="pt-safe sticky top-0 z-30 -mt-10 bg-gradient-to-b from-cal-100 via-cal-100/95 to-cal-100/0 pb-2 backdrop-blur-[2px]">
        <div className="px-4 pt-2">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca arepas, farmacias, repuestos…"
              className="input h-[52px] rounded-[20px] border-white pl-11 pr-11 shadow-lift"
              type="search"
              enterKeyHint="search"
              aria-label="Buscar"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-cal-200 text-tinta-600"
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Categorías">
          {['Todos', ...CATEGORIES].map((cat) => {
            const Icon = cat === 'Todos' ? ALL_CATEGORY.icon : CATEGORY_STYLES[cat as keyof typeof CATEGORY_STYLES].icon;
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all active:scale-95',
                  active
                    ? 'border-transparent bg-laguna-600 text-white shadow-jade'
                    : 'border-cal-300 bg-cal-50 text-tinta-600 hover:border-tinta-400/40'
                )}
              >
                <Icon size={15} strokeWidth={2.3} />
                {cat}
                {counts[cat] ? (
                  <span className={cn('text-[11px] font-bold', active ? 'text-white/70' : 'text-tinta-400')}>{counts[cat]}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-8 pt-4">
        <FlashDeals deals={filteredDeals} />

        {/* ---------- DIRECTORIO ---------- */}
        <section className="animate-fade-up px-4" style={{ animationDelay: '200ms' }}>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="heading text-[22px]">{category === 'Todos' ? 'Comercios del pueblo' : category}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-laguna-100 px-2.5 py-1 text-[11px] font-semibold text-laguna-700">
              <span className="h-1.5 w-1.5 rounded-full bg-laguna-500" />
              {openCount} abiertos
            </span>
          </div>

          {filteredMerchants.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-10 text-center">
              <SearchX size={36} className="text-tinta-400" />
              <p className="mt-3 font-semibold text-tinta-900">No encontramos resultados</p>
              <p className="mt-1 text-sm text-tinta-500">Prueba con otra palabra o categoría.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('Todos');
                }}
                className="btn-ghost mt-4 text-sm"
              >
                Ver todo
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredMerchants.map((m, i) => (
                <li key={m.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40 + 220}ms` }}>
                  <MerchantCard merchant={m} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- PIE ---------- */}
        <footer className="relative mx-4 overflow-hidden rounded-[28px]">
          <Landscape variant="ocaso" className="absolute inset-0" />
          <div className="absolute inset-0 bg-ocaso-800/55" />
          <div className="relative px-5 py-6 text-center">
            <p className="heading text-xl text-white">¿Tienes un negocio en Lagunillas?</p>
            <p className="mt-1 text-sm text-white/85">Que todo el pueblo te encuentre y te pida por WhatsApp.</p>
            <Link href="/admin/login" className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-cal-50 px-4 py-2.5 text-sm font-bold text-ocaso-600 shadow-lift active:scale-95">
              Súmate aquí <ChevronRight size={16} />
            </Link>
          </div>
        </footer>
      </div>

      <InstallPrompt />
    </main>
  );
}

function MerchantCard({ merchant: m }: { merchant: Merchant }) {
  const open = isOpenNow(m);
  const { chip } = styleFor(m.category);
  return (
    <Link href={`/comercio/${m.slug}`} className="card group flex items-center gap-3.5 p-3.5 transition hover:shadow-lift active:scale-[0.98]">
      <MerchantAvatar name={m.name} category={m.category} logoUrl={m.logo_url} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-tinta-900">{m.name}</p>
          {m.is_featured && <Star size={13} className="shrink-0 fill-ocre-400 text-ocre-400" aria-label="Destacado" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', chip)}>{m.category}</span>
          <span
            suppressHydrationWarning
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
              open ? 'bg-laguna-100 text-laguna-700' : 'bg-cal-200 text-tinta-500'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', open ? 'bg-laguna-500' : 'bg-tinta-400')} />
            {open ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-tinta-500">
          <Clock size={11} className="shrink-0" />
          {formatTime(m.opens_at)} – {formatTime(m.closes_at)}
          {m.address ? <span className="truncate"> · {m.address}</span> : null}
        </p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-laguna-50 text-laguna-600 ring-1 ring-laguna-200 transition group-hover:translate-x-0.5 group-hover:bg-laguna-600 group-hover:text-white">
        <ChevronRight size={20} strokeWidth={2.6} />
      </span>
    </Link>
  );
}
