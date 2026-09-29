export type Role = 'admin' | 'merchant' | 'client';

export const CATEGORIES = [
  'Comida',
  'Bodegones',
  'Farmacias',
  'Repuestos',
  'Servicios',
  'Barberías',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Merchant {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  category: Category;
  whatsapp_number: string;
  description: string | null;
  address: string | null;
  opens_at: string | null; // "08:00:00"
  closes_at: string | null;
  is_active: boolean;
  is_featured: boolean;
  logo_url: string | null;
  cover_url: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
}

export interface FlashDeal {
  id: string;
  merchant_id: string;
  product_id: string;
  discount_price: number;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

/** Oferta con su producto y comercio ya unidos, lista para mostrar */
export interface FlashDealFull extends FlashDeal {
  product: Pick<Product, 'id' | 'title' | 'price' | 'image_url'>;
  merchant: Pick<Merchant, 'id' | 'name' | 'slug' | 'category'>;
}
