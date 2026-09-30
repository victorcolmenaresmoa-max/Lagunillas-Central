import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

/**
 * Mantiene la sesión al día y protege los paneles:
 * sin sesión, /panel, /repartidor y /admin mandan a /entrar.
 * (El rol se verifica en cada panel y, sobre todo, en la base de datos.)
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;

  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;
  const isPrivate = ['/panel', '/repartidor', '/admin'].some((p) => path === p || path.startsWith(p + '/'));
  if (!session && isPrivate) {
    const to = new URL('/entrar', req.url);
    to.searchParams.set('next', path);
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  matcher: ['/panel/:path*', '/repartidor/:path*', '/admin/:path*', '/entrar', '/registro'],
};
