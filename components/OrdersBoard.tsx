"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/auth";
import { ORDER_LABEL, type AppOrder } from "@/lib/orders";
import AddressLinks from "./AddressLinks";
import VoiceNote from "./VoiceNote";
import AudioMessage from "./AudioMessage";
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
                  {o.sector || "Lagunillas"} · {o.address}
                </p>
                <p className="text-sm">
                  Revisa el acceso antes de aceptar. Los pedidos nuevos se pagan
                  al llegar.
                </p>
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
                <AddressLinks
                  address={o.merchant_address || o.merchant?.address || ""}
                  navigate
                />
                <AddressLinks
                  address={o.address || ""}
                  sector={o.sector}
                  navigate
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
    [inPerson, setInPerson] = useState(false),
    [text, setText] = useState(""),
    [photo, setPhoto] = useState<File | null>(null),
    [audio, setAudio] = useState<File | null>(null),
    [channel, setChannel] = useState(
      role === "admin"
        ? "support"
        : role === "delivery"
          ? "driver"
          : "merchant",
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
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
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
  const recent =
    !!o.delivered_at && Date.now() - Date.parse(o.delivered_at) < 48 * 3600000;
  const open = !["cancelled", "delivered"].includes(o.state) || recent;
  const chatChannels = customer
    ? [
        "merchant",
        ...(o.driver_id ? ["driver"] : []),
        ...(o.state === "disputed" ? ["support"] : []),
      ]
    : merchant
      ? ["merchant", ...(o.state === "disputed" ? ["support"] : [])]
      : driver
        ? ["driver", ...(o.state === "disputed" ? ["support"] : [])]
        : ["support"];
  const canChat =
    role === "admin"
      ? o.state === "disputed" && channel === "support"
      : open && chatChannels.includes(channel);
  const cod = o.payment_mode === "on_receipt";
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
            {o.distance_method === "fixed"
              ? "Tarifa fija acordada antes de pedir."
              : "Pedido anterior: conserva su tarifa original."}
          </p>
        )}
        {cod && (
          <p className="rounded-xl bg-laguna-100 p-3">
            Pago al recibir: productos al comercio y delivery al repartidor.
            Confirma el importe, paga solo con el pedido presente y comparte el
            código al recibir el paquete.
          </p>
        )}
        <p>{o.merchant_address || o.merchant?.address}</p>
        <AddressLinks
          address={o.merchant_address || o.merchant?.address || ""}
          navigate
        />
        <p>{o.address}</p>
        {o.fulfillment === "delivery" && (
          <AddressLinks address={o.address} sector={o.sector} navigate />
        )}
        {merchant && cod && o.pickup_code && (
          <p className="font-bold">
            Código de recogida: {o.pickup_code}. Dáselo al repartidor asignado
            al entregarle el paquete.
          </p>
        )}
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
          {cod && customer && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={inPerson}
                onChange={(e) => setInPerson(e.target.checked)}
              />
              Tengo el pedido presente y estoy realizando el pago al recibir, no
              por adelantado.
            </label>
          )}
          <button
            disabled={
              busy ||
              !file ||
              reference.length !== 5 ||
              (cod && customer && !inPerson)
            }
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
                  in_person: inPerson,
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
        (o.products_paid || cod) &&
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
        (cod ? (
          <>
            <label className="block">
              Código de recogida del comercio
              <input
                className="input"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            {button("picked_up", "Confirmar recogida", { code })}
          </>
        ) : (
          button("picked_up", "Recogido en el comercio")
        ))}
      {cod &&
        driver &&
        o.state === "picked_up" &&
        button("arrived", "Estoy con el cliente: habilitar pago al recibir")}
      {cod &&
        customer &&
        o.state === "pickup_ready" &&
        button("begin_payment", "Estoy en el local: pagar y retirar")}
      {((driver &&
        (cod ? o.state === "awaiting_handover" : o.state === "picked_up")) ||
        (merchant &&
          (cod
            ? o.state === "awaiting_handover"
            : o.state === "pickup_ready"))) && (
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
      {o.state !== "cancelled" && (o.state !== "delivered" || recent) && (
        <div className="space-y-2">
          <label className="block">
            Motivo de cancelación o reclamo
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {(customer || merchant || driver || role === "admin") &&
            o.state !== "disputed" &&
            button(
              "dispute",
              o.delivery_paid
                ? "El repartidor no llegó / reclamar"
                : "Abrir reclamo",
              { reason },
            )}
          {o.state !== "delivered" &&
            (role === "admin" || merchant || driver || customer) &&
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
          {cod &&
            o.state === "disputed" &&
            driver &&
            o.collected_at &&
            !o.delivered_at &&
            !o.returned_by_driver &&
            button("return_sent", "Devolví el paquete al comercio")}
          {cod &&
            o.state === "disputed" &&
            merchant &&
            o.returned_by_driver &&
            !o.returned_to_merchant &&
            button("return_received", "Recibí el paquete devuelto")}
          {cod &&
            o.state === "disputed" &&
            role === "admin" &&
            o.collected_at &&
            !o.delivered_at &&
            button(
              "record_loss",
              "Registrar pérdida del paquete con resolución documentada",
              { reason },
            )}
          {cod &&
            o.state === "disputed" &&
            role === "admin" &&
            button(
              "close_cancel",
              "Cerrar cancelación tras revisar pagos y devolución",
              { reason },
            )}
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
                  : ch === "driver"
                    ? "Cliente ↔ repartidor"
                    : "Soporte y participantes"}
              </option>
            ))}
          </select>
          {o.messages
            ?.filter((m) => m.channel === channel)
            .map((m) => (
              <div className="rounded-xl bg-cal-100 p-3" key={m.id}>
                <p className="text-xs font-bold">
                  {(m as any).sender_label || "Participante"}
                </p>
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
                {m.audio_url && <AudioMessage url={m.audio_url} />}
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
              <VoiceNote disabled={busy} onReady={setAudio} />
              <label className="block">
                Adjuntar audio (hasta 8 MB)
                <input
                  type="file"
                  accept="audio/webm,audio/ogg,audio/mpeg,audio/mp4"
                  onChange={(e) => setAudio(e.target.files?.[0] || null)}
                />
              </label>
              {audio && (
                <div className="flex gap-2">
                  <p>Audio listo: {audio.name}</p>
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => setAudio(null)}
                  >
                    Quitar audio
                  </button>
                </div>
              )}
              <p className="text-xs">
                Enviar mensajes o capturas en el chat no confirma pagos. Usa el
                formulario de comprobante y revisa el banco.
              </p>
              <button
                disabled={busy || (!text && !photo && !audio)}
                className="btn-primary"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const image_path = photo
                      ? await uploadOrderPhoto(sb, id, photo)
                      : undefined;
                    const audio_path = audio
                      ? await uploadOrderPhoto(sb, id, audio)
                      : undefined;
                    const sent = await act("message", {
                      channel,
                      text,
                      image_path,
                      audio_path,
                    });
                    if (sent) {
                      setText("");
                      setPhoto(null);
                      setAudio(null);
                    }
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
