"use client";
import { useEffect, useRef, useState } from "react";
import { CENTER, DEFAULT_CONFIG, covered, LAGOON, type Point } from "@/lib/geo";
import type * as Leaflet from "leaflet";
export default function DeliveryMap({
  point,
  onChange,
  coverage = DEFAULT_CONFIG.coverage,
  markers = [],
  route,
}: {
  point: Point | null;
  onChange?: (p: Point) => void;
  coverage?: Point[];
  markers?: { point: Point; label: string }[];
  route?: any;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<Leaflet.LayerGroup | null>(null);
  const [error, setError] = useState("");
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    let gone = false;
    import("leaflet")
      .then((L) => {
        if (gone || !ref.current) return;
        const m = L.map(ref.current).setView([CENTER.lat, CENTER.lng], 14);
        map.current = m;
        if (coverage.length >= 3)
          m.fitBounds(
            coverage.map((p) => [p.lat, p.lng] as [number, number]),
            { padding: [12, 12] },
          );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(m);
        layers.current = L.layerGroup().addTo(m);
        m.on("click", (e: Leaflet.LeafletMouseEvent) =>
          callback.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
        );
        m.invalidateSize();
      })
      .catch(() =>
        setError("No pudimos cargar el mapa. Usa el sector o las coordenadas."),
      );
    return () => {
      gone = true;
      map.current?.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      // Initialization and updates share the same import promise.
      const m = map.current,
        g = layers.current;
      if (!m || !g) return;
      g.clearLayers();
      L.polygon(
        LAGOON.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#2563eb", fillOpacity: 0.25 },
      )
        .addTo(g)
        .bindTooltip("Laguna de Urao: sin entregas en el agua");
      L.polygon(
        coverage.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#128c7e", fillOpacity: 0.06 },
      ).addTo(g);
      if (point) {
        L.circleMarker([point.lat, point.lng], {
          radius: 9,
          color: covered(point, coverage) ? "#128c7e" : "#b91c1c",
          fillOpacity: 1,
        })
          .addTo(g)
          .bindTooltip("Punto seleccionado");
        m.panTo([point.lat, point.lng]);
      }
      markers.forEach((p) =>
        L.circleMarker([p.point.lat, p.point.lng], {
          radius: 7,
          color: "#2563eb",
          fillOpacity: 1,
        })
          .addTo(g)
          .bindTooltip(p.label),
      );
      if (route?.coordinates)
        L.polyline(
          route.coordinates.map((p: number[]) => [p[1], p[0]]),
          { color: "#2563eb" },
        ).addTo(g);
    });
    return () => {
      cancelled = true;
    };
  }, [point, coverage, markers, route]);
  return (
    <div>
      <div
        ref={ref}
        className="relative z-0 h-72 rounded-2xl"
        aria-label="Mapa de cobertura de Lagunillas"
      />
      {error && <p role="alert">{error}</p>}
      {onChange && (
        <p className="mt-1 text-xs text-tinta-500">
          Toca el mapa para fijar la casa o el local. El contorno verde muestra
          la cobertura operativa.
        </p>
      )}
    </div>
  );
}
export function PointPicker({
  point,
  onChange,
  coverage,
  sectors = DEFAULT_CONFIG.sectors,
}: {
  point: Point | null;
  onChange: (p: Point) => void;
  coverage: Point[];
  sectors?: typeof DEFAULT_CONFIG.sectors;
}) {
  const [error, setError] = useState("");
  const locate = () => {
    setError("");
    if (!navigator.geolocation)
      return setError(
        "Este dispositivo no permite ubicación. Fija el punto manualmente.",
      );
    navigator.geolocation.getCurrentPosition(
      (p) => onChange({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () =>
        setError(
          "No se obtuvo permiso o señal GPS. Elige un sector y mueve el punto.",
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Usamos tu ubicación una vez para fijar este punto y calcular el
        delivery. Puedes moverlo manualmente.
      </p>
      <button type="button" className="btn-ghost" onClick={locate}>
        Usar mi ubicación
      </button>
      <label className="block text-sm">
        Referencia o sector
        <select
          className="input"
          defaultValue=""
          onChange={(e) => {
            const s = sectors.find((s) => s.name === e.target.value);
            if (s) onChange(s.point);
          }}
        >
          <option value="">Elige una referencia</option>
          {sectors.map((s) => (
            <option key={s.name}>{s.name}</option>
          ))}
        </select>
      </label>
      <DeliveryMap point={point} onChange={onChange} coverage={coverage} />
      <div className="grid grid-cols-2 gap-2">
        <label>
          Latitud
          <input
            className="input"
            type="number"
            step="any"
            value={point?.lat ?? ""}
            onChange={(e) =>
              onChange({
                lat: Number(e.target.value),
                lng: point?.lng ?? CENTER.lng,
              })
            }
          />
        </label>
        <label>
          Longitud
          <input
            className="input"
            type="number"
            step="any"
            value={point?.lng ?? ""}
            onChange={(e) =>
              onChange({
                lat: point?.lat ?? CENTER.lat,
                lng: Number(e.target.value),
              })
            }
          />
        </label>
      </div>
      {point && !covered(point, coverage) && (
        <p role="alert" className="text-sm text-teja-600">
          Fuera de cobertura. El servicio solo opera dentro de Lagunillas.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
