import { cn } from '@/lib/utils';

/** Ícono: el cerro reflejado en la laguna bajo el sol */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-10 w-10', className)} aria-hidden>
      <defs>
        <linearGradient id="lc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b9fd8" />
          <stop offset="1" stopColor="#c3dcf1" />
        </linearGradient>
        <linearGradient id="lc-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f8a6d" />
          <stop offset="1" stopColor="#1b5646" />
        </linearGradient>
        <clipPath id="lc-clip">
          <rect width="40" height="40" rx="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#lc-clip)">
        <rect width="40" height="40" fill="url(#lc-sky)" />
        <circle cx="29" cy="11" r="4.2" fill="#efcd6b" />
        <path d="M0 25 L9 17 L14 20 L21 11 L29 19 L34 16 L40 21 L40 25 Z" fill="#557535" />
        <rect y="25" width="40" height="15" fill="url(#lc-water)" />
        <path d="M0 25 L9 33 L14 30 L21 39 L29 31 L34 34 L40 29 L40 25 Z" fill="#557535" opacity="0.35" />
        <path d="M6 30 H13 M24 34 H32" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      </g>
      <rect x="0.5" y="0.5" width="39" height="39" rx="11.5" fill="none" stroke="rgba(23,36,33,0.08)" />
    </svg>
  );
}

export default function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="shadow-soft rounded-xl" />
      <div className="leading-none">
        <p className={cn('heading text-[21px] leading-none', light && 'text-white')}>Lagunillas</p>
        <p className={cn('mt-0.5 text-[10px] font-bold uppercase tracking-[0.32em]', light ? 'text-ocre-200' : 'text-teja-500')}>
          Central
        </p>
      </div>
    </div>
  );
}
