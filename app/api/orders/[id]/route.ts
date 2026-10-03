import { privateJson } from "@/lib/order-server";
import {
  actor,
  fail,
  loadOrder,
  participant,
  orderView,
  notifyOrder,
  channelOpen,
  uploadedPhoto,
  tick,
} from "@/lib/order-server";
import { clean, isUuid } from "@/lib/validate";
import { missingItems, type LegalProfile } from "@/lib/legal";
import { ORDER_LABEL } from "@/lib/orders";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  try {
    const { sb, user, profile } = await actor(req);
    await tick(sb);
    const o = await loadOrder(sb, params.id);
    if (!participant(o, user.id, profile.role))
      return fail("No autorizado.", 403);
    return privateJson(await orderView(sb, o, user.id, profile.role));
  } catch (e: any) {
    return fail(e.message, 401);
  }
}
export async function POST(
  req: Request,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) {
  const params = await pendingParams;
  try {
    const { sb, user, profile } = await actor(req);
    const b = await req.json();
    await tick(sb);
    const o = await loadOrder(sb, params.id);
    if (b.action !== "claim" && !participant(o, user.id, profile.role))
      return fail("No autorizado.", 403);
    if (
      o.payment_mode === "on_receipt" &&
      ["claim", "accept"].includes(b.action)
    ) {
      const kind = b.action === "claim" ? "delivery" : "merchant";
      if (profile.role !== kind) return fail("No autorizado.", 403);
      const { data: legal } = await sb
        .from("legal_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: d } = await sb
        .from("drivers")
        .select("vehicle")
        .eq("user_id", user.id)
        .maybeSingle();
      const missing = missingItems(
        kind,
        legal as LegalProfile | null,
        d?.vehicle,
      );
      if (missing.length)
        return fail(
          `Completa tu verificación antes de aceptar: ${missing.join(", ")}.`,
        );
    }
    if (b.action === "message") {
      const ch = b.channel;
      const authorized =
        ch === "support"
          ? o.state === "disputed"
          : profile.role !== "admin" &&
            (o.customer_id === user.id ||
              (ch === "merchant" ? o.merchant?.user_id : o.driver?.user_id) ===
                user.id);
      if (
        !["merchant", "driver", "support"].includes(ch) ||
        !channelOpen(o, ch) ||
        !authorized
      )
        return fail("Chat cerrado o no autorizado.", 403);
      const text = clean(b.text, 1000);
      const path = b.image_path;
      const audioPath = b.audio_path;
      if (
        audioPath &&
        !(await uploadedPhoto(sb, audioPath, `${o.id}/${user.id}`, true))
      )
        return fail("Audio inválido.");
      if (!text && !path && !audioPath)
        return fail("Escribe un mensaje o adjunta una foto.");
      if (path && !(await uploadedPhoto(sb, path, `${o.id}/${user.id}`)))
        return fail("Foto inválida.");
      const { error } = await sb.from("order_messages").insert({
        order_id: o.id,
        sender_id: user.id,
        channel: ch,
        text,
        image_path: path || null,
        audio_path: audioPath || null,
      });
      if (error) return fail("No pudimos enviar el mensaje.");
      await notifyOrder(
        sb,
        o,
        text
          ? "Nuevo mensaje en el pedido"
          : audioPath
            ? "Nueva nota de voz en el pedido"
            : "Nueva foto en el pedido",
      );
      return privateJson({ ok: true });
    }
    if (
      b.action === "receipt" &&
      (!(await uploadedPhoto(sb, b.receipt, `${o.id}/${user.id}`)) ||
        typeof b.amount !== "number" ||
        !Number.isFinite(b.amount) ||
        b.amount <= 0 ||
        b.amount > 100000000 ||
        !/^\d{5}$/.test(b.reference) ||
        !clean(b.bank, 80))
    )
      return fail("Revisa el comprobante, referencia, banco y monto.");
    if (b.action === "dispute" && clean(b.reason, 300).length < 3)
      return fail("Explica el motivo del reclamo.");
    const { data, error } = await sb.rpc("order_action", {
      p_order: params.id,
      p_actor: user.id,
      p_action: b.action,
      p_data: b,
    });
    if (error) return fail(error.message);
    const next = await loadOrder(sb, params.id);
    await notifyOrder(
      sb,
      next,
      ORDER_LABEL[next.state as keyof typeof ORDER_LABEL],
    );
    if (b.action === "receipt") {
      const { data: p } = await sb
        .from("order_payments")
        .select("duplicate")
        .eq("order_id", o.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (p?.duplicate) {
        const { notifyAdmins } = await import("@/lib/push-server");
        await notifyAdmins(sb, {
          title: `Referencia repetida ${o.code}`,
          body: "Revisa el comprobante y consulta al receptor.",
          url: "/admin?tab=pedidos",
          tag: `duplicate-${o.id}`,
          urgent: true,
        });
      }
    }
    // Never return the RPC record: it includes the customer's secret delivery code.
    if (
      b.action === "picked_up" &&
      o.payment_mode === "on_receipt" &&
      data.state !== "picked_up"
    )
      return fail(
        "Código de recogida incorrecto. Pídelo al comercio al recoger el paquete.",
      );
    if (b.action === "delivered" && data.state !== "delivered")
      return fail("Código incorrecto. Pide al cliente su código.");
    return privateJson(await orderView(sb, next, user.id, profile.role));
  } catch (e: any) {
    return fail(e.message);
  }
}
