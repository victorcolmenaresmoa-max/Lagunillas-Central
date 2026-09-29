import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

/**
 * Protege el panel: si no hay sesión, redirige a /admin/login.
 * Si Supabase aún no está configurado, deja pasar (modo demostración).
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('TU-PROYECTO')) return res;

  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isLogin = req.nextUrl.pathname.startsWith('/admin/login');
  if (!session && !isLogin) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }
  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
