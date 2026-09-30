import { cn } from '@/lib/utils';

/** Ícono de la app: el arco de bienvenida con la laguna y los cerros */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.webp"
      alt=""
      aria-hidden
      width={40}
      height={40}
      draggable={false}
      className={cn('h-10 w-10 select-none rounded-xl bg-[#5b9fd8] object-cover ring-1 ring-black/5', className)}
    />
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
