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
  /** degradado para avatares */
  gradient: string;
  /** etiqueta suave */
  chip: string;
  /** color del cielo en la portada del comercio */
  sky: string;
}

export const ALL_CATEGORY = { label: 'Todos', icon: LayoutGrid } as const;

// Colores tomados del pueblo: tejas, iglesia ocre, laguna, cielo, cerros y vino
export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  Comida: {
    icon: UtensilsCrossed,
    gradient: 'from-ocaso-400 to-teja-500',
    chip: 'text-teja-600 border-teja-400/30 bg-teja-100',
    sky: '#e79a62',
  },
  Bodegones: {
    icon: ShoppingBasket,
    gradient: 'from-ocre-300 to-ocre-500',
    chip: 'text-ocre-600 border-ocre-400/40 bg-ocre-100',
    sky: '#e8c15c',
  },
  Farmacias: {
    icon: Pill,
    gradient: 'from-laguna-400 to-laguna-600',
    chip: 'text-laguna-700 border-laguna-400/30 bg-laguna-100',
    sky: '#6fb89c',
  },
  Repuestos: {
    icon: Wrench,
    gradient: 'from-cielo-400 to-cielo-600',
    chip: 'text-cielo-600 border-cielo-400/30 bg-cielo-100',
    sky: '#5b9fd8',
  },
  Servicios: {
    icon: Briefcase,
    gradient: 'from-monte-400 to-monte-600',
    chip: 'text-monte-600 border-monte-400/30 bg-[#eef3e3]',
    sky: '#94b56a',
  },
  Barberías: {
    icon: Scissors,
    gradient: 'from-[#b9657a] to-[#7a3346]',
    chip: 'text-[#8a3b52] border-[#b9657a]/30 bg-[#f6e3e7]',
    sky: '#c07a8a',
  },
};

export function styleFor(category: string): CategoryStyle {
  return CATEGORY_STYLES[category as Category] ?? CATEGORY_STYLES.Servicios;
}
