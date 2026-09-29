import { styleFor } from '@/lib/categories';
import { cn } from '@/lib/utils';

interface Props {
  name: string;
  category: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-14 w-14 rounded-2xl',
  lg: 'h-16 w-16 rounded-2xl',
  xl: 'h-24 w-24 rounded-[28px]',
};
const iconSizes = { sm: 18, md: 24, lg: 28, xl: 40 };

export default function MerchantAvatar({ name, category, logoUrl, size = 'md', className }: Props) {
  const { gradient, icon: Icon } = styleFor(category);
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} className={cn(sizes[size], 'shrink-0 object-cover ring-1 ring-white/10', className)} />;
  }
  return (
    <div
      className={cn(
        sizes[size],
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br ring-1 ring-white/10',
        gradient,
        className
      )}
      aria-label={name}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
      <Icon size={iconSizes[size]} className="relative text-white drop-shadow" strokeWidth={2.2} />
    </div>
  );
}
