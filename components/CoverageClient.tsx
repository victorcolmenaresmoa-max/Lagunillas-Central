"use client";
import { useState } from "react";
import Link from "next/link";
import DeliveryMap from "./DeliveryMap";
import { CENTER, covered, type DeliveryConfig, type Point } from "@/lib/geo";
export default function CoverageClient({
  config: c,
}: {
  config: DeliveryConfig;
}) {
  const [point, setPoint] = useState<Point | null>(null);
  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-12">
      <Link href="/" className="btn-ghost">
        ← Comercios
      </Link>
      <h1 className="heading text-3xl">Delivery en Lagunillas</h1>
      <p>
        El contorno verde muestra la cobertura operativa. Toca un lugar para
        comprobar si está dentro.
      </p>
      <DeliveryMap point={point} onChange={setPoint} coverage={c.coverage} />
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
            ? "Dentro de la cobertura de Lagunillas."
            : "Fuera de cobertura o dentro de la laguna. No se admite delivery a este punto."}
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
        La cobertura es un perímetro operativo editable, no un mapa oficial de
        barrios. Las referencias locales se completan desde Administración.
      </p>
      <a
        href="https://www.openstreetmap.org/node/722277188"
        target="_blank"
        rel="noreferrer"
        className="underline text-sm"
      >
        Lagunillas en OpenStreetMap
      </a>
    </main>
  );
}
