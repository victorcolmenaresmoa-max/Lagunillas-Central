import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

/** Recibe los enlaces que llegan por correo (confirmar cuenta, cambiar contraseña) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/entrar';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/entrar';
  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/entrar?error=enlace', url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
