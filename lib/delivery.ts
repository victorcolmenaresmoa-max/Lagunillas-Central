import type { DeliveryStatus, Vehicle } from './types';

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  searching: 'Buscando repartidor',
  accepted: 'Repartidor en camino al comercio',
  picked_up: 'En camino a tu dirección',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const STATUS_SHORT: Record<DeliveryStatus, string> = {
  searching: 'Buscando',
  accepted: 'Aceptado',
  picked_up: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const STATUS_CLASS: Record<DeliveryStatus, string> = {
  searching: 'bg-ocre-100 text-ocre-600',
  accepted: 'bg-cielo-100 text-cielo-600',
  picked_up: 'bg-ocaso-300/30 text-ocaso-600',
  delivered: 'bg-laguna-100 text-laguna-700',
  cancelled: 'bg-cal-200 text-tinta-500',
};

export const VEHICLE_LABEL: Record<Vehicle, string> = {
  moto: 'Moto',
  carro: 'Carro',
  bicicleta: 'Bicicleta',
  a_pie: 'A pie',
};

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'hace un momento';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

export function mapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Lagunillas, Mérida, Venezuela`)}`;
}

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
