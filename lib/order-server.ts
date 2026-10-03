import "server-only";
import { NextResponse } from "next/server";
import { getRequestUser, getServiceClient } from "./supabase-server";
import { DEFAULT_CONFIG, type DeliveryConfig } from "./geo";
import { sendPush, notifyAdmins } from "./push-server";
import type { AppOrder } from "./orders";
export const fail = (error: string, status = 400) =>
  privateJson({ error }, { status });
export function privateJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Vary", "Authorization");
  return NextResponse.json(data, { ...init, headers });
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
  if (!["merchant", "driver", "support"].includes(channel)) return false;
  if (["cancelled", "delivered"].includes(o.state))
    return (
      !!o.delivered_at && Date.now() - Date.parse(o.delivered_at) < 48 * 3600000
    );
  if (channel === "support") return o.state === "disputed";
  return channel === "merchant" || !!o.driver_id;
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
  audio = false,
) {
  if (
    typeof path !== "string" ||
    !path.startsWith(prefix + "/") ||
    !(
      audio
        ? /^[-a-f0-9]{36}\.(webm|ogg|mp3|m4a)$/
        : /^[-a-f0-9]{36}\.(png|jpg|webp)$/
    ).test(path.slice(prefix.length + 1))
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
  delete v.pickup_code;
  delete v.merchant_payment;
  delete v.driver_payment;
  delete v.pickup_failures;
  if (o.merchant?.user_id === userId) v.pickup_code = o.pickup_code;
  delete v.code_failures;
  if (
    o.customer_id === userId &&
    (o.payment_mode !== "on_receipt" || o.state === "awaiting_handover")
  )
    v.delivery_code = o.delivery_code;
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
      v.payee =
        o.payment_mode === "on_receipt"
          ? ["products_payment", "products_review"].includes(o.state)
            ? o.merchant_payment
            : o.driver_payment
          : data?.account;
    }
  }
  const channels =
    role === "admin"
      ? o.state === "disputed"
        ? ["merchant", "driver", "support"]
        : []
      : o.customer_id === userId
        ? ["merchant", "driver", "support"]
        : o.merchant?.user_id === userId
          ? ["merchant", "support"]
          : ["driver", "support"];
  const { data: messages } = await sb
    .from("order_messages")
    .select("*")
    .eq("order_id", o.id)
    .in("channel", channels)
    .order("created_at", { ascending: false })
    .limit(300);
  v.messages = await Promise.all(
    (messages || []).reverse().map(async (m) => ({
      ...m,
      sender_label:
        m.sender_id === o.customer_id
          ? "Cliente"
          : m.sender_id === o.merchant?.user_id
            ? "Comercio"
            : m.sender_id === o.driver?.user_id
              ? "Repartidor"
              : "Administración",
      image_url: m.image_path ? await privateUrl(sb, m.image_path) : undefined,
      audio_url: m.audio_path ? await privateUrl(sb, m.audio_path) : undefined,
    })),
  );
  return v;
}
export async function notifyOrder(
  sb: ReturnType<typeof getServiceClient>,
  o: any,
  text: string,
) {
  await Promise.all(
    [
      [o.customer_id, "/mis-pedidos"],
      [o.merchant?.user_id, "/panel"],
      [o.driver?.user_id, "/repartidor"],
    ]
      .filter(([id]) => id)
      .map(([id, url]) =>
        sendPush(sb, [id], {
          title: `Pedido ${o.code}`,
          body: text,
          url: `${url}?pedido=${o.id}`,
          tag: `order-${o.id}`,
          urgent: true,
        }),
      ),
  );
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
  await sendPush(
    sb,
    (drivers || []).map((d) => d.user_id),
    {
      title: `Delivery ${o.code}`,
      body: `Revisa la dirección antes de aceptar · $${Number(o.delivery_fee).toFixed(2)}`,
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
