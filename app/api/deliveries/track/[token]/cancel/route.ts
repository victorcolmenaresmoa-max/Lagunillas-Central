import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { sendPush } from '@/lib/push-server';
import { isUuid } from '@/lib/validate';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** El cliente cancela mientras todavía no hay repartidor asignado */
export async function POST(_req: Request, { params: pendingParams }: { params: Promise<{ token: string }> }) {
  const params = await pendingParams;
  if (!isUuid(params.token)) return NextResponse.json({ error: 'Enlace inválido.' }, { status: 404 });
  const sb = getServiceClient();
  const { data: r } = await sb
    .from('delivery_requests')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: 'Cancelado por el cliente' })
    .eq('tracking_token', params.token)
    .eq('status', 'searching')
    .select('code, merchant:merchants(user_id)')
    .maybeSingle();
  if (!r) {
    return NextResponse.json(
      { error: 'Un repartidor ya tomó tu pedido. Para cancelarlo, escríbele directamente.' },
      { status: 409 }
    );
  }
  const ownerId = (r as any).merchant?.user_id;
  if (ownerId) {
    await sendPush(sb, [ownerId], {
      title: `Pedido ${r.code} cancelado`,
      body: 'El cliente canceló la solicitud de delivery.',
      url: '/panel?tab=pedidos',
    });
  }
  return NextResponse.json({ ok: true });
}
