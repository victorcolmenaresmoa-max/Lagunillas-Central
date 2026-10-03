import type { DeliveryConfig, Point } from "./geo";
import type { OrderItem } from "./types";
export type OrderState =
  | "merchant_pending"
  | "products_payment"
  | "products_review"
  | "searching"
  | "delivery_payment"
  | "delivery_review"
  | "preparing"
  | "picked_up"
  | "pickup_ready"
  | "awaiting_handover"
  | "delivered"
  | "cancelled"
  | "disputed";
export const ORDER_LABEL: Record<OrderState, string> = {
  merchant_pending: "Esperando al comercio",
  products_payment: "Paga los productos",
  products_review: "Comercio revisando el pago",
  searching: "Buscando repartidor",
  delivery_payment: "Paga el delivery",
  delivery_review: "Repartidor revisando el pago",
  preparing: "Preparando / repartidor en camino",
  picked_up: "Camino a tu casa",
  pickup_ready: "Listo para retirar",
  awaiting_handover: "Pagos confirmados: entregar el paquete",
  delivered: "Entregado",
  cancelled: "Cancelado",
  disputed: "En reclamo",
};
export interface Address {
  id: string;
  label: string;
  address: string;
  sector: string;
  point: Point | null;
}
export interface PaymentAccount {
  bank: string;
  phone: string;
  document: string;
  cash: boolean;
  pos?: boolean;
  zelle?: string;
}
export interface Payment {
  id: string;
  kind: "products" | "delivery" | "refund";
  reference: string;
  bank: string;
  amount: number;
  receipt: string;
  status: string;
  duplicate: boolean;
  url?: string;
}
export interface AppOrder {
  id: string;
  code: string;
  customer_id: string;
  merchant_id: string;
  driver_id: string | null;
  fulfillment: "delivery" | "pickup";
  state: OrderState;
  customer_name: string;
  customer_phone: string;
  address: string;
  destination: Point | null;
  origin: Point | null;
  payment_mode: "prepaid" | "on_receipt";
  merchant_address?: string;
  pickup_code?: string;
  collected_at?: string;
  arrived_at?: string;
  returned_by_driver?: boolean;
  returned_to_merchant?: boolean;
  sector: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  distance_km: number;
  distance_method: string;
  route_geometry?: any;
  rate: number;
  rate_date: string;
  commission_percent: number;
  ready: boolean;
  reason: string | null;
  created_at: string;
  updated_at: string;
  deadline_at: string | null;
  delivered_at: string | null;
  delivery_paid: boolean;
  products_paid: boolean;
  delivery_code?: string;
  rating?: number;
  products_refunded?: boolean;
  delivery_refunded?: boolean;
  merchant?: {
    name: string;
    slug: string;
    whatsapp_number: string;
    address: string;
  };
  driver?: {
    full_name: string;
    phone: string;
    photo_url: string | null;
    vehicle: string;
    plate: string | null;
  };
  payments?: Payment[];
  payee?: PaymentAccount | null;
  driver_position?: { point: Point; updated_at: string } | null;
  messages?: {
    id: string;
    sender_id: string;
    channel: string;
    text: string;
    image_url?: string;
    audio_url?: string;
    created_at: string;
  }[];
  config?: DeliveryConfig;
}
