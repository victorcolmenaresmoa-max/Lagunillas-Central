import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { notifyOnlineDrivers, sendPush } from '@/lib/push-server';
import { clean, isUuid, isValidPhone, normalizePhone } from '@/lib/validate';
import type { OrderItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Freno básico contra abuso: máximo 8 solicitudes cada 10 minutos por conexión
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 8;
}

/**
 * El cliente pide un repartidor.
 * Los precios se calculan aquí con los datos de la base (no se confía en el navegador).
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad('Solicitud inválida.');
  }

  // Trampa para robots: este campo es invisible para las personas
  if (body.website) return NextResponse.json({ ok: true });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (tooMany(ip)) return bad('Demasiados pedidos seguidos. Espera unos minutos.', 429);

  const merchantId = clean(body.merchant_id, 40);
  const name = clean(body.customer_name, 60);
  const phoneRaw = clean(body.customer_phone, 30);
  const address = clean(body.address, 200);
  const notes = clean(body.notes, 200) || null;
  const rawItems: { product_id: string; qty: number }[] = Array.isArray(body.items) ? body.items.slice(0, 30) : [];

  if (!isUuid(merchantId)) return bad('Comercio inválido.');
  if (name.length < 2) return bad('Escribe tu nombre.');
  if (!isValidPhone(phoneRaw)) return bad('Escribe un teléfono válido para que el repartidor te contacte.');
  if (address.length < 6) return bad('Escribe tu dirección con un punto de referencia.');
  if (rawItems.length === 0) return bad('Tu pedido está vacío.');
  const phone = normalizePhone(phoneRaw);

  const sb = getServiceClient();

  const { data: merchant } = await sb
    .from('merchants')
    .select('id, name, user_id, status, is_active')
    .eq('id', merchantId)
    .maybeSingle();
  if (!merchant || merchant.status !== 'approved' || !merchant.is_active) return bad('Este comercio no está recibiendo pedidos.');

  // Límite: evita pedidos repetidos o falsos desde el mismo teléfono
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count } = await sb
    .from('delivery_requests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_phone', phone)
    .in('status', ['searching', 'accepted', 'picked_up'])
    .gte('created_at', since);
  if ((count ?? 0) >= 3) return bad('Ya tienes varios pedidos en curso. Espera a que lleguen antes de pedir otro.', 429);

  const ids = [...new Set(rawItems.map((i) => String(i.product_id)).filter(isUuid))];
  const [{ data: products }, { data: deals }, { data: settings }] = await Promise.all([
    sb.from('products').select('id, title, price, is_available').eq('merchant_id', merchantId).in('id', ids),
    sb
      .from('flash_deals')
      .select('product_id, discount_price')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString()),
    sb.from('app_settings').select('delivery_fee').eq('id', 1).maybeSingle(),
  ]);

  const dealPrice = new Map((deals ?? []).map((d) => [d.product_id, Number(d.discount_price)]));
  const items: OrderItem[] = [];
  for (const raw of rawItems) {
    const p = products?.find((x) => x.id === raw.product_id);
    const qty = Math.min(99, Math.max(1, Math.floor(Number(raw.qty) || 0)));
    if (!p || !p.is_available) continue;
    items.push({ product_id: p.id, title: p.title, qty, price: dealPrice.get(p.id) ?? Number(p.price) });
  }
  if (items.length === 0) return bad('Los productos de tu pedido ya no están disponibles.');

  const subtotal = Math.round(items.reduce((s, i) => s + i.qty * i.price, 0) * 100) / 100;
  const fee = Number(settings?.delivery_fee ?? 1.5);

  const { data: request, error } = await sb
    .from('delivery_requests')
    .insert({
      merchant_id: merchantId,
      customer_name: name,
      customer_phone: phone,
      address,
      notes,
      items,
      subtotal,
      delivery_fee: fee,
    })
    .select('id, code, tracking_token, subtotal, delivery_fee, items')
    .single();
  if (error || !request) {
    console.error('[deliveries.create]', error?.message);
    return bad('No pudimos registrar tu pedido. Intenta de nuevo.', 500);
  }

  const units = items.reduce((s, i) => s + i.qty, 0);
  await Promise.all([
    notifyOnlineDrivers(sb, {
      title: `🛵 Nuevo pedido · ${merchant.name}`,
      body: `${units} artículo${units === 1 ? '' : 's'} → ${address.slice(0, 60)} · Ganas $${fee.toFixed(2)}`,
      url: '/repartidor',
      tag: 'nuevo-pedido',
      urgent: true,
    }),
    merchant.user_id
      ? sendPush(sb, [merchant.user_id], {
          title: `Nuevo pedido con delivery ${request.code}`,
          body: `${name} pidió ${units} artículo${units === 1 ? '' : 's'}. Estamos buscando repartidor.`,
          url: '/panel?tab=pedidos',
          tag: `pedido-${request.code}`,
        })
      : Promise.resolve(0),
  ]);

  return NextResponse.json({
    code: request.code,
    tracking_token: request.tracking_token,
    subtotal: request.subtotal,
    delivery_fee: request.delivery_fee,
    items: request.items,
  });
}
