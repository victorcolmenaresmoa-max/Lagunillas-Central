/**
 * Lectura de datos públicos (lo que ve cualquier visitante).
 * La base de datos solo devuelve comercios aprobados y activos.
 */
import { getPublicClient } from './supabase';
import { effectivePlan } from './plans';
import type { AppSettings, FlashDealFull, Merchant, Product } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  delivery_fee: 1.5,
  admin_whatsapp: null,
  price_pro: 10,
  price_premium: 25,
  updated_at: new Date(0).toISOString(),
};

const rank = (m: Merchant) => {
  const plan = effectivePlan(m);
  return (plan === 'premium' ? 4 : 0) + (m.is_featured ? 2 : 0) + (plan === 'pro' ? 1 : 0);
};

export async function getMerchants(): Promise<Merchant[]> {
  const sb = getPublicClient();
  if (!sb) return [];
  const { data, error } = await sb.from('merchants').select('*').eq('status', 'approved').eq('is_active', true).order('name');
  if (error) {
    console.error('[getMerchants]', error.message);
    return [];
  }
  return (data as Merchant[]).sort((a, b) => rank(b) - rank(a));
}

export async function getMerchantBySlug(slug: string): Promise<{ merchant: Merchant; products: Product[] } | null> {
  const sb = getPublicClient();
  if (!sb) return null;
  const { data: merchant } = await sb.from('merchants').select('*').eq('slug', slug).eq('status', 'approved').maybeSingle();
  if (!merchant) return null;
  const { data: products } = await sb
    .from('products')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('is_available', { ascending: false })
    .order('created_at');
  return { merchant: merchant as Merchant, products: (products ?? []) as Product[] };
}

export async function getActiveFlashDeals(merchantId?: string): Promise<FlashDealFull[]> {
  const sb = getPublicClient();
  if (!sb) return [];
  let q = sb
    .from('flash_deals')
    .select('*, product:products(id,title,price,image_url), merchant:merchants(id,name,slug,category)')
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at');
  if (merchantId) q = q.eq('merchant_id', merchantId);
  const { data, error } = await q;
  if (error) {
    console.error('[getActiveFlashDeals]', error.message);
    return [];
  }
  return (data ?? []).filter((d: any) => d.product && d.merchant) as FlashDealFull[];
}

export async function getSettings(): Promise<AppSettings> {
  const sb = getPublicClient();
  if (!sb) return DEFAULT_SETTINGS;
  const { data } = await sb.from('app_settings').select('*').eq('id', 1).maybeSingle();
  return (data as AppSettings) ?? DEFAULT_SETTINGS;
}
