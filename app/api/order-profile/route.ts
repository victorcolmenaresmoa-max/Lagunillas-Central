import { privateJson } from "@/lib/order-server";
import {
  actor,
  config,
  fail,
  privateUrl,
  uploadedPhoto,
} from "@/lib/order-server";
import { validConfig } from "@/lib/geo";
import { clean, isValidPhone, normalizePhone } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    const [{ data: addresses }, { data: account }, { data: driver }, c] =
      await Promise.all([
        sb
          .from("customer_addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        sb
          .from("order_accounts")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        sb.from("drivers").select("id").eq("user_id", user.id).maybeSingle(),
        config(sb),
      ]);
    let reserved = 0;
    let wallet = null,
      topups: any[] = [],
      suspended: any[] = [];
    if (driver) {
      const { data } = await sb
        .from("driver_wallets")
        .select("balance,reserved")
        .eq("driver_id", driver.id)
        .maybeSingle();
      wallet = data?.balance || 0;
      reserved = data?.reserved || 0;
    }
    if (profile.role === "admin") {
      const { data: suspendedProfiles } = await sb
        .from("profiles")
        .select("user_id,full_name,role")
        .eq("suspended", true);
      suspended = suspendedProfiles || [];
      const { data } = await sb
        .from("wallet_topups")
        .select("*,driver:drivers(full_name)")
        .eq("status", "pending")
        .order("created_at");
      topups = await Promise.all(
        (data || []).map(async (t) => ({
          ...t,
          url: await privateUrl(sb, t.receipt),
        })),
      );
    }
    return privateJson({
      addresses: addresses || [],
      account: account?.account || {},
      point: account?.point || null,
      config: c,
      wallet,
      reserved,
      topups,
      suspended,
      profile,
    });
  } catch (e: any) {
    return fail(e.message, 401);
  }
}
export async function POST(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    const b = await req.json();
    const c = await config(sb);
    let error: any;
    if (b.action === "address") {
      if (profile.role !== "client")
        return fail("Usa tu cuenta de comprador.", 403);
      if (clean(b.address, 200).length < 6 || clean(b.label, 60).length < 2)
        return fail("Escribe dirección y nombre de la dirección.");
      const { count } = await sb
        .from("customer_addresses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count || 0) >= 10)
        return fail("Puedes guardar hasta 10 direcciones.");
      ({ error } = await sb.from("customer_addresses").insert({
        user_id: user.id,
        label: clean(b.label, 60),
        address: clean(b.address, 200),
        sector: clean(b.sector, 80),
        point: null,
      }));
    } else if (b.action === "delete_address")
      ({ error } = await sb
        .from("customer_addresses")
        .delete()
        .eq("id", b.id)
        .eq("user_id", user.id));
    else if (b.action === "identity") {
      if (clean(b.name, 100).length < 2 || !isValidPhone(b.phone))
        return fail("Nombre o teléfono inválido.");
      ({ error } = await sb
        .from("profiles")
        .update({
          full_name: clean(b.name, 100),
          phone: normalizePhone(b.phone),
        })
        .eq("user_id", user.id));
    } else if (b.action === "account") {
      if (!["merchant", "delivery"].includes(profile.role))
        return fail("No autorizado.", 403);
      const account = {
        bank: clean(b.account?.bank, 80),
        phone: clean(b.account?.phone, 30),
        document: clean(b.account?.document, 30),
        cash: !!b.account?.cash,
        pos: !!b.account?.pos,
        zelle: clean(b.account?.zelle, 100),
      };
      if (
        !account.bank ||
        !isValidPhone(account.phone) ||
        !/^[VEJGPvejpg]-?\d{5,12}(-?\d)?$/.test(account.document)
      )
        return fail("Completa banco, teléfono y cédula/RIF de pago móvil.");
      if (profile.role === "merchant") {
        const { data: merchant } = await sb
          .from("merchants")
          .select("address")
          .eq("user_id", user.id)
          .maybeSingle();
        if (clean(merchant?.address, 200).length < 6)
          return fail("Guarda la dirección escrita del comercio en Perfil.");
      }
      ({ error } = await sb.from("order_accounts").upsert({
        user_id: user.id,
        account,
        point: null,
        updated_at: new Date().toISOString(),
      }));
    } else if (b.action === "config") {
      if (profile.role !== "admin") return fail("No autorizado.", 403);
      if (!validConfig(b.config))
        return fail("Revisa tarifas, tasa BCV, tiempos y cobertura.");
      ({ error } = await sb
        .from("app_settings")
        .update({
          order_config: b.config,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1));
    } else if (b.action === "suspend") {
      if (b.driver_id && profile.role === "admin") {
        const { data: d } = await sb
          .from("drivers")
          .select("user_id")
          .eq("id", b.driver_id)
          .single();
        b.user_id = d?.user_id;
      }
      if (profile.role !== "admin" || b.user_id === user.id)
        return fail("No autorizado.", 403);
      ({ error } = await sb
        .from("profiles")
        .update({ suspended: !!b.suspended })
        .eq("user_id", b.user_id));
      if (b.suspended)
        await sb
          .from("drivers")
          .update({ is_online: false, status: "suspended" })
          .eq("user_id", b.user_id);
    } else if (b.action === "topup") {
      const { data: d } = await sb
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (
        !d ||
        typeof b.amount !== "number" ||
        !Number.isFinite(b.amount) ||
        b.amount <= 0 ||
        b.amount > 1000 ||
        !/^\d{5}$/.test(b.reference) ||
        !(await uploadedPhoto(sb, b.receipt, `topups/${user.id}`))
      )
        return fail("Recarga inválida.");
      ({ error } = await sb.from("wallet_topups").insert({
        driver_id: d.id,
        amount: b.amount,
        reference: b.reference,
        receipt: b.receipt,
      }));
    } else if (b.action === "approve_topup") {
      if (profile.role !== "admin") return fail("No autorizado.", 403);
      ({ error } = await sb.rpc("approve_topup", {
        p_id: b.id,
        p_actor: user.id,
      }));
    } else return fail("Acción inválida.");
    if (error) throw new Error(error.message);
    return privateJson({ ok: true });
  } catch (e: any) {
    return fail(e.message);
  }
}
