import { NextResponse } from 'next/server';
import { getRequestUser, getServiceClient, getUserClient } from '@/lib/supabase-server';
import { notifyOnlineDrivers, sendPush } from '@/lib/push-server';
import { friendlyError } from '@/lib/errors';
import { clean, isUuid } from '@/lib/validate';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Action = 'accept' | 'release' | 'picked_up' | 'delivered' | 'cancel';

/**
 * Acciones sobre un pedido. Se ejecutan COMO el usuario (la base valida permisos),
 * y después se envían las notificaciones que correspondan.
 */
export async function POST(req: Request, { params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = await pendingParams;
  const auth = await getRequestUser(req);
  if (!auth) return NextResponse.json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as Action;
  const as = getUserClient(auth.token);

  let result;
  switch (action) {
    case 'accept':
      result = await as.rpc('accept_delivery', { p_id: params.id });
      break;
    case 'release':
      result = await as.rpc('update_delivery_status', { p_id: params.id, p_status: 'searching' });
      break;
    case 'picked_up':
    case 'delivered':
      result = await as.rpc('update_delivery_status', { p_id: params.id, p_status: action });
      break;
    case 'cancel':
      result = await as.rpc('cancel_delivery', { p_id: params.id, p_reason: clean(body.reason, 200) || null });
      break;
    default:
      return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  }
  if (result.error) {
    const status = /YA_TOMADO/.test(result.error.message) ? 409 : 400;
    return NextResponse.json({ error: friendlyError(result.error) }, { status });
  }

  // ---------- Notificaciones ----------
  const r = result.data as { id: string; code: string; merchant_id: string; driver_id: string | null; address: string; delivery_fee: number };
  const sb = getServiceClient();
  const [{ data: merchant }, { data: driver }] = await Promise.all([
    sb.from('merchants').select('name, user_id').eq('id', r.merchant_id).maybeSingle(),
    r.driver_id ? sb.from('drivers').select('full_name, user_id').eq('id', r.driver_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  try {
    if (action === 'accept' && merchant?.user_id) {
      await sendPush(sb, [merchant.user_id], {
        title: `🛵 ${driver?.full_name ?? 'Un repartidor'} va por el pedido ${r.code}`,
        body: 'Ten el pedido listo para entregarlo.',
        url: '/panel?tab=pedidos',
        tag: `pedido-${r.code}`,
      });
    }
    if (action === 'delivered' && merchant?.user_id) {
      await sendPush(sb, [merchant.user_id], {
        title: `✅ Pedido ${r.code} entregado`,
        body: `${driver?.full_name ?? 'El repartidor'} lo entregó al cliente.`,
        url: '/panel?tab=pedidos',
        tag: `pedido-${r.code}`,
      });
    }
    if (action === 'release') {
      await notifyOnlineDrivers(sb, {
        title: `🛵 Pedido disponible otra vez · ${merchant?.name ?? ''}`,
        body: `Destino: ${r.address.slice(0, 60)} · Ganas $${Number(r.delivery_fee).toFixed(2)}`,
        url: '/repartidor',
        tag: 'nuevo-pedido',
        urgent: true,
      });
    }
    if (action === 'cancel') {
      const { data: prev } = await sb.from('delivery_requests').select('driver_id').eq('id', r.id).maybeSingle();
      const dId = prev?.driver_id;
      if (dId) {
        const { data: d } = await sb.from('drivers').select('user_id').eq('id', dId).maybeSingle();
        if (d) await sendPush(sb, [d.user_id], { title: `Pedido ${r.code} cancelado`, body: 'Ya no tienes que ir a buscarlo.', url: '/repartidor' });
      }
    }
  } catch (e) {
    console.error('[deliveries.action.push]', e);
  }

  return NextResponse.json({ ok: true, request: result.data });
}
