import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-10 w-10', className)} aria-hidden>
      <defs>
        <linearGradient id="lc-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3ee2cc" />
          <stop offset="1" stopColor="#1e6edc" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#lc-g)" />
      <path
        d="M20 8.5c-4.4 0-7.8 3.3-7.8 7.6 0 5.4 6.4 11.4 7.1 12a1 1 0 0 0 1.4 0c.7-.6 7.1-6.6 7.1-12 0-4.3-3.4-7.6-7.8-7.6Z"
        fill="#090d16"
      />
      <circle cx="20" cy="16" r="3.2" fill="#7ef0e0" />
      <path d="M9.5 32.2c2.2-1.8 4.4-1.8 6.6 0s4.4 1.8 6.6 0 4.4-1.8 6.6 0" stroke="#090d16" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <div className="leading-none">
        <p className="text-[17px] font-extrabold tracking-tight text-white">
          Lagunillas <span className="text-gradient">Central</span>
        </p>
      </div>
    </div>
  );
}
