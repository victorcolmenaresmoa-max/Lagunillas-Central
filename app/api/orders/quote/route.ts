import { privateJson } from "@/lib/order-server";
import { actor, config, fail, roadDistance } from "@/lib/order-server";
import { deliveryPrice } from "@/lib/geo";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { sb, user } = await actor(req);
    const b = await req.json();
    const c = await config(sb);
    const { data: m } = await sb
      .from("merchants")
      .select("user_id")
      .eq("id", b.merchant_id)
      .eq("status", "approved")
      .eq("is_active", true)
      .single();
    const { data: a } = await sb
      .from("order_accounts")
      .select("point")
      .eq("user_id", m?.user_id)
      .single();
    if (!a?.point) return fail("El comercio debe fijar su local en el mapa.");
    if (b.fulfillment === "pickup")
      return privateJson({ fee: 0, km: 0, method: "pickup" });
    const { data: d } = await sb
      .from("customer_addresses")
      .select("point")
      .eq("id", b.address_id)
      .eq("user_id", user.id)
      .single();
    if (!d?.point) return fail("Elige una dirección guardada.");
    const route = await roadDistance(a.point, d.point, c);
    return privateJson({ ...route, fee: deliveryPrice(route.km, c) });
  } catch (e: any) {
    return fail(e.message);
  }
}
