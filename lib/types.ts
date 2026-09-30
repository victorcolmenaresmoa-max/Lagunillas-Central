export type Role = 'admin' | 'merchant' | 'delivery' | 'client';

export const CATEGORIES = ['Comida', 'Bodegones', 'Farmacias', 'Repuestos', 'Servicios', 'Barberías'] as const;
export type Category = (typeof CATEGORIES)[number];

export type PlanId = 'gratis' | 'pro' | 'premium';
export type ApprovalStatus = 'pending' | 'approved' | 'suspended';

export interface Profile {
  id: string;
  user_id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

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
  status: ApprovalStatus;
  plan: PlanId;
  plan_expires_at: string | null;
  approved_at: string | null;
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

export type Vehicle = 'moto' | 'carro' | 'bicicleta' | 'a_pie';

export interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle: Vehicle;
  plate: string | null;
  photo_url: string | null;
  status: ApprovalStatus;
  is_online: boolean;
  last_seen_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export type DeliveryStatus = 'searching' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';

export interface OrderItem {
  product_id: string;
  title: string;
  qty: number;
  price: number;
}

export interface DeliveryRequest {
  id: string;
  code: string;
  tracking_token: string;
  merchant_id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  notes: string | null;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  status: DeliveryStatus;
  driver_id: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

/** Lo que ve un repartidor antes de aceptar (sin datos privados) */
export interface AvailableDelivery {
  id: string;
  code: string;
  merchant_name: string;
  merchant_address: string | null;
  merchant_category: string;
  destination: string;
  items_count: number;
  subtotal: number;
  delivery_fee: number;
  created_at: string;
}

export interface AppSettings {
  id: 1;
  delivery_fee: number;
  admin_whatsapp: string | null;
  price_pro: number;
  price_premium: number;
  updated_at: string;
}

/** Lo que el cliente ve en la página de seguimiento */
export interface TrackingInfo {
  code: string;
  status: DeliveryStatus;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  address: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  merchant: { name: string; slug: string; category: string; whatsapp_number: string; address: string | null; logo_url: string | null };
  driver: { full_name: string; phone: string; vehicle: Vehicle; plate: string | null; photo_url: string | null } | null;
}
