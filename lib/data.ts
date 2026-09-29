/**
 * Lectura de datos públicos.
 * Si Supabase está configurado lee de la base de datos; si no, usa los datos de demostración.
 */
import { getPublicClient } from './supabase';
import { DEMO_MERCHANTS, DEMO_PRODUCTS, demoFlashDeals } from './demo-data';
import type { FlashDealFull, Merchant, Product } from './types';

export async function getMerchants(): Promise<Merchant[]> {
  const sb = getPublicClient();
  if (!sb) return DEMO_MERCHANTS;
  const { data, error } = await sb
    .from('merchants')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('name');
  if (error) {
    console.error('[getMerchants]', error.message);
    return [];
  }
  return data as Merchant[];
}

export async function getMerchantBySlug(slug: string): Promise<{ merchant: Merchant; products: Product[] } | null> {
  const sb = getPublicClient();
  if (!sb) {
    const merchant = DEMO_MERCHANTS.find((m) => m.slug === slug);
    if (!merchant) return null;
    return { merchant, products: DEMO_PRODUCTS.filter((p) => p.merchant_id === merchant.id) };
  }
  const { data: merchant } = await sb.from('merchants').select('*').eq('slug', slug).maybeSingle();
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
  if (!sb) {
    const deals = demoFlashDeals();
    return merchantId ? deals.filter((d) => d.merchant_id === merchantId) : deals;
  }
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
