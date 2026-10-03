import { redirect } from 'next/navigation';
export default function RegistroPage({ searchParams }: { searchParams: { tipo?: string; next?: string } }) {
  if (searchParams.tipo === 'comercio' || searchParams.tipo === 'repartidor') redirect(`/aliados/registro?tipo=${searchParams.tipo}`);
  redirect(`/registro/cliente${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''}`);
}
