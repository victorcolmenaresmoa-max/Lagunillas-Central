import { privateJson, actor, config, fail } from "@/lib/order-server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    if (profile.role !== "client")
      return fail("Usa tu cuenta de comprador.", 403);
    const b = await req.json();
    if (!["pickup", "delivery"].includes(b.fulfillment))
      return fail("Elige delivery o retiro.");
    const c = await config(sb);
    const { data: m } = await sb
      .from("merchants")
      .select("address")
      .eq("id", b.merchant_id)
      .eq("status", "approved")
      .eq("is_active", true)
      .maybeSingle();
    if (!m?.address?.trim())
      return fail("El comercio debe guardar su dirección.");
    if (b.fulfillment === "delivery") {
      const { data: a } = await sb
        .from("customer_addresses")
        .select("address")
        .eq("id", b.address_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!a?.address) return fail("Elige una dirección guardada.");
    }
    return privateJson({
      fee: b.fulfillment === "delivery" ? Math.round(c.base * 100) / 100 : 0,
      km: 0,
      method: b.fulfillment === "delivery" ? "fixed" : "pickup",
    });
  } catch (e: any) {
    return fail(e.message);
  }
}
