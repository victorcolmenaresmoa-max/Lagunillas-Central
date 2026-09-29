import {
  LayoutGrid,
  UtensilsCrossed,
  ShoppingBasket,
  Pill,
  Wrench,
  Briefcase,
  Scissors,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from './types';

export interface CategoryStyle {
  icon: LucideIcon;
  /** degradado para avatares y portadas */
  gradient: string;
  /** color del texto/borde de la etiqueta */
  chip: string;
}

export const ALL_CATEGORY = { label: 'Todos', icon: LayoutGrid } as const;

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  Comida: {
    icon: UtensilsCrossed,
    gradient: 'from-orange-500 via-rose-500 to-pink-600',
    chip: 'text-orange-300 border-orange-400/30 bg-orange-400/10',
  },
  Bodegones: {
    icon: ShoppingBasket,
    gradient: 'from-amber-400 via-yellow-500 to-lime-500',
    chip: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  },
  Farmacias: {
    icon: Pill,
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    chip: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  },
  Repuestos: {
    icon: Wrench,
    gradient: 'from-slate-400 via-slate-500 to-blue-600',
    chip: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
  },
  Servicios: {
    icon: Briefcase,
    gradient: 'from-indigo-400 via-violet-500 to-purple-600',
    chip: 'text-violet-300 border-violet-400/30 bg-violet-400/10',
  },
  Barberías: {
    icon: Scissors,
    gradient: 'from-fuchsia-500 via-purple-500 to-indigo-600',
    chip: 'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/10',
  },
};

export function styleFor(category: string): CategoryStyle {
  return CATEGORY_STYLES[category as Category] ?? CATEGORY_STYLES.Servicios;
}
