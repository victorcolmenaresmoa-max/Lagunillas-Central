'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, X, ChevronRight, Store, SearchX, Sparkles, Clock } from 'lucide-react';
import Logo from './Logo';
import FlashDeals from './FlashDeals';
import InstallPrompt from './InstallPrompt';
import MerchantAvatar from './MerchantAvatar';
import { ALL_CATEGORY, CATEGORY_STYLES, styleFor } from '@/lib/categories';
import { CATEGORIES, type FlashDealFull, type Merchant } from '@/lib/types';
import { cn, formatTime, isOpenNow } from '@/lib/utils';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function HomeClient({ merchants, deals }: { merchants: Merchant[]; deals: FlashDealFull[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('Todos');

  const q = normalize(query.trim());

  const filteredMerchants = useMemo(
    () =>
      merchants.filter((m) => {
        const inCat = category === 'Todos' || m.category === category;
        if (!inCat) return false;
        if (!q) return true;
        return normalize(`${m.name} ${m.category} ${m.description ?? ''} ${m.address ?? ''}`).includes(q);
      }),
    [merchants, category, q]
  );

  const filteredDeals = useMemo(
    () =>
      deals.filter((d) => {
        const inCat = category === 'Todos' || d.merchant.category === category;
        if (!inCat) return false;
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
      {/* ---------- HEADER ---------- */}
      <header className="pt-safe sticky top-0 z-30 border-b border-slate-800/60 bg-ink-950/75 backdrop-blur-xl">
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <Logo />
            <Link
              href="/admin/login"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-ink-850/70 text-slate-300 transition active:scale-95"
              aria-label="Acceso para comercios"
            >
              <Store size={19} />
            </Link>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-laguna-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-laguna-400" />
            </span>
            <MapPin size={13} className="text-laguna-400" />
            <span className="font-semibold text-slate-200">Lagunillas, Mérida</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{merchants.length} comercios</span>
          </div>

          {/* Buscador */}
          <div className="relative mt-3">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca arepas, farmacias, repuestos…"
              className="input h-12 pl-11 pr-11"
              type="search"
              enterKeyHint="search"
              aria-label="Buscar"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800 text-slate-300"
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Categorías */}
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Categorías">
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
                    ? 'border-transparent bg-gradient-to-r from-laguna-400 to-sky-500 text-ink-950 shadow-glow'
                    : 'border-slate-800 bg-ink-850/70 text-slate-300 hover:border-slate-700'
                )}
              >
                <Icon size={15} strokeWidth={2.3} />
                {cat}
                {counts[cat] ? (
                  <span className={cn('text-[11px] font-bold', active ? 'text-ink-950/60' : 'text-slate-500')}>{counts[cat]}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="space-y-7 pt-5">
        {/* Saludo */}
        {!q && category === 'Todos' && (
          <section className="animate-fade-up px-4">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-white">
              Todo Lagunillas,
              <br />
              <span className="text-gradient">en tu bolsillo.</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">Pide por WhatsApp a los comercios de tu municipio.</p>
          </section>
        )}

        {/* Flash deals */}
        <FlashDeals deals={filteredDeals} />

        {/* Directorio */}
        <section className="animate-fade-up px-4" style={{ animationDelay: '200ms' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white">
              {category === 'Todos' ? 'Comercios' : category}
            </h2>
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              {openCount} abiertos ahora
            </span>
          </div>

          {filteredMerchants.length === 0 ? (
            <div className="glass flex flex-col items-center rounded-3xl px-6 py-10 text-center">
              <SearchX size={36} className="text-slate-600" />
              <p className="mt-3 font-semibold text-slate-200">No encontramos resultados</p>
              <p className="mt-1 text-sm text-slate-500">Prueba con otra palabra o categoría.</p>
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

        <footer className="px-4 pt-4 text-center text-xs text-slate-600">
          ¿Tienes un negocio en Lagunillas?{' '}
          <Link href="/admin/login" className="font-semibold text-laguna-400">
            Súmate aquí
          </Link>
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
    <Link
      href={`/comercio/${m.slug}`}
      className="glass group flex items-center gap-3.5 rounded-3xl p-3.5 transition hover:border-slate-700 active:scale-[0.98]"
    >
      <MerchantAvatar name={m.name} category={m.category} logoUrl={m.logo_url} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-white">{m.name}</p>
          {m.is_featured && <Sparkles size={14} className="shrink-0 fill-amber-300 text-amber-300" aria-label="Destacado" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', chip)}>{m.category}</span>
          <span
            suppressHydrationWarning
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
              open ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-700/40 text-slate-400'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', open ? 'bg-emerald-400' : 'bg-slate-500')} />
            {open ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-slate-500">
          <Clock size={11} className="shrink-0" />
          {formatTime(m.opens_at)} – {formatTime(m.closes_at)}
          {m.address ? <span className="truncate"> · {m.address}</span> : null}
        </p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-laguna-400 to-sky-500 text-ink-950 shadow-glow transition group-hover:translate-x-0.5">
        <ChevronRight size={20} strokeWidth={2.6} />
      </span>
    </Link>
  );
}
