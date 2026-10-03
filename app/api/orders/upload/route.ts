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
    const audioTypes: Record<string, string> = {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
    };
    const mime = file instanceof File ? file.type.split(";")[0] : "";
    const audio = !!audioTypes[mime];
    if (
      !(file instanceof File) ||
      file.size > 8 * 1024 * 1024 ||
      file.size === 0 ||
      (!audio && !["image/jpeg", "image/png", "image/webp"].includes(mime))
    )
      return fail("Sube una imagen o audio compatible de hasta 8 MB.");
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const valid = audio
      ? mime === "audio/webm"
        ? bytes[0] === 0x1a &&
          bytes[1] === 0x45 &&
          bytes[2] === 0xdf &&
          bytes[3] === 0xa3
        : mime === "audio/ogg"
          ? String.fromCharCode(...bytes.slice(0, 4)) === "OggS"
          : mime === "audio/mp4"
            ? String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
            : String.fromCharCode(...bytes.slice(0, 3)) === "ID3" ||
              (bytes[0] === 255 && (bytes[1] & 224) === 224)
      : mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === "image/png"
          ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) return fail("El archivo no corresponde al tipo indicado.");
    let prefix = "";
    if (id === "topups") {
      if (audio)
        return fail("Las recargas requieren una imagen del comprobante.");
      if (profile.role !== "delivery") return fail("No autorizado.", 403);
      prefix = `topups/${user.id}`;
    } else {
      const o = await loadOrder(sb, id);
      if (
        !participant(o, user.id, profile.role) ||
        (profile.role === "admin" && o.state !== "disputed")
      )
        return fail("No autorizado.", 403);
      prefix = `${o.id}/${user.id}`;
    }
    const ext = audio
      ? audioTypes[mime]
      : mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${prefix}/${randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from("pedidos")
      .upload(path, file, { contentType: mime, upsert: false });
    if (error) throw new Error("No pudimos guardar la foto.");
    return privateJson({ path });
  } catch (e: any) {
    return fail(e.message);
  }
}
