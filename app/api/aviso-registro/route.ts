import { NextResponse } from 'next/server';
import { getRequestUser, getServiceClient } from '@/lib/supabase-server';
import { notifyAdmins } from '@/lib/push-server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Avisa a la administración que hay un registro nuevo esperando aprobación */
export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });
  const sb = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: m }, { data: d }] = await Promise.all([
    sb.from('merchants').select('name, category').eq('user_id', auth.user.id).eq('status', 'pending').gte('created_at', weekAgo).maybeSingle(),
    sb.from('drivers').select('full_name, vehicle').eq('user_id', auth.user.id).eq('status', 'pending').gte('created_at', weekAgo).maybeSingle(),
  ]);
  if (m) {
    await notifyAdmins(sb, { title: '🏪 Nuevo comercio por aprobar', body: `${m.name} · ${m.category}`, url: '/admin?tab=comercios' });
  } else if (d) {
    await notifyAdmins(sb, { title: '🛵 Nuevo repartidor por aprobar', body: d.full_name, url: '/admin?tab=repartidores' });
  }
  return NextResponse.json({ ok: true });
}
