"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import OrderProfile from "@/components/OrderProfile";
export default function Account() {
  const { loading, session, supabase: sb } = useAuth("client");
  if (loading || !sb || !session) return <p className="p-6">Cargando…</p>;
  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-16">
      <h1 className="heading text-3xl">Mi cuenta</h1>
      <nav className="flex gap-4">
        <Link href="/">Comercios</Link>
        <Link href="/mis-pedidos">Mis pedidos</Link>
      </nav>
      <OrderProfile sb={sb} role="client" />
    </main>
  );
}
