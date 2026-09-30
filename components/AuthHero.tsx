'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Landscape from './Landscape';
import { LogoMark } from './Logo';

/** Cabecera con paisaje para las pantallas de acceso */
export default function AuthHero({
  title,
  subtitle,
  back = '/',
  onBack,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: string;
  onBack?: () => void;
}) {
  const cls =
    'inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30 text-white ring-1 ring-white/40 backdrop-blur-md transition active:scale-90';
  return (
    <>
      <div className="relative h-[230px] overflow-hidden bg-[#5b9fd8]">
        <Landscape className="absolute inset-x-0 bottom-0 !h-[200px]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-cal-100" />
        <div className="pt-safe relative px-5 pt-4">
          {onBack ? (
            <button onClick={onBack} className={cls} aria-label="Volver">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <Link href={back} className={cls} aria-label="Volver">
              <ArrowLeft size={20} />
            </Link>
          )}
        </div>
      </div>
      <div className="relative -mt-20 flex animate-fade-up flex-col items-center px-5 text-center">
        <LogoMark className="h-16 w-16 rounded-2xl shadow-lift ring-4 ring-cal-100" />
        <h1 className="heading mt-4 text-[30px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[300px] text-sm text-tinta-500">{subtitle}</p>}
      </div>
    </>
  );
}
