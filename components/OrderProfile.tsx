"use client";
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/auth";
import { DEFAULT_CONFIG, type DeliveryConfig, type Point } from "@/lib/geo";
import type { Address, PaymentAccount } from "@/lib/orders";
import DeliveryMap, { PointPicker } from "./DeliveryMap";
import { uploadOrderPhoto } from "./OrdersBoard";
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
  const [c, setC] = useState<DeliveryConfig>(DEFAULT_CONFIG),
    [point, setPoint] = useState<Point | null>(null),
    [account, setAccount] = useState<PaymentAccount>({
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
  const [reference, setReference] = useState(""),
    [amount, setAmount] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [drawing, setDrawing] = useState(false),
    [sectorName, setSectorName] = useState("");
  const load = useCallback(async () => {
    try {
      const d = await apiFetch(sb, "/api/order-profile");
      setData(d);
      setC(d.config);
      setPoint(d.point);
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
  if (!data)
    return <p role="status">{error || "Cargando datos de pedidos…"}</p>;
  return (
    <section className="card space-y-4 p-4">
      <h2 className="heading text-xl">
        {role === "admin"
          ? "Pedidos: tarifas y cobertura"
          : "Datos para pedidos"}
      </h2>
      {error && (
        <p role="alert" className="text-teja-600">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="text-laguna-600">
          {info}
        </p>
      )}
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
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
            <div className="rounded-xl bg-cal-100 p-3" key={a.id}>
              <b>{a.label}</b>
              <p>{a.address}</p>
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
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Mi casa"
            />
          </label>
          <label className="block">
            Sector o barrio
            <input
              className="input"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            />
          </label>
          <label className="block">
            Calle, casa y referencia
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <PointPicker
            point={point}
            onChange={setPoint}
            coverage={c.coverage}
            sectors={c.sectors}
          />
          <button
            className="btn-primary"
            disabled={busy || !point}
            onClick={() =>
              save({ action: "address", label, address, sector, point })
            }
          >
            Guardar dirección
          </button>
        </>
      )}
      {["merchant", "delivery"].includes(role) && (
        <>
          <p className="text-sm">
            Estos datos de pago solo se muestran al cliente cuando corresponde
            pagar.
          </p>
          {(["bank", "phone", "document"] as const).map((k) => (
            <label className="block" key={k}>
              {
                {
                  bank: "Banco",
                  phone: "Teléfono de pago móvil",
                  document: "Cédula o RIF (V12345678 / J123456789)",
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
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={account.cash}
              onChange={(e) =>
                setAccount({ ...account, cash: e.target.checked })
              }
            />
            Acepto efectivo para acuerdos de retiro / WhatsApp
          </label>
          {role === "merchant" && (
            <>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={!!account.pos}
                  onChange={(e) =>
                    setAccount({ ...account, pos: e.target.checked })
                  }
                />
                Acepto punto de venta
              </label>
              <label className="block">
                Zelle (opcional)
                <input
                  className="input"
                  value={account.zelle || ""}
                  onChange={(e) =>
                    setAccount({ ...account, zelle: e.target.value })
                  }
                />
              </label>
              <h3 className="font-bold">Ubicación del comercio</h3>
              <PointPicker
                point={point}
                onChange={setPoint}
                coverage={c.coverage}
                sectors={c.sectors}
              />
            </>
          )}
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => save({ action: "account", account, point })}
          >
            Guardar datos de pago{role === "merchant" ? " y ubicación" : ""}
          </button>
          <p className="text-xs text-tinta-500">
            Los pedidos con comprobante dentro de la app usan pago móvil. Las
            otras formas de pago se acuerdan directamente.
          </p>
        </>
      )}
      {role === "delivery" && (
        <>
          <h3 className="font-bold">
            Saldo para comisiones: ${Number(data.wallet).toFixed(2)}
          </h3>
          <p className="text-sm">
            La administración te indica los datos de pago para recargar. Solo se
            acredita después de que confirme el dinero en su banco.
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
              accept="image/png,image/jpeg,image/webp"
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
          <p className="text-sm">
            La cobertura inicial es operativa y aproximada. Revísala en el mapa
            antes de activar pedidos. No equivale a límites oficiales de
            barrios.
          </p>
          {(
            [
              ["base", "Base ($)"],
              ["includedKm", "Kilómetros incluidos"],
              ["perKm", "Por km adicional ($)"],
              ["step", "Redondeo hacia arriba ($)"],
              ["cap", "Tope ($)"],
              ["factor", "Factor para distancia estimada"],
              ["commission", "Comisión (%)"],
              ["bcv", "Tasa BCV (Bs por $)"],
            ] as const
          ).map(([k, text]) => (
            <label key={k} className="block">
              {text}
              <input
                type="number"
                step="any"
                className="input"
                value={c[k]}
                onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
          <label className="block">
            Fecha de la tasa BCV
            <input
              type="date"
              className="input"
              value={c.bcvDate}
              onChange={(e) => setC({ ...c, bcvDate: e.target.value })}
            />
          </label>
          <h3 className="font-bold">Tiempos límite (minutos)</h3>
          {Object.entries({
            accept: "Comercio acepta",
            products: "Cliente paga productos",
            merchantConfirm: "Comercio confirma pago",
            search: "Búsqueda de repartidor",
            delivery: "Cliente paga delivery",
            driverConfirm: "Repartidor confirma pago",
          }).map(([k, text]) => (
            <label className="block" key={k}>
              {text}
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
          <h3 className="font-bold">Cobertura de Lagunillas</h3>
          <button
            className="btn-ghost"
            onClick={() => {
              setDrawing(!drawing);
              if (!drawing) setC({ ...c, coverage: [] });
            }}
          >
            {drawing ? "Terminar contorno" : "Dibujar nuevo contorno"}
          </button>
          {drawing && (
            <p className="text-sm">
              Toca los vértices del contorno en orden; el último se une al
              primero. Guarda al terminar.
            </p>
          )}
          <DeliveryMap
            point={null}
            coverage={c.coverage}
            onChange={
              drawing
                ? (p) => setC({ ...c, coverage: [...c.coverage, p] })
                : undefined
            }
          />
          {drawing && (
            <button
              className="btn-ghost"
              onClick={() => setC({ ...c, coverage: c.coverage.slice(0, -1) })}
            >
              Deshacer último punto
            </button>
          )}
          <h3 className="font-bold">Sectores y referencias locales</h3>
          {c.sectors.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span>{s.name}</span>
              <button
                onClick={() =>
                  setC({ ...c, sectors: c.sectors.filter((_, j) => j !== i) })
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <label className="block">
            Nombre del sector
            <input
              className="input"
              value={sectorName}
              onChange={(e) => setSectorName(e.target.value)}
            />
          </label>
          <PointPicker
            point={point}
            onChange={setPoint}
            coverage={c.coverage}
            sectors={c.sectors}
          />
          <button
            className="btn-ghost"
            disabled={!point || sectorName.trim().length < 2}
            onClick={() => {
              setC({
                ...c,
                sectors: [
                  ...c.sectors,
                  { name: sectorName.trim(), point: point! },
                ],
              });
              setSectorName("");
            }}
          >
            Agregar referencia
          </button>
          <button
            className="btn-primary w-full"
            disabled={busy || drawing}
            onClick={() => save({ action: "config", config: c })}
          >
            Guardar tarifas y cobertura
          </button>
          <h3 className="font-bold">Recargas pendientes</h3>
          {data.suspended?.length > 0 && <div className="space-y-2"><h3 className="font-bold">Cuentas suspendidas</h3>{data.suspended.map((p:any)=><div key={p.user_id}><span>{p.full_name || 'Cuenta'} · {p.role}</span><button className="btn-ghost" disabled={busy} onClick={()=>save({action:'suspend',user_id:p.user_id,suspended:false})}>Reactivar acceso a pedidos</button></div>)}</div>}
          {data.topups.length === 0 && <p>No hay recargas pendientes.</p>}
          {data.topups.map((t: any) => (
            <div className="rounded-xl bg-cal-100 p-3" key={t.id}>
              <b>
                {t.driver?.full_name} · ${Number(t.amount).toFixed(2)}
              </b>
              <p>Referencia {t.reference}</p>
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Ver comprobante
              </a>
              <button
                className="btn-primary mt-2"
                disabled={busy}
                onClick={() => save({ action: "approve_topup", id: t.id })}
              >
                Ya lo vi en mi banco: aprobar
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
