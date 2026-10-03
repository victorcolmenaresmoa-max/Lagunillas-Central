import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({error:'Los pedidos nuevos requieren cuenta y se crean desde el carrito dentro de la app.'},{status:410}); }
