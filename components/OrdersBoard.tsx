"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/auth";
import { ORDER_LABEL, type AppOrder } from "@/lib/orders";
import DeliveryMap from "./DeliveryMap";
import { playChime, unlockAudio } from "@/lib/sound";
import { waLink } from "@/lib/delivery";
export async function uploadOrderPhoto(
  sb: SupabaseClient,
  id: string,
  file: File,
) {
  const { data } = await sb.auth.getSession();
  const form = new FormData();
  form.append("order_id", id);
  form.append("file", file);
  const res = await fetch("/api/orders/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.path as string;
}
export default function OrdersBoard({
  sb,
  role,
}: {
  sb: SupabaseClient;
  role: string;
}) {
  const [orders, setOrders] = useState<any[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("pedido"),
    ),
    [filter, setFilter] = useState("all");
  const seen = useRef<Map<string, string> | null>(null);
  const load = useCallback(async () => {
    try {
      const { orders } = await apiFetch(sb, "/api/orders");
      if (
        seen.current &&
        orders.some((o: any) => seen.current!.get(o.id) !== o.state)
      )
        playChime();
      seen.current = new Map(orders.map((o: any) => [o.id, o.state]));
      setOrders(orders);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, [sb]);
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    return () => clearInterval(t);
  }, [load]);
  const repeat = (o: AppOrder) => {
    localStorage.setItem(
      "lc-repeat",
      JSON.stringify({ merchant_id: o.merchant_id, items: o.items }),
    );
    window.location.href = `/comercio/${o.merchant?.slug}`;
  };
  if (selected)
    return (
      <OrderDetails
        sb={sb}
        role={role}
        id={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  return (
    <section className="space-y-3">
      <h2 className="heading text-2xl">Pedidos en la app</h2>
      {error && (
        <p role="alert" className="rounded-xl bg-teja-100 p-3">
          {error}
        </p>
      )}
      <button
        className="btn-ghost"
        onClick={() => {
          unlockAudio();
          load();
        }}
      >
        Actualizar y activar sonido
      </button>
      {role === "admin" && (
        <label className="block">
          Mostrar
          <select
            className="input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="late">Atascados</option>
            <option value="disputed">En reclamo</option>
          </select>
        </label>
      )}
      {orders
        .filter(
          (o) =>
            filter === "all" ||
            (filter === "disputed" && o.state === "disputed") ||
            (filter === "late" &&
              (o.stalled ||
                (o.deadline_at && Date.parse(o.deadline_at) < Date.now()))),
        )
        .map((o) => (
          <article key={o.id} className="card space-y-2 p-4">
            <div className="flex justify-between gap-2">
              <b>
                {o.code} · {o.merchant?.name}
              </b>
              <span>{ORDER_LABEL[o.state as keyof typeof ORDER_LABEL]}</span>
            </div>
            {o.available ? (
              <>
                <p>
                  {o.sector || "Dentro de Lagunillas"} ·{" "}
                  {Number(o.distance_km).toFixed(1)} km comercio → cliente
                </p>
                <p className="text-xs">{o.approach_km != null ? `Estás a ${Number(o.approach_km).toFixed(1)} km del comercio en línea recta. Este tramo no se cobra al cliente.` : 'Actualiza tu ubicación para ver tu acercamiento al comercio.'}</p>
                <p>
                  Delivery ${Number(o.delivery_fee).toFixed(2)} · comisión $
                  {Math.floor(
                    Number(o.delivery_fee) * Number(o.commission_percent),
                  ) / 100}{" "}
                  · neto $
                  {(
                    Number(o.delivery_fee) -
                    Math.floor(
                      Number(o.delivery_fee) * Number(o.commission_percent),
                    ) /
                      100
                  ).toFixed(2)}
                </p>
                <DeliveryMap
                  point={null}
                  route={o.route_geometry}
                  markers={[
                    { point: o.origin, label: "Comercio" },
                    { point: o.destination, label: "Destino" },
                    ...(o.driver_point ? [{point:o.driver_point,label:'Tu ubicación'}] : []),
                  ]}
                />
                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      await apiFetch(sb, `/api/orders/${o.id}`, {
                        action: "claim",
                      });
                      setSelected(o.id);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  Aceptar delivery
                </button>
              </>
            ) : (
              <>
                <p>
                  Productos ${Number(o.subtotal).toFixed(2)} · delivery $
                  {Number(o.delivery_fee).toFixed(2)}
                </p>
                <button
                  className="btn-primary"
                  onClick={() => setSelected(o.id)}
                >
                  Ver pedido
                </button>
                {role === "client" && o.state === "delivered" && (
                  <button className="btn-ghost" onClick={() => repeat(o)}>
                    Repetir pedido
                  </button>
                )}
              </>
            )}
          </article>
        ))}
      {!orders.length && !error && (
        <p className="card p-4">Todavía no tienes pedidos.</p>
      )}
    </section>
  );
}
function OrderDetails({
  sb,
  role,
  id,
  onBack,
}: {
  sb: SupabaseClient;
  role: string;
  id: string;
  onBack: () => void;
}) {
  const [o, setO] = useState<AppOrder | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [code, setCode] = useState("");
  const [reference, setReference] = useState(""),
    [bank, setBank] = useState(""),
    [amount, setAmount] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(""),
    [photo, setPhoto] = useState<File | null>(null),
    [channel, setChannel] = useState(
      role === "delivery" ? "driver" : "merchant",
    );
  const load = useCallback(async () => {
    try {
      setO(await apiFetch(sb, `/api/orders/${id}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [sb, id]);
  useEffect(() => {
    load();
    const t = setInterval(
      () => document.visibilityState === "visible" && load(),
      10000,
    );
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!o) return;
    setAmount(
      (
        Number(
          o.state.startsWith("delivery") || role === "delivery"
            ? o.delivery_fee
            : o.subtotal,
        ) * Number(o.rate)
      ).toFixed(2),
    );
  }, [o?.state, o?.rate, o?.subtotal, o?.delivery_fee]);
  const act = async (action: string, data: any = {}) => {
    setBusy(true);
    setError("");
    try {
      await apiFetch(sb, `/api/orders/${id}`, { action, ...data });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!o) return <p>{error || "Cargando pedido…"}</p>;
  const customer = role === "client";
  const merchant = role === "merchant";
  const driver = role === "delivery";
  const button = (action: string, label: string, data: any = {}) => (
    <button
      key={action}
      className="btn-primary w-full"
      disabled={busy}
      onClick={() => act(action, data)}
    >
      {label}
    </button>
  );
  const canPay =
    (customer && ["products_payment", "delivery_payment"].includes(o.state)) ||
    (merchant &&
      o.state === "disputed" &&
      o.products_paid &&
      !o.products_refunded) ||
    (driver &&
      o.state === "disputed" &&
      o.delivery_paid &&
      !o.delivery_refunded);
  const canMerchantChat =
    o.state !== "merchant_pending" &&
    !["picked_up", "delivered", "cancelled", "disputed"].includes(o.state);
  const canDriverChat =
    o.delivery_paid &&
    !["cancelled", "disputed"].includes(o.state) &&
    (o.state !== "delivered" ||
      (!!o.delivered_at && Date.now() - Date.parse(o.delivered_at) < 7200000));
  const chatChannels = customer
    ? ["merchant", "driver"]
    : merchant
      ? ["merchant"]
      : driver
        ? ["driver"]
        : ["merchant", "driver"];
  const canChat =
    (channel === "merchant" ? canMerchantChat : canDriverChat) &&
    role !== "admin";
  return (
    <section className="space-y-4">
      <button className="btn-ghost" onClick={onBack}>
        ← Volver a pedidos
      </button>
      <h2 className="heading text-2xl">{o.code}</h2>
      <p className="font-bold">{ORDER_LABEL[o.state]}</p>
      {o.deadline_at && (
        <p className="text-sm">
          Límite:{" "}
          {new Date(o.deadline_at).toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-teja-100 p-3">
          {error}
        </p>
      )}
      {o.reason && <p className="rounded-xl bg-ocre-100 p-3">{o.reason}</p>}
      <div className="card space-y-2 p-4">
        {o.items.map((i) => (
          <p key={i.product_id}>
            {i.qty} × {i.title} · ${(i.qty * i.price).toFixed(2)}
          </p>
        ))}
        <p>
          Productos ${Number(o.subtotal).toFixed(2)} · Bs{" "}
          {(Number(o.subtotal) * Number(o.rate)).toFixed(2)}
        </p>
        <p>
          Delivery ${Number(o.delivery_fee).toFixed(2)} · Bs{" "}
          {(Number(o.delivery_fee) * Number(o.rate)).toFixed(2)}
        </p>
        <p className="text-xs">
          Tasa BCV guardada: {o.rate} · {o.rate_date}.
        </p>
        {o.fulfillment === "delivery" && (
          <p className="text-sm">
            {Number(o.distance_km).toFixed(2)} km ·{" "}
            {o.distance_method === "road"
              ? "ruta por carretera"
              : "distancia estimada; línea recta × factor"}
            .
          </p>
        )}
        <p>{o.address}</p>
        {customer && o.delivery_code && (
          <p className="font-bold">
            Código de entrega: {o.delivery_code}. Dilo cuando recibas el pedido.
          </p>
        )}
        {o.driver && (
          <div>
            {o.driver.photo_url && (
              <img
                src={o.driver.photo_url}
                alt="Tu repartidor"
                className="h-16 w-16 rounded-full object-cover"
              />
            )}
            <p>
              {o.driver.full_name} · {o.driver.vehicle} · {o.driver.plate}
            </p>
            <a
              className="underline"
              href={waLink(o.driver.phone)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp de respaldo
            </a>
          </div>
        )}
        {o.merchant && (
          <a
            className="underline"
            href={waLink(o.merchant.whatsapp_number)}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp del comercio
          </a>
        )}
      </div>
      {o.destination && (
        <DeliveryMap
          point={o.destination}
          route={o.route_geometry}
          markers={[
            { point: o.origin, label: "Comercio" },
            ...(o.driver_position
              ? [{ point: o.driver_position.point, label: "Repartidor" }]
              : []),
          ]}
        />
      )}{" "}
      {o.driver_position && (
        <p className="text-xs">
          Última ubicación:{" "}
          {new Date(o.driver_position.updated_at).toLocaleTimeString("es-VE")}.{" "}
          {Date.now() - Date.parse(o.driver_position.updated_at) > 45000
            ? "Ubicación desactualizada: el repartidor debe abrir la app."
            : ""}
        </p>
      )}
      {merchant && o.state === "merchant_pending" && (
        <>
          {button("accept", "Aceptar pedido")}
          <label className="block">
            Motivo de rechazo
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {button("reject", "Rechazar", { reason })}
        </>
      )}
      {o.payee && (
        <div className="card space-y-2 p-4">
          <h3 className="font-bold">
            Datos para pagar{" "}
            {o.state.startsWith("products")
              ? "productos al comercio"
              : "delivery al repartidor"}
          </h3>
          {(["bank", "phone", "document"] as const).map((k) => (
            <div key={k} className="flex justify-between gap-2">
              <span>{o.payee![k]}</span>
              <button
                className="underline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(o.payee![k])
                    .catch(() => setError("Copia el dato manualmente."))
                }
              >
                Copiar
              </button>
            </div>
          ))}
        </div>
      )}
      {canPay && (
        <div className="card space-y-3 p-4">
          <h3 className="font-bold">
            {o.state === "disputed"
              ? "Comprobante de devolución"
              : "Subir comprobante"}
          </h3>
          <label className="block">
            Últimos 5 dígitos de referencia
            <input
              className="input"
              inputMode="numeric"
              maxLength={5}
              value={reference}
              onChange={(e) => setReference(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="block">
            Banco desde el que pagaste
            <input
              className="input"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            />
          </label>
          <label className="block">
            Monto en bolívares
            <input
              className="input"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block">
            Captura del pago
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            disabled={busy || !file || reference.length !== 5}
            className="btn-primary w-full"
            onClick={async () => {
              setBusy(true);
              try {
                const receipt = await uploadOrderPhoto(sb, id, file!);
                await act("receipt", {
                  receipt,
                  reference,
                  bank,
                  amount: Number(amount),
                });
              } catch (e: any) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            Enviar comprobante
          </button>
        </div>
      )}
      {o.payments?.map((p) => (
        <div className="card space-y-2 p-4" key={p.id}>
          <b>
            {p.kind === "products"
              ? "Pago productos"
              : p.kind === "delivery"
                ? "Pago delivery"
                : "Devolución"}
          </b>
          <p>
            {p.bank} · referencia {p.reference} · Bs {p.amount} · {p.status}
          </p>
          {p.duplicate && (
            <p className="text-teja-600">
              Esta referencia aparece en otro pedido. Revisa tu banco.
            </p>
          )}
          <a
            className="underline"
            href={p.url}
            target="_blank"
            rel="noreferrer"
          >
            Ver comprobante privado
          </a>
          {p.status === "pending" &&
            ((merchant &&
              o.state === "products_review" &&
              p.kind === "products") ||
              (driver &&
                o.state === "delivery_review" &&
                p.kind === "delivery") ||
              (customer && o.state === "disputed" && p.kind === "refund")) && (
              <>
                <p className="text-sm">
                  La captura no prueba que llegó el dinero. Revisa tu banco
                  antes de confirmar.
                </p>
                {button("confirm", "Ya lo vi en mi banco", {
                  payment_id: p.id,
                })}
                {button("not_received", "No lo veo en mi banco", {
                  payment_id: p.id,
                })}
              </>
            )}
        </div>
      ))}
      {merchant &&
        o.products_paid &&
        !o.ready &&
        [
          "searching",
          "delivery_payment",
          "delivery_review",
          "preparing",
        ].includes(o.state) &&
        button("ready", "Pedido listo")}
      {driver &&
        o.state === "preparing" &&
        o.ready &&
        button("picked_up", "Recogido en el comercio")}
      {((driver && o.state === "picked_up") ||
        (merchant && o.state === "pickup_ready")) && (
        <>
          <label className="block">
            Código de 4 dígitos del cliente
            <input
              className="input"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {button("delivered", "Confirmar entrega", { code })}
        </>
      )}
      {customer &&
        (o as any).pickup_offered &&
        o.state === "searching" &&
        button("pickup", "Prefiero retirar en el local")}
      {customer && o.state === "delivered" && !o.rating && (
        <div className="card p-4">
          <p>Califica la entrega</p>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                disabled={busy}
                key={r}
                aria-label={`${r} estrellas`}
                onClick={() => act("rating", { rating: r })}
              >
                {r} ★
              </button>
            ))}
          </div>
        </div>
      )}
      {!["cancelled", "delivered"].includes(o.state) && (
        <div className="space-y-2">
          <label className="block">
            Motivo de cancelación o reclamo
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {customer &&
            o.state !== "disputed" &&
            button(
              "dispute",
              o.delivery_paid
                ? "El repartidor no llegó / reclamar"
                : "Abrir reclamo",
              { reason },
            )}
          {(role === "admin" || merchant || (customer && !o.products_paid)) &&
            button("cancel", "Cancelar pedido / solicitar devolución", {
              reason,
            })}
          {role === "admin" &&
            o.state === "disputed" &&
            button("resolve", "Resolver reclamo y continuar", { reason })}
          {role === "admin" &&
            o.fulfillment === "delivery" &&
            !o.delivery_paid &&
            button("reassign", "Liberar y buscar otro repartidor")}
        </div>
      )}
      {role === "admin" && o.state === "disputed" && (
        <div className="space-y-2">
          <button
            className="btn-ghost"
            onClick={async () => {
              try {
                await apiFetch(sb, "/api/order-profile", {
                  action: "suspend",
                  user_id: o.customer_id,
                  suspended: true,
                });
                setError("Cuenta del cliente suspendida.");
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            Suspender cliente
          </button>
          {o.driver_id && (
            <button
              className="btn-ghost"
              onClick={async () => {
                try {
                  await apiFetch(sb, "/api/order-profile", {
                    action: "suspend",
                    driver_id: o.driver_id,
                    suspended: true,
                  });
                  setError("Repartidor suspendido.");
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              Suspender repartidor
            </button>
          )}
        </div>
      )}
      {(role !== "admin" || o.state === "disputed") && (
        <div className="card space-y-3 p-4">
          <h3 className="font-bold">Chat del pedido</h3>
          <select
            className="input"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {chatChannels.map((ch) => (
              <option key={ch} value={ch}>
                {ch === "merchant"
                  ? "Cliente ↔ comercio"
                  : "Cliente ↔ repartidor"}
              </option>
            ))}
          </select>
          {o.messages
            ?.filter((m) => m.channel === channel)
            .map((m) => (
              <div className="rounded-xl bg-cal-100 p-3" key={m.id}>
                <p>{m.text}</p>
                {m.image_url && (
                  <a href={m.image_url} target="_blank" rel="noreferrer">
                    <img
                      src={m.image_url}
                      alt="Foto compartida en el pedido"
                      className="max-h-48 rounded-lg"
                    />
                  </a>
                )}
                <p className="text-xs">
                  {new Date(m.created_at).toLocaleTimeString("es-VE")}
                </p>
              </div>
            ))}
          {canChat ? (
            <>
              <div className="flex flex-wrap gap-2">
                {[
                  "Ya llegué",
                  "Estoy afuera",
                  "No encuentro la dirección",
                  "Voy en 5 min",
                ].map((t) => (
                  <button
                    key={t}
                    disabled={busy}
                    className="btn-ghost"
                    onClick={() => act("message", { channel, text: t })}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="block">
                Mensaje
                <textarea
                  className="input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                />
              </label>
              <label className="block">
                Foto de fachada o paquete
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                />
              </label>
              <button
                disabled={busy || (!text && !photo)}
                className="btn-primary"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const image_path = photo
                      ? await uploadOrderPhoto(sb, id, photo)
                      : undefined;
                    await act("message", { channel, text, image_path });
                    setText("");
                    setPhoto(null);
                  } catch (e: any) {
                    setError(e.message);
                    setBusy(false);
                  }
                }}
              >
                Enviar
              </button>
            </>
          ) : (
            <p className="text-sm">
              {role === "admin"
                ? "Lectura autorizada por el reclamo."
                : "Este chat está cerrado en este paso."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
