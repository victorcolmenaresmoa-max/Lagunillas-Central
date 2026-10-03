"use client";
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/auth";
import { DEFAULT_CONFIG, type DeliveryConfig } from "@/lib/geo";
import type { Address, PaymentAccount } from "@/lib/orders";
import { uploadOrderPhoto } from "./OrdersBoard";
import AddressLinks from "./AddressLinks";
export default function OrderProfile({
  sb,
  role,
}: {
  sb: SupabaseClient;
  role: string;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  const [c, setC] = useState<DeliveryConfig>(DEFAULT_CONFIG);
  const [account, setAccount] = useState<PaymentAccount>({
    bank: "",
    phone: "",
    document: "",
    cash: false,
  });
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [label, setLabel] = useState(""),
    [address, setAddress] = useState(""),
    [sector, setSector] = useState("");
  const [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const load = useCallback(async () => {
    try {
      const d = await apiFetch(sb, "/api/order-profile");
      setData(d);
      setC(d.config);
      setAccount({
        bank: "",
        phone: "",
        document: "",
        cash: false,
        ...d.account,
      });
      setName(d.profile.full_name || "");
      setPhone(d.profile.phone || "");
    } catch (e: any) {
      setError(e.message);
    }
  }, [sb]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async (b: any) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await apiFetch(sb, "/api/order-profile", b);
      await load();
      setInfo("Guardado.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <p>{error || "Cargando datos de pedidos…"}</p>;
  return (
    <section className="card space-y-4 p-4">
      <h2 className="heading text-xl">
        {role === "admin"
          ? "Pedidos: tarifa fija y pagos"
          : "Datos para pedidos"}
      </h2>
      {error && (
        <p role="alert" className="text-teja-600">
          {error}
        </p>
      )}
      {info && <p role="status">{info}</p>}
      {role === "client" && (
        <>
          <label className="block">
            Nombre
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            Teléfono
            <input
              className="input"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => save({ action: "identity", name, phone })}
          >
            Guardar mis datos
          </button>
          <h3 className="font-bold">Mis direcciones</h3>
          {data.addresses.map((a: Address) => (
            <div className="rounded-xl bg-cal-100 p-3 space-y-2" key={a.id}>
              <b>{a.label}</b>
              <p>
                {a.address} · {a.sector}
              </p>
              <AddressLinks address={a.address} sector={a.sector} />
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => save({ action: "delete_address", id: a.id })}
              >
                Eliminar
              </button>
            </div>
          ))}
          <label className="block">
            Nombre de la dirección
            <input
              className="input"
              value={label}
              placeholder="Mi casa"
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="block">
            Sector o barrio
            <input
              className="input"
              value={sector}
              maxLength={80}
              onChange={(e) => setSector(e.target.value)}
            />
          </label>
          <label className="block">
            Calle, número de casa y referencia
            <textarea
              className="input"
              value={address}
              maxLength={200}
              placeholder="Calle…, casa…, frente a…"
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <AddressLinks address={address} sector={sector} />
          <p className="text-sm">
            Comprueba que Google Maps encuentre el lugar correcto. Incluye una
            referencia clara; el repartidor confirma que puede llegar antes de
            aceptar.
          </p>
          <button
            className="btn-primary"
            disabled={
              busy || address.trim().length < 6 || label.trim().length < 2
            }
            onClick={() => save({ action: "address", label, address, sector })}
          >
            Guardar dirección
          </button>
        </>
      )}
      {["merchant", "delivery"].includes(role) && (
        <>
          <p>
            El cliente paga cuando el pedido está presente. Estos datos se
            muestran en el paso de pago; revisa tu banco antes de confirmar.
          </p>
          {(["bank", "phone", "document"] as const).map((k) => (
            <label className="block" key={k}>
              {
                {
                  bank: "Banco",
                  phone: "Teléfono de pago móvil",
                  document: "Cédula o RIF",
                }[k]
              }
              <input
                className="input"
                value={account[k]}
                onChange={(e) =>
                  setAccount({ ...account, [k]: e.target.value })
                }
              />
            </label>
          ))}
          {role === "merchant" && (
            <p>
              Guarda la dirección escrita del negocio en Perfil. Se abrirá
              externamente en Google Maps.
            </p>
          )}
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => save({ action: "account", account })}
          >
            Guardar datos de pago móvil
          </button>
        </>
      )}
      {role === "delivery" && (
        <>
          <h3 className="font-bold">
            Saldo para comisiones: ${Number(data.wallet).toFixed(2)}
          </h3>
          <p>
            Reservado: ${Number(data.reserved).toFixed(2)} · Disponible: $
            {(Number(data.wallet) - Number(data.reserved)).toFixed(2)}
          </p>
          <p>
            Al aceptar se reserva la comisión; al entregar se descuenta una sola
            vez. La recarga se acredita cuando administración verifica su banco.
          </p>
          <label className="block">
            Monto de recarga en dólares
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
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
            Comprobante
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={busy || !file}
            onClick={async () => {
              setBusy(true);
              try {
                const receipt = await uploadOrderPhoto(sb, "topups", file!);
                await save({
                  action: "topup",
                  amount: Number(amount),
                  reference,
                  receipt,
                });
              } catch (e: any) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            Solicitar recarga
          </button>
        </>
      )}
      {role === "admin" && (
        <>
          <p>
            Tarifa fija para nuevos pedidos dentro de Lagunillas. No se calcula
            distancia ni cobertura automáticamente. Los aliados revisan las
            direcciones antes de aceptar.
          </p>
          {(
            [
              ["base", "Tarifa fija de delivery ($)"],
              ["commission", "Comisión del delivery (%)"],
              ["bcv", "Tasa BCV (Bs por $)"],
            ] as const
          ).map(([k, text]) => (
            <label className="block" key={k}>
              {text}
              <input
                className="input"
                type="number"
                min={0}
                step="any"
                value={c[k]}
                onChange={(e) =>
                  setC({
                    ...c,
                    [k]: Number(e.target.value),
                    ...(k === "base"
                      ? { cap: Math.max(c.cap, Number(e.target.value)) }
                      : {}),
                  })
                }
              />
            </label>
          ))}
          <label className="block">
            Fecha de la tasa
            <input
              className="input"
              type="date"
              value={c.bcvDate}
              onChange={(e) => setC({ ...c, bcvDate: e.target.value })}
            />
          </label>
          {Object.entries({
            accept: "Aceptar pedido",
            search: "Conseguir repartidor",
            products: "Pago de productos al llegar",
            merchantConfirm: "Revisión de pago del comercio",
            delivery: "Pago de delivery al llegar",
            driverConfirm: "Revisión de pago del repartidor",
          }).map(([k, text]) => (
            <label className="block" key={k}>
              {text} (minutos)
              <input
                className="input"
                type="number"
                min={1}
                max={120}
                value={(c.minutes as any)[k]}
                onChange={(e) =>
                  setC({
                    ...c,
                    minutes: { ...c.minutes, [k]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          <p className="text-sm">
            Preparación: 30 min; traslado: 45 min; entrega tras pagos: 15 min.
            Vencer estos plazos abre una incidencia; no confirma dinero ni
            entrega.
          </p>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => save({ action: "config", config: c })}
          >
            Guardar tarifa y tiempos
          </button>
          <h3 className="font-bold">Recargas pendientes</h3>
          {!data.topups.length && <p>No hay recargas pendientes.</p>}
          {data.topups.map((t: any) => (
            <div className="rounded-xl bg-cal-100 p-3" key={t.id}>
              <b>
                {t.driver?.full_name} · ${Number(t.amount).toFixed(2)}
              </b>
              <p>Referencia {t.reference}</p>
              <a
                className="underline"
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver comprobante
              </a>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => save({ action: "approve_topup", id: t.id })}
              >
                Ya lo vi en mi banco: aprobar
              </button>
            </div>
          ))}
          {data.suspended?.map((p: any) => (
            <div key={p.user_id}>
              {p.full_name || "Cuenta"}
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() =>
                  save({
                    action: "suspend",
                    user_id: p.user_id,
                    suspended: false,
                  })
                }
              >
                Reactivar acceso a pedidos
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
