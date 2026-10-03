import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { isUuid } from '@/lib/validate';
import type { TrackingInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Seguimiento del pedido para el cliente (solo con el enlace secreto) */
export async function GET(_req: Request, { params: pendingParams }: { params: Promise<{ token: string }> }) {
  const params = await pendingParams;
  if (!isUuid(params.token)) return NextResponse.json({ error: 'Enlace inválido.' }, { status: 404 });
  const sb = getServiceClient();
  const { data: r } = await sb
    .from('delivery_requests')
    .select(
      'code, status, created_at, accepted_at, picked_up_at, delivered_at, cancelled_at, cancel_reason, address, items, subtotal, delivery_fee, merchant:merchants(name, slug, category, whatsapp_number, address, logo_url), driver:drivers(full_name, phone, vehicle, plate, photo_url)'
    )
    .eq('tracking_token', params.token)
    .maybeSingle();
  if (!r) return NextResponse.json({ error: 'No encontramos este pedido.' }, { status: 404 });
  const info = r as unknown as TrackingInfo;
  // El teléfono del repartidor solo se muestra mientras el pedido está en camino
  if (info.driver && !['accepted', 'picked_up'].includes(info.status)) info.driver = { ...info.driver, phone: '' };
  return NextResponse.json(info, { headers: { 'Cache-Control': 'no-store' } });
}
