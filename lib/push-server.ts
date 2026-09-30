import 'server-only';
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@lagunillascentral.app';
const configured = Boolean(publicKey && privateKey);
if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** true para avisos importantes: suenan y quedan fijos hasta que el usuario los toque */
  urgent?: boolean;
}

/** Envía una notificación a todos los teléfonos de esos usuarios. Nunca lanza error. */
export async function sendPush(sb: SupabaseClient, userIds: string[], payload: PushPayload): Promise<number> {
  if (!configured || userIds.length === 0) return 0;
  const { data: subs } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds);
  if (!subs?.length) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 30, urgency: payload.urgent ? 'high' : 'normal' }
        );
        sent++;
      } catch (err: any) {
        // 404/410 = el teléfono ya no acepta notificaciones: se limpia
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await sb.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          console.error('[push]', err?.statusCode, err?.body || err?.message);
        }
      }
    })
  );
  return sent;
}

/** Avisa a todos los repartidores aprobados y disponibles */
export async function notifyOnlineDrivers(sb: SupabaseClient, payload: PushPayload) {
  const { data } = await sb.from('drivers').select('user_id').eq('status', 'approved').eq('is_online', true);
  return sendPush(sb, (data ?? []).map((d) => d.user_id), payload);
}

/** Avisa a los administradores */
export async function notifyAdmins(sb: SupabaseClient, payload: PushPayload) {
  const { data } = await sb.from('profiles').select('user_id').eq('role', 'admin');
  return sendPush(sb, (data ?? []).map((d) => d.user_id), payload);
}
