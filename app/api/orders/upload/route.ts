import { privateJson } from "@/lib/order-server";
import { randomUUID } from "crypto";
import { actor, fail, loadOrder, participant } from "@/lib/order-server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { sb, user, profile } = await actor(req);
    const form = await req.formData();
    const file = form.get("file");
    const id = String(form.get("order_id") || "");
    if (
      !(file instanceof File) ||
      file.size > 8 * 1024 * 1024 ||
      file.size === 0 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return fail("Sube una foto JPG, PNG o WEBP de hasta 8 MB.");
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const valid =
      file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : file.type === "image/png"
          ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) return fail("El archivo no corresponde a una imagen válida.");
    let prefix = "";
    if (id === "topups") {
      if (profile.role !== "delivery") return fail("No autorizado.", 403);
      prefix = `topups/${user.id}`;
    } else {
      const o = await loadOrder(sb, id);
      if (!participant(o, user.id, profile.role) || profile.role === "admin")
        return fail("No autorizado.", 403);
      prefix = `${o.id}/${user.id}`;
    }
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${prefix}/${randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from("pedidos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error("No pudimos guardar la foto.");
    return privateJson({ path });
  } catch (e: any) {
    return fail(e.message);
  }
}
