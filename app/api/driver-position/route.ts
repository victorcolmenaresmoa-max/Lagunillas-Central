import { privateJson } from "@/lib/order-server";
import { actor, fail, config } from "@/lib/order-server";
import { covered, isPoint } from "@/lib/geo";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    const b = await req.json();
    if (profile.role !== "delivery") return fail("No autorizado.", 403);
    const { data: d } = await sb
      .from("drivers")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (!d || d.status !== "approved") return fail("Cuenta no aprobada.");
    if (b.online === false) {
      await sb.from("drivers").update({ is_online: false }).eq("id", d.id);
      return privateJson({ ok: true });
    }
    if (!isPoint(b.point) || !covered(b.point, (await config(sb)).coverage)) {
      await sb.from("drivers").update({ is_online: false }).eq("id", d.id);
      return fail("Debes estar dentro de la cobertura de Lagunillas.");
    }
    const { error } = await sb
      .from("driver_positions")
      .upsert({
        driver_id: d.id,
        point: b.point,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error("No pudimos actualizar tu ubicación.");
    if (b.online === true) {
      const { error } = await sb
        .from("drivers")
        .update({ is_online: true, last_seen_at: new Date().toISOString() })
        .eq("id", d.id);
      if (error) throw new Error(error.message);
    }
    return privateJson({ ok: true });
  } catch (e: any) {
    return fail(e.message);
  }
}
