import "server-only";
import { NextResponse } from "next/server";
import { getRequestUser, getServiceClient } from "./supabase-server";
import {
  DEFAULT_CONFIG,
  covered,
  isPoint,
  kmBetween,
  deliveryPrice,
  type DeliveryConfig,
  type Point,
} from "./geo";
import { sendPush, notifyAdmins } from "./push-server";
import type { AppOrder } from "./orders";
export const fail = (error: string, status = 400) =>
  privateJson({ error }, { status });
export function privateJson(data:unknown,init?:ResponseInit) {
  const headers=new Headers(init?.headers);
  headers.set('Cache-Control','private, no-store, max-age=0');
  headers.set('Vary','Authorization');
  return NextResponse.json(data,{...init,headers});
}
export async function actor(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth?.user.email_confirmed_at)
    throw new Error("Inicia sesión con tu correo confirmado.");
  const sb = getServiceClient();
  const { data: p } = await sb
    .from("profiles")
    .select("role,full_name,phone,suspended")
    .eq("user_id", auth.user.id)
    .single();
  if (!p || p.suspended) throw new Error("Cuenta no disponible.");
  return { sb, user: auth.user, profile: p };
}
export async function config(
  sb: ReturnType<typeof getServiceClient>,
): Promise<DeliveryConfig> {
  const { data, error } = await sb
    .from("app_settings")
    .select("order_config")
    .eq("id", 1)
    .single();
  if (error) throw new Error("Falta aplicar la migración de pedidos.");
  return data?.order_config || DEFAULT_CONFIG;
}
export async function roadDistance(a: Point, b: Point, c: DeliveryConfig) {
  if (!covered(a, c.coverage) || !covered(b, c.coverage))
    throw new Error(
      "Solo hacemos delivery dentro de la cobertura de Lagunillas.",
    );
  const direct = kmBetween(a, b);
  // Production can use a private OSRM instance. Never send personal address text to the provider.
  const base = process.env.OSRM_URL || "https://router.project-osrm.org";
  try {
    const res = await fetch(
      `${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&radiuses=150;150`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    const json = await res.json();
    const route = json.routes?.[0];
    const km = Number(route?.distance) / 1000;
    if (
      json.code === "Ok" &&
      Number.isFinite(km) &&
      km >= direct * 0.95 &&
      km <= 20 &&
      json.waypoints?.every((p: any) => p.distance <= 150)
    )
      return { km, method: "road", geometry: route.geometry };
  } catch {}
  return { km: direct * c.factor, method: "estimate", geometry: null };
}
export async function loadOrder(
  sb: ReturnType<typeof getServiceClient>,
  id: string,
) {
  const { data, error } = await sb
    .from("app_orders")
    .select(
      "*,merchant:merchants(name,slug,whatsapp_number,address,user_id),driver:drivers(full_name,phone,photo_url,vehicle,plate,user_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Pedido no encontrado.");
  return data;
}
export function participant(o: any, userId: string, role: string) {
  return (
    o.customer_id === userId ||
    o.merchant?.user_id === userId ||
    o.driver?.user_id === userId ||
    role === "admin"
  );
}
export function channelOpen(o: AppOrder, channel: string) {
  if (o.state === "disputed") return false;
  if (channel === "merchant")
    return (
      o.state !== "merchant_pending" &&
      !["picked_up", "delivered", "cancelled"].includes(o.state)
    );
  if (channel === "driver")
    return (
      o.delivery_paid &&
      o.state !== "cancelled" &&
      (o.state !== "delivered" ||
        (!!o.delivered_at &&
          Date.now() - Date.parse(o.delivered_at) < 2 * 3600000))
    );
  return false;
}
export async function privateUrl(
  sb: ReturnType<typeof getServiceClient>,
  path: string,
) {
  const { data } = await sb.storage.from("pedidos").createSignedUrl(path, 120);
  return data?.signedUrl;
}
export async function uploadedPhoto(
  sb: ReturnType<typeof getServiceClient>,
  path: unknown,
  prefix: string,
) {
  if (
    typeof path !== "string" ||
    !path.startsWith(prefix + "/") ||
    !/^[-a-f0-9]{36}\.(png|jpg|webp)$/.test(path.slice(prefix.length + 1))
  )
    return false;
  const { data, error } = await sb.storage
    .from("pedidos")
    .list(prefix, { search: path.slice(prefix.length + 1), limit: 2 });
  return (
    !error && !!data?.some((f) => f.name === path.slice(prefix.length + 1))
  );
}
export async function orderView(
  sb: ReturnType<typeof getServiceClient>,
  o: any,
  userId: string,
  role: string,
) {
  const v = { ...o };
  delete v.delivery_code;
  delete v.code_failures;
  if (o.customer_id === userId) v.delivery_code = o.delivery_code;
  if (v.merchant) {
    v.merchant = { ...v.merchant };
    delete v.merchant.user_id;
  }
  if (v.driver) {
    v.driver = { ...v.driver };
    delete v.driver.user_id;
  }
  // Each receipt is visible only to its payer, payee and administration.
  const { data: payments } = await sb
    .from("order_payments")
    .select("*")
    .eq("order_id", o.id)
    .order("created_at");
  v.payments = await Promise.all(
    (payments || [])
      .filter(
        (p) =>
          p.payer_id === userId || p.payee_id === userId || role === "admin",
      )
      .map(async (p) => ({ ...p, url: await privateUrl(sb, p.receipt) })),
  );
  v.payee = null;
  if (
    o.customer_id === userId &&
    [
      "products_payment",
      "products_review",
      "delivery_payment",
      "delivery_review",
    ].includes(o.state)
  ) {
    const payee = ["products_payment", "products_review"].includes(o.state)
      ? o.merchant.user_id
      : o.driver?.user_id;
    if (payee) {
      const { data } = await sb
        .from("order_accounts")
        .select("account")
        .eq("user_id", payee)
        .maybeSingle();
      v.payee = data?.account;
    }
  }
  const channels = ["merchant", "driver"].filter((channel) =>
    role === "admin"
      ? o.state === "disputed"
      : o.customer_id === userId ||
        (channel === "merchant"
          ? o.merchant?.user_id === userId
          : o.driver?.user_id === userId),
  );
  const { data: messages } = await sb
    .from("order_messages")
    .select("*")
    .eq("order_id", o.id)
    .in("channel", channels)
    .order("created_at",{ascending:false})
    .limit(300);
  v.messages = await Promise.all(
    (messages || []).reverse().map(async (m) => ({
      ...m,
      image_url: m.image_path ? await privateUrl(sb, m.image_path) : undefined,
    })),
  );
  if (
    o.driver_id &&
    o.delivery_paid &&
    ["preparing", "picked_up"].includes(o.state) &&
    (o.customer_id === userId || o.driver?.user_id === userId)
  ) {
    const { data } = await sb
      .from("driver_positions")
      .select("point,updated_at")
      .eq("driver_id", o.driver_id)
      .maybeSingle();
    v.driver_position = data;
  }
  return v;
}
export async function notifyOrder(
  sb: ReturnType<typeof getServiceClient>,
  o: any,
  text: string,
) {
  const users = [o.customer_id, o.merchant?.user_id, o.driver?.user_id].filter(
    Boolean,
  );
  await sendPush(sb, users, {
    title: `Pedido ${o.code}`,
    body: text,
    url: "/mis-pedidos",
    tag: `order-${o.id}`,
    urgent: true,
  });
  if (o.state === "disputed")
    await notifyAdmins(sb, {
      title: `Reclamo ${o.code}`,
      body: o.reason || text,
      url: "/admin?tab=pedidos",
      tag: `claim-${o.id}`,
      urgent: true,
    });
  if (o.state === "searching") await notifyNearby(sb, o);
}
export async function notifyNearby(
  sb: ReturnType<typeof getServiceClient>,
  o: any,
  all = false,
) {
  const { data: drivers } = await sb
    .from("drivers")
    .select("id,user_id")
    .eq("status", "approved")
    .eq("is_online", true);
  const { data: positions } = await sb
    .from("driver_positions")
    .select("*")
    .gt("updated_at", new Date(Date.now() - 180000).toISOString());
  const nearby = (drivers || []).filter((d) =>
    positions?.some(
      (p) => p.driver_id === d.id && (all || kmBetween(o.origin, p.point) <= 2),
    ),
  );
  await sendPush(
    sb,
    nearby.map((d) => d.user_id),
    {
      title: `Delivery ${o.code}`,
      body: `Ruta ${Number(o.distance_km).toFixed(1)} km · $${Number(o.delivery_fee).toFixed(2)}`,
      url: "/repartidor",
      tag: `available-${o.id}`,
      urgent: true,
    },
  );
}
export async function tick(sb: ReturnType<typeof getServiceClient>) {
  const { data, error } = await sb.rpc("orders_tick");
  if (error) throw new Error("No pudimos revisar los tiempos de pedidos.");
  for (const row of data || []) {
    const o = await loadOrder(sb, row.id);
    await notifyOrder(
      sb,
      o,
      o.state === "searching"
        ? "Todavía puedes elegir retiro en el local."
        : "Se venció un tiempo del pedido.",
    );
    if (["products_review", "delivery_review"].includes(o.state))
      await notifyAdmins(sb, {
        title: `Pago atascado ${o.code}`,
        body: "El receptor aún no ha confirmado el dinero.",
        url: "/admin?tab=pedidos",
        tag: `late-${o.id}`,
      });
  }
  // Claim the expansion before sending; concurrent ticks cannot send it twice.
  const { data: expanded } = await sb
    .from("app_orders")
    .update({ expanded_at: null })
    .eq("state", "searching")
    .lte("expanded_at", new Date().toISOString())
    .select("*");
  for (const o of expanded || []) await notifyNearby(sb, o, true);
}
