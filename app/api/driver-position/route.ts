import { privateJson, actor, fail } from "@/lib/order-server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    const b = await req.json();
    if (profile.role !== "delivery" || typeof b.online !== "boolean")
      return fail("Solicitud inválida.", 403);
    const { data: d } = await sb
      .from("drivers")
      .select("id,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (d?.status !== "approved") return fail("Cuenta no aprobada.", 403);
    const { error } = await sb
      .from("drivers")
      .update({ is_online: b.online, last_seen_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) throw new Error("No pudimos cambiar tu disponibilidad.");
    return privateJson({ ok: true });
  } catch (e: any) {
    return fail(e.message);
  }
}
