import type { Merchant, PlanId } from './types';

/**
 * Membresías de los comercios.
 * IMPORTANTE: los límites reales se aplican en la base de datos (schema.sql → plan_limits).
 * Si cambias algo aquí, cámbialo también allí.
 */
export interface PlanInfo {
  id: PlanId;
  name: string;
  tagline: string;
  maxProducts: number;
  maxDeals: number;
  cover: boolean;
  featured: boolean;
  perks: string[];
}

export const PLANS: Record<PlanId, PlanInfo> = {
  gratis: {
    id: 'gratis',
    name: 'Gratis',
    tagline: 'Para empezar a vender',
    maxProducts: 10,
    maxDeals: 0,
    cover: false,
    featured: false,
    perks: ['Aparece en el directorio', 'Hasta 10 productos con foto', 'Pedidos por WhatsApp', 'Repartidores de la app'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para crecer en el pueblo',
    maxProducts: 60,
    maxDeals: 2,
    cover: true,
    featured: false,
    perks: ['Todo lo de Gratis', 'Hasta 60 productos', '2 ofertas flash a la vez', 'Foto de portada'],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Para ser el primero que ven',
    maxProducts: 1000,
    maxDeals: 6,
    cover: true,
    featured: true,
    perks: ['Todo lo de Pro', 'Productos ilimitados', '6 ofertas flash a la vez', 'Destacado ⭐ y primero en la lista'],
  },
};

/** Plan vigente: si venció, vuelve a Gratis */
export function effectivePlan(m: Pick<Merchant, 'plan' | 'plan_expires_at'>): PlanId {
  if (m.plan !== 'gratis' && (!m.plan_expires_at || new Date(m.plan_expires_at).getTime() > Date.now())) return m.plan;
  return 'gratis';
}

export function daysLeft(expires: string | null) {
  if (!expires) return null;
  return Math.ceil((new Date(expires).getTime() - Date.now()) / 864e5);
}
