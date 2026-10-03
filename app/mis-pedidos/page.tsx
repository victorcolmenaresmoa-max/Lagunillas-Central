"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import OrdersBoard from "@/components/OrdersBoard";
import { PanelHeader, PushCard } from "@/components/panel";
export default function MyOrders() {
  const { loading, session, supabase: sb, profile } = useAuth("client");
  if (loading || !session || !sb)
    return <p className="p-6">Cargando tu cuenta…</p>;
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 p-4 pb-24">
      <PanelHeader
        sb={sb}
        avatar={null}
        title={profile?.full_name || "Mis pedidos"}
        subtitle="Tu cuenta de cliente"
      />
      <nav className="flex gap-4">
        <Link href="/">Comercios</Link>
        <Link href="/mi-cuenta">Mis direcciones</Link>
      </nav>
      <PushCard
        sb={sb}
        userId={session.user.id}
        text="Recibe avisos de aceptación, pagos, chat y entrega."
      />
      <OrdersBoard sb={sb} role="client" />
    </main>
  );
}
