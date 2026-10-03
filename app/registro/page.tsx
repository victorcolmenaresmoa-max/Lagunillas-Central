import { redirect } from 'next/navigation';
export default async function RegistroPage({ searchParams: pendingSearchParams }: { searchParams: Promise<{ tipo?: string; next?: string }> }) {
  const searchParams = await pendingSearchParams;
  if (searchParams.tipo === 'comercio' || searchParams.tipo === 'repartidor') redirect(`/aliados/registro?tipo=${searchParams.tipo}`);
  redirect(`/registro/cliente${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''}`);
}
