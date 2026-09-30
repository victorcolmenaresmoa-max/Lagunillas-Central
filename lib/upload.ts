'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sube fotos a Supabase Storage (bucket "media").
 * Antes de subir, la foto se reduce y convierte a WEBP en el teléfono:
 * carga rápido para los clientes y ocupa poco espacio.
 */

const BUCKET = 'media';
const MAX_INPUT = 15 * 1024 * 1024; // 15 MB antes de comprimir

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {}
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No pudimos leer esa foto. Prueba con otra.'));
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(file: File, maxSide = 1400, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Ese archivo no es una foto.');
  if (file.size > MAX_INPUT) throw new Error('La foto es muy pesada (máximo 15 MB).');
  const img = await loadImage(file);
  const w = 'width' in img ? img.width : 0;
  const h = 'height' in img ? img.height : 0;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (blob && blob.type === 'image/webp') return blob;
  // Safari antiguo no genera WEBP: usamos JPG
  const jpg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!jpg) throw new Error('No pudimos procesar la foto.');
  return jpg;
}

/** Sube la foto y devuelve su enlace público */
export async function uploadImage(
  sb: SupabaseClient,
  userId: string,
  file: File,
  kind: 'logo' | 'portada' | 'producto' | 'perfil',
  opts?: { maxSide?: number }
): Promise<string> {
  const blob = await compressImage(file, opts?.maxSide ?? (kind === 'portada' ? 1600 : kind === 'producto' ? 1000 : 600));
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const upload = new File([blob], `${kind}.${ext}`, { type: blob.type });
  const { error } = await sb.storage.from(BUCKET).upload(path, upload, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Borra una foto anterior que ya no se usa (si es nuestra) */
export async function removeImage(sb: SupabaseClient, publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  if (i === -1) return;
  const path = decodeURIComponent(publicUrl.slice(i + marker.length));
  await sb.storage.from(BUCKET).remove([path]).catch(() => {});
}
