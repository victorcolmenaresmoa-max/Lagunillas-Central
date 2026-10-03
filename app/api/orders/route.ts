import { privateJson } from "@/lib/order-server";
import {
  actor,
  config,
  fail,
  loadOrder,
  notifyOrder,
  orderView,
  tick,
} from "@/lib/order-server";
import { TERMS_VERSION } from "@/lib/legal";
import { isOpenNow } from "@/lib/utils";
import { clean, isUuid, isValidPhone, normalizePhone } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    await tick(sb);
    let query = sb
      .from("app_orders")
      .select(
        "*,merchant:merchants(name,slug,whatsapp_number,address,user_id),driver:drivers(full_name,phone,photo_url,vehicle,plate,user_id)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (profile.role === "merchant") {
      const { data } = await sb
        .from("merchants")
        .select("id")
        .eq("user_id", user.id);
      query = query.in(
        "merchant_id",
        (data || []).map((m) => m.id),
      );
    } else if (profile.role === "delivery") {
      const { data: d } = await sb
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!d || d.status !== "approved") return privateJson({ orders: [] });
      query = d.is_online
        ? query.or(`driver_id.eq.${d.id},state.eq.searching`)
        : query.eq("driver_id", d.id);
    } else if (profile.role !== "admin")
      query = query.eq("customer_id", user.id);
    const { data, error } = await query;
    if (error) throw new Error("No pudimos cargar los pedidos.");
    const orders = await Promise.all(
      (data || []).map(async (o) => {
        if (profile.role === "delivery" && o.driver?.user_id !== user.id) {
          return {
            id: o.id,
            code: o.code,
            state: o.state,
            origin: o.origin,
            destination: o.destination,
            sector: o.sector,
            distance_km: o.distance_km,
            delivery_fee: o.delivery_fee,
            commission_percent: o.commission_percent,
            route_geometry: o.route_geometry,
            address: o.address,
            merchant_address: o.merchant_address || o.merchant.address,
            payment_mode: o.payment_mode,
            merchant: { name: o.merchant.name, address: o.merchant.address },
            created_at: o.created_at,
            available: true,
          };
        }
        return orderView(sb, o, user.id, profile.role);
      }),
    );
    return privateJson({ orders: orders.filter(Boolean) });
  } catch (e: any) {
    return fail(e.message, 401);
  }
}
export async function POST(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    const b = await req.json();
    if (profile.role !== "client")
      return fail("Para comprar dentro de la app usa tu cuenta de cliente.");
    if (
      !isUuid(b.merchant_id) ||
      !isUuid(b.request_key) ||
      !Array.isArray(b.items) ||
      !b.items.length ||
      b.items.length > 30
    )
      return fail("Pedido inválido.");
    if (!["delivery", "pickup"].includes(b.fulfillment))
      return fail("Elige delivery o retiro.");
    if (!profile.full_name || !isValidPhone(profile.phone || ""))
      return fail("Completa tu nombre y teléfono en Mi cuenta.");
    const { data: existing } = await sb
      .from("app_orders")
      .select("id")
      .eq("customer_id", user.id)
      .eq("request_key", b.request_key)
      .maybeSingle();
    if (existing) return privateJson({ id: existing.id });
    const c = await config(sb);
    if (c.bcv <= 0 || !c.bcvDate)
      return fail(
        "La administración debe configurar la tasa BCV antes de recibir pagos.",
      );
    const { data: m } = await sb
      .from("merchants")
      .select("*")
      .eq("id", b.merchant_id)
      .single();
    if (!m?.is_active || m.status !== "approved" || !m.user_id || !isOpenNow(m))
      return fail("Comercio no disponible.");
    const { data: account } = await sb
      .from("order_accounts")
      .select("*")
      .eq("user_id", m.user_id)
      .single();
    if (
      !m.address?.trim() ||
      !account?.account.bank ||
      !account.account.phone ||
      !account.account.document
    )
      return fail("El comercio debe guardar su dirección y datos de pago.");
    let address = "Retiro en el comercio",
      sector = "",
      destination = null;
    let distance = { km: 0, method: "pickup", geometry: null as any };
    if (b.fulfillment === "delivery") {
      const { data: a } = await sb
        .from("customer_addresses")
        .select("*")
        .eq("id", b.address_id)
        .eq("user_id", user.id)
        .single();
      if (!a?.address)
        return fail("Selecciona una dirección escrita guardada.");
      address = a.address;
      sector = a.sector;
      distance = { km: 0, method: "fixed", geometry: null };
    }
    const ids: string[] = [
      ...new Set<string>(b.items.map((i: any) => String(i.product_id))),
    ];
    if (!ids.every(isUuid)) return fail("Producto inválido.");
    const [{ data: products }, { data: deals }] = await Promise.all([
      sb
        .from("products")
        .select("id,title,price,is_available")
        .eq("merchant_id", m.id)
        .in("id", ids),
      sb
        .from("flash_deals")
        .select("product_id,discount_price")
        .eq("merchant_id", m.id)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString()),
    ]);
    const items = ids.map((id) => {
      const raw = b.items.find((i: any) => i.product_id === id);
      const p = products?.find((p) => p.id === id);
      if (
        !p?.is_available ||
        !Number.isInteger(raw.qty) ||
        raw.qty < 1 ||
        raw.qty > 99
      )
        throw new Error(
          "Hay un producto no disponible o una cantidad inválida.",
        );
      return {
        product_id: id,
        title: p.title,
        qty: raw.qty,
        price: Number(
          deals?.find((d) => d.product_id === id)?.discount_price ?? p.price,
        ),
      };
    });
    const { count } = await sb
      .from("app_orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .not("state", "in", "(delivered,cancelled)")
      .gte("created_at", new Date(Date.now() - 1800000).toISOString());
    if ((count || 0) >= 3)
      return fail("Ya tienes varios pedidos activos.", 429);
    const subtotal =
      Math.round(items.reduce((s, i) => s + i.qty * i.price, 0) * 100) / 100;
    if (
      typeof b.expected_subtotal !== "number" ||
      Math.abs(b.expected_subtotal - subtotal) > 0.001
    )
      return fail(
        "Cambió el precio de los productos. Revisa el carrito antes de confirmar.",
        409,
      );
    const fee =
      b.fulfillment === "delivery" ? Math.round(c.base * 100) / 100 : 0;
    if (
      typeof b.expected_fee !== "number" ||
      Math.abs(b.expected_fee - fee) > 0.001
    )
      return fail(
        "Cambió la cotización. Actualiza el precio antes de confirmar.",
        409,
      );
    const { data: orderId, error } = await sb.rpc("order_create", {
      p_actor: user.id,
      p_data: {
        merchant_id: m.id,
        request_key: b.request_key,
        terms_version: TERMS_VERSION,
        customer_id: user.id,
        customer_name: profile.full_name,
        customer_phone: normalizePhone(profile.phone),
        fulfillment: b.fulfillment,
        address,
        sector,
        destination,
        origin: null,
        merchant_address: m.address,
        merchant_payment: account.account,
        payment_mode: "on_receipt",
        items,
        subtotal,
        delivery_fee: fee,
        distance_km: distance.km,
        distance_method: distance.method,
        route_geometry: distance.geometry,
        rate: c.bcv,
        rate_date: c.bcvDate,
        commission_percent: c.commission,
        deadline_at: new Date(
          Date.now() + c.minutes.accept * 60000,
        ).toISOString(),
      },
    });
    if (error) throw new Error("No pudimos crear el pedido.");
    await notifyOrder(
      sb,
      await loadOrder(sb, orderId),
      "Pedido nuevo con pago al recibir: revisa dirección, productos y disponibilidad antes de aceptar.",
    );
    return privateJson({ id: orderId });
  } catch (e: any) {
    return fail(e.message);
  }
}
