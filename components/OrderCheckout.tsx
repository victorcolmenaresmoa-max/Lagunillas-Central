"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, apiFetch } from "@/lib/auth";
import type { Merchant, Product } from "@/lib/types";
import type { Address } from "@/lib/orders";
import { waLink } from "@/lib/delivery";
export default function OrderCheckout({
  merchant,
  items,
  onClose,
  onSent,
  onQty,
}: {
  merchant: Merchant;
  items: { product: Product; qty: number; price: number }[];
  onClose: () => void;
  onSent: () => void;
  onQty: (id: string, d: number) => void;
  [key: string]: any;
}) {
  const { session, supabase: sb, loading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]),
    [addressId, setAddressId] = useState(""),
    [mode, setMode] = useState("delivery"),
    [quote, setQuote] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  useEffect(() => {
    if (!sb || !session) return;
    apiFetch(sb, "/api/order-profile")
      .then((d) => {
        setAddresses(d.addresses);
        setAddressId(d.addresses[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, [sb, session]);
  useEffect(() => {
    setQuote(null);
    if (!sb || !session || (mode === "delivery" && !addressId)) return;
    let active = true;
    apiFetch(sb, "/api/orders/quote", {
      merchant_id: merchant.id,
      address_id: addressId,
      fulfillment: mode,
    })
      .then((q) => {
        if (active) {
          setQuote(q);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [sb, session, mode, addressId, merchant.id]);
  const send = async () => {
    if (!sb || !quote) return;
    setBusy(true);
    setError("");
    try {
      const { id } = await apiFetch(sb, "/api/orders", {
        merchant_id: merchant.id,
        address_id: addressId,
        fulfillment: mode,
        expected_fee: quote.fee,
        items: items.map((i) => ({ product_id: i.product.id, qty: i.qty })),
      });
      onSent();
      window.location.href = `/mis-pedidos?pedido=${id}`;
    } catch (e: any) {
      setError(e.message);
      try {
        setQuote(
          await apiFetch(sb, "/api/orders/quote", {
            merchant_id: merchant.id,
            address_id: addressId,
            fulfillment: mode,
          }),
        );
      } catch {
        setQuote(null);
      }
    } finally {
      setBusy(false);
    }
  };
  const wa = waLink(
    merchant.whatsapp_number,
    [
      `Hola, ${merchant.name}. Quiero retirar en el local:`,
      ...items.map((i) => `${i.qty} × ${i.product.title}`),
      `Total de referencia: $${total.toFixed(2)}`,
    ].join("\n"),
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar pedido"
    >
      <button
        className="absolute inset-0 bg-tinta-900/40"
        onClick={onClose}
        aria-label="Cerrar pedido"
      />
      <div className="relative max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-cal-50 p-5">
        <div className="flex justify-between">
          <h2 className="heading text-2xl">Tu pedido</h2>
          <button onClick={onClose}>Cerrar</button>
        </div>
        <p>{merchant.name}</p>
        {items.map((i) => (
          <div
            key={i.product.id}
            className="flex items-center justify-between gap-2"
          >
            <span>
              {i.qty} × {i.product.title}
            </span>
            <div>
              <button
                aria-label={`Quitar ${i.product.title}`}
                className="btn-ghost"
                onClick={() => onQty(i.product.id, -1)}
              >
                −
              </button>
              <button
                aria-label={`Agregar ${i.product.title}`}
                className="btn-ghost"
                onClick={() => onQty(i.product.id, 1)}
              >
                +
              </button>
            </div>
          </div>
        ))}
        <Link href="/cobertura" className="underline text-sm" target="_blank">
          Ver cobertura de Lagunillas
        </Link>
        <label className="block">
          Entrega
          <select
            className="input"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="delivery">Delivery dentro de Lagunillas</option>
            <option value="pickup">Retiro en el local</option>
          </select>
        </label>
        {loading ? (
          <p>Cargando tu cuenta…</p>
        ) : !session ? (
          <div className="card space-y-2 p-4">
            <p>
              Para pedir y pagar dentro de la app necesitas una cuenta con
              correo confirmado.
            </p>
            <Link
              className="btn-primary w-full"
              href={`/entrar?next=${encodeURIComponent("/comercio/" + merchant.slug)}`}
            >
              Iniciar sesión
            </Link>
            <Link className="btn-ghost w-full" href="/registro/cliente">
              Crear cuenta de cliente
            </Link>
          </div>
        ) : (
          <>
            {mode === "delivery" && (
              <>
                <label className="block">
                  Dirección guardada
                  <select
                    className="input"
                    value={addressId}
                    onChange={(e) => setAddressId(e.target.value)}
                  >
                    <option value="">Elige tu dirección</option>
                    {addresses.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.label} · {a.sector}
                      </option>
                    ))}
                  </select>
                </label>
                <Link className="underline text-sm" href="/mi-cuenta">
                  Guardar o modificar mis direcciones
                </Link>
              </>
            )}
            {quote && (
              <div className="card p-4">
                <p>Productos: ${total.toFixed(2)}</p>
                <p>Delivery: ${Number(quote.fee).toFixed(2)}</p>
                <p className="font-bold">
                  Total: ${(total + Number(quote.fee)).toFixed(2)}
                </p>
                {mode === "delivery" && (
                  <p className="text-xs">
                    {Number(quote.km).toFixed(2)} km ·{" "}
                    {quote.method === "road"
                      ? "distancia por carretera"
                      : "estimación con factor de recorrido"}
                    . El tramo del repartidor al comercio no se cobra.
                  </p>
                )}
              </div>
            )}
            <p className="text-sm">
              El comercio acepta primero. Después pagas los productos al
              comercio y el delivery al repartidor, cada uno con su comprobante.
            </p>
            <button
              className="btn-primary w-full"
              disabled={busy || !quote || !items.length}
              onClick={send}
            >
              {busy ? "Enviando…" : "Enviar pedido al comercio"}
            </button>
            <p className="text-xs">
              Al confirmar aceptas los{" "}
              <Link href="/terminos" className="underline">
                Términos
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" className="underline">
                Privacidad
              </Link>
              .
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-teja-100 p-3">
            {error}
          </p>
        )}
        {mode === "pickup" && (
          <a
            className="btn-ghost w-full"
            href={wa}
            target="_blank"
            rel="noreferrer"
            onClick={onSent}
          >
            Pedir retiro por WhatsApp sin cuenta
          </a>
        )}
      </div>
    </div>
  );
}
