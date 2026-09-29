'use client';

/**
 * Operaciones del panel de comercios.
 * Con Supabase configurado escribe en la base de datos (protegida por RLS);
 * sin Supabase funciona en memoria con los datos de demostración.
 */
import { getBrowserClient } from './supabase-browser';
import { DEMO_MERCHANTS, DEMO_PRODUCTS, demoFlashDeals } from './demo-data';
import type { FlashDeal, Merchant, Product } from './types';
import { slugify } from './utils';

export type MerchantInput = Pick<
  Merchant,
  'name' | 'category' | 'whatsapp_number' | 'description' | 'address' | 'opens_at' | 'closes_at' | 'logo_url'
>;
export type ProductInput = Pick<Product, 'title' | 'description' | 'price' | 'image_url' | 'is_available'>;

export interface AdminState {
  email: string;
  merchant: Merchant | null;
  products: Product[];
  deals: FlashDeal[];
}

export interface AdminStore {
  demo: boolean;
  load(): Promise<AdminState | null>;
  saveMerchant(current: Merchant | null, input: MerchantInput): Promise<Merchant>;
  addProduct(merchantId: string, input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  addDeal(merchantId: string, productId: string, discount: number, expiresAt: string): Promise<FlashDeal>;
  endDeal(id: string): Promise<void>;
  signOut(): Promise<void>;
}

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()));

/* ---------------- DEMO ---------------- */
function demoStore(): AdminStore {
  const merchant = { ...DEMO_MERCHANTS[1] };
  let products = DEMO_PRODUCTS.filter((p) => p.merchant_id === merchant.id).map((p) => ({ ...p }));
  let deals: FlashDeal[] = demoFlashDeals()
    .filter((d) => d.merchant_id === merchant.id)
    .map(({ product, merchant: _m, ...d }) => d);
  let current: Merchant = merchant;

  return {
    demo: true,
    async load() {
      return { email: 'demo@lagunillas.app', merchant: current, products, deals };
    },
    async saveMerchant(_c, input) {
      current = { ...current, ...input };
      return current;
    },
    async addProduct(merchantId, input) {
      const p: Product = { id: uid(), merchant_id: merchantId, created_at: new Date().toISOString(), ...input };
      products = [...products, p];
      return p;
    },
    async updateProduct(id, input) {
      products = products.map((p) => (p.id === id ? { ...p, ...input } : p));
      return products.find((p) => p.id === id)!;
    },
    async deleteProduct(id) {
      products = products.filter((p) => p.id !== id);
    },
    async addDeal(merchantId, productId, discount, expiresAt) {
      const d: FlashDeal = {
        id: uid(),
        merchant_id: merchantId,
        product_id: productId,
        discount_price: discount,
        expires_at: expiresAt,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      deals = [...deals, d];
      return d;
    },
    async endDeal(id) {
      deals = deals.map((d) => (d.id === id ? { ...d, is_active: false } : d));
    },
    async signOut() {},
  };
}

/* ---------------- SUPABASE ---------------- */
function supabaseStore(): AdminStore {
  const sb = getBrowserClient()!;
  const must = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  };

  return {
    demo: false,
    async load() {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return null;
      const merchant = must(await sb.from('merchants').select('*').eq('user_id', user.id).limit(1).maybeSingle()) as Merchant | null;
      if (!merchant) return { email: user.email ?? '', merchant: null, products: [], deals: [] };
      const [products, deals] = await Promise.all([
        sb.from('products').select('*').eq('merchant_id', merchant.id).order('created_at'),
        sb.from('flash_deals').select('*').eq('merchant_id', merchant.id).order('created_at', { ascending: false }),
      ]);
      return {
        email: user.email ?? '',
        merchant,
        products: must(products) as Product[],
        deals: must(deals) as FlashDeal[],
      };
    },
    async saveMerchant(current, input) {
      if (current) {
        return must(await sb.from('merchants').update(input).eq('id', current.id).select().single()) as Merchant;
      }
      const {
        data: { user },
      } = await sb.auth.getUser();
      const base = slugify(input.name) || 'comercio';
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      return must(
        await sb.from('merchants').insert({ ...input, user_id: user!.id, slug, is_active: true }).select().single()
      ) as Merchant;
    },
    async addProduct(merchantId, input) {
      return must(await sb.from('products').insert({ ...input, merchant_id: merchantId }).select().single()) as Product;
    },
    async updateProduct(id, input) {
      return must(await sb.from('products').update(input).eq('id', id).select().single()) as Product;
    },
    async deleteProduct(id) {
      must(await sb.from('products').delete().eq('id', id));
    },
    async addDeal(merchantId, productId, discount, expiresAt) {
      return must(
        await sb
          .from('flash_deals')
          .insert({ merchant_id: merchantId, product_id: productId, discount_price: discount, expires_at: expiresAt })
          .select()
          .single()
      ) as FlashDeal;
    },
    async endDeal(id) {
      must(await sb.from('flash_deals').update({ is_active: false }).eq('id', id));
    },
    async signOut() {
      await sb.auth.signOut();
    },
  };
}

export function createAdminStore(): AdminStore {
  return getBrowserClient() ? supabaseStore() : demoStore();
}
