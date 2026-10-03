"use client";
import { useState } from "react";
import Link from "next/link";
import DeliveryMap, { PointPicker } from "./DeliveryMap";
import { CENTER, covered, type DeliveryConfig, type Point } from "@/lib/geo";
export default function CoverageClient({
  config: c,
}: {
  config: DeliveryConfig;
}) {
  const [point, setPoint] = useState<Point | null>(null);
  const [showZone, setShowZone] = useState(false);
  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-12">
      <Link href="/" className="btn-ghost">
        ← Comercios
      </Link>
      <h1 className="heading text-3xl">Delivery en Lagunillas</h1>
      <p>
        Usa tu ubicación o toca tu dirección en TomTom para comprobar
        si está dentro de la zona de delivery configurada.
      </p>
      <PointPicker point={point} onChange={setPoint} coverage={c.coverage} />
      <details className="text-sm" onToggle={e => setShowZone(e.currentTarget.open)}><summary className="cursor-pointer font-bold">Ver zona de delivery configurada</summary>{showZone && <DeliveryMap point={point} coverage={c.coverage} showCoverage />}</details>
      {point && (
        <p
          role="status"
          className={
            covered(point, c.coverage)
              ? "rounded-xl bg-laguna-100 p-3"
              : "rounded-xl bg-teja-100 p-3"
          }
        >
          {covered(point, c.coverage)
            ? "Dentro de la zona de delivery configurada."
            : "Este punto no está habilitado para delivery. Si está en Lagunillas, consulta con la administración para revisar la zona."}
        </p>
      )}
      <div className="card space-y-2 p-4">
        <p>
          Base: ${c.base.toFixed(2)} hasta {c.includedKm} km.
        </p>
        <p>
          Adicional: ${c.perKm.toFixed(2)} por km, redondeado hacia arriba a $
          {c.step.toFixed(2)}. Tope: ${c.cap.toFixed(2)}.
        </p>
        <p>
          El precio se calcula del comercio a tu casa. No se cobra el tramo del
          repartidor al comercio.
        </p>
        <p className="text-sm">
          Usamos carretera cuando el servicio de rutas responde. Si falla,
          mostramos la estimación con factor {c.factor} antes de confirmar.
        </p>
      </div>
      <p className="text-xs text-tinta-500">
        TomTom muestra calles y lugares. La zona de delivery es un límite
        separado, configurado por la administración, que requiere validación local.
      </p>
      <a
        href="https://www.tomtom.com/maps/"
        target="_blank"
        rel="noreferrer"
        className="underline text-sm"
      >
        TomTom: proveedor del mapa
      </a>
    </main>
  );
}
