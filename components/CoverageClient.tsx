import Link from "next/link";
import type { DeliveryConfig } from "@/lib/geo";
import AddressLinks from "./AddressLinks";
export default function CoverageClient({
  config: c,
}: {
  config: DeliveryConfig;
}) {
  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-12">
      <Link href="/">← Comercios</Link>
      <h1 className="heading text-3xl">Delivery en Lagunillas</h1>
      <p>
        Guarda tu dirección escrita, sector y referencia. El comercio y el
        repartidor deben revisarla antes de aceptar; escribir una dirección no
        confirma automáticamente cobertura.
      </p>
      <AddressLinks address="Lagunillas" />
      <p>
        Tarifa fija de delivery: ${Number(c.base).toFixed(2)}. Se muestra antes
        de confirmar el pedido.
      </p>
      <p>
        Los mapas y la navegación se abren en Google Maps. No se rastrea tu
        ubicación dentro de la app.
      </p>
    </main>
  );
}
