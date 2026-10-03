"use client";
import { useEffect, useRef, useState } from "react";
import { CENTER, DEFAULT_CONFIG, covered, isPoint, type Point } from "@/lib/geo";
import { tomtomTileUrl, TOMTOM_ATTRIBUTION } from "@/lib/tomtom-maps";
import { deviceLocation } from "@/lib/device-location";
import type * as Leaflet from "leaflet";

type MapMarker = { point: Point; label: string };
const NO_MARKERS: MapMarker[] = [];
export default function DeliveryMap({ point, onChange, coverage = DEFAULT_CONFIG.coverage, markers = NO_MARKERS, route, showCoverage = false, accuracy }: {
  point: Point | null;
  onChange?: (p: Point) => void;
  coverage?: Point[];
  markers?: MapMarker[];
  route?: { coordinates?: number[][] } | null;
  showCoverage?: boolean;
  accuracy?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const engine = useRef<typeof Leaflet | null>(null);
  const tileLayer = useRef<Leaflet.TileLayer | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const [ready, setReady] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const editable = Boolean(onChange);
  const enabled = Boolean(process.env.NEXT_PUBLIC_TOMTOM_API_KEY?.trim());

  useEffect(() => {
    if (!enabled) return;
    let gone = false;
    let timer: ReturnType<typeof setTimeout>;
    setError(''); setReady(false); setTilesReady(false);
    import('leaflet').then(L => {
      if (gone || !ref.current) return;
      engine.current = L;
      const m = L.map(ref.current, { scrollWheelZoom: false }).setView([CENTER.lat, CENTER.lng], 15);
      map.current = m;
      const tiles = L.tileLayer(tomtomTileUrl(process.env.NEXT_PUBLIC_TOMTOM_API_KEY!), {
        maxZoom: 22, attribution: TOMTOM_ATTRIBUTION, tileSize: 256,
        updateWhenIdle: true, keepBuffer: 1, detectRetina: false,
      });
      tileLayer.current = tiles;
      const failed = () => {
        if (gone) return;
        clearTimeout(timer);
        setError('No pudimos cargar el mapa de TomTom. Revisa la conexión; si persiste, revisa la clave y su acceso a Map Display API. Puedes seguir usando el GPS.');
      };
      tiles.on('tileerror', failed);
      tiles.on('tileload', () => {
        if (gone) return;
        clearTimeout(timer);
        setTilesReady(true);
      });
      timer = setTimeout(failed, 15000);
      tiles.addTo(m);
      m.on('click', (e: Leaflet.LeafletMouseEvent) => callback.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      setReady(true);
      setRevision(n => n + 1);
      const observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(ref.current);
      m.once('unload', () => observer.disconnect());
    }).catch(() => !gone && setError('No pudimos abrir el mapa. Recarga la página o usa el GPS.'));
    return () => { gone = true; clearTimeout(timer); tileLayer.current?.off(); tileLayer.current = null; map.current?.remove(); map.current = null; engine.current = null; };
  }, [enabled, attempt]);

  useEffect(() => {
    const m = map.current, L = engine.current;
    if (!ready || !m || !L) return;
    const group = L.layerGroup().addTo(m);
    const safeTooltip = (label: string) => { const el = document.createElement('span'); el.textContent = label; return el; };
    if (showCoverage && coverage.length >= 3) L.polygon(coverage.map(p => [p.lat, p.lng] as [number, number]), { color: '#128c7e', fillOpacity: 0.08, interactive: false }).addTo(group);
    if (point && isPoint(point)) {
      // CSS-only pin avoids broken default icon URLs in a bundled Next.js build.
      const icon = L.divIcon({ className: '', html: '<span style="display:block;width:24px;height:24px;background:#128c7e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px #0006"></span>', iconSize: [24,24], iconAnchor: [12,12] });
      const pin = L.marker([point.lat, point.lng], { icon, draggable: editable, title: 'Ubicación seleccionada', autoPan: editable }).addTo(group).bindTooltip(safeTooltip('Ubicación seleccionada'));
      pin.on('dragend', () => { const p = pin.getLatLng(); callback.current?.({ lat: p.lat, lng: p.lng }); });
      if (accuracy && Number.isFinite(accuracy) && accuracy > 0) L.circle([point.lat, point.lng], { radius: accuracy, color: '#2563eb', fillOpacity: 0.08, weight: 1, interactive: false }).addTo(group);
    }
    markers.filter(p => isPoint(p.point)).forEach(p => L.circleMarker([p.point.lat, p.point.lng], { radius: 8, color: '#2563eb', fillOpacity: 1 }).addTo(group).bindTooltip(safeTooltip(p.label)));
    if (route?.coordinates) L.polyline(route.coordinates.filter(p => isPoint({ lat: p[1], lng: p[0] })).map(p => [p[1], p[0]] as [number, number]), { color: '#2563eb', weight: 4, interactive: false }).addTo(group);
    return () => { group.clearLayers(); group.remove(); };
  }, [ready, revision, point, coverage, markers, route, showCoverage, accuracy, editable]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (point && isPoint(point)) m.setView([point.lat, point.lng], editable ? 18 : m.getZoom(), { animate: false });
    else {
      const locations = markers.map(p => p.point).filter(isPoint);
      if (showCoverage) locations.push(...coverage.filter(isPoint));
      if (locations.length) m.fitBounds(locations.map(p => [p.lat, p.lng] as [number, number]), { padding: [24,24], maxZoom: 18 });
    }
  }, [ready, revision, point, showCoverage, coverage, markers, editable]);

  return <div className="space-y-2">
    {!enabled ? <p role="status" className="rounded-2xl bg-cal-100 p-4 text-sm">El mapa aún no está habilitado. Puedes usar el GPS para guardar tu ubicación.</p> : <>
      <div ref={ref} className="relative z-0 h-80 rounded-2xl" aria-label="Mapa TomTom: ubicación de entrega" />
      {error ? <div role="alert" className="rounded-xl bg-cal-100 p-3 text-sm"><p>{error}</p><button type="button" className="btn-ghost mt-2" onClick={() => setAttempt(n => n + 1)}>Volver a intentar</button></div> : !tilesReady && <p role="status" className="text-sm">Cargando el mapa de TomTom…</p>}
      {tilesReady && editable && <p className="text-xs text-tinta-500">Toca tu casa o arrastra el pin hasta la entrada. El círculo azul muestra la precisión aproximada del GPS.</p>}
    </>}
  </div>;
}

export function PointPicker({ point, onChange, coverage }: {
  point: Point | null;
  onChange: (p: Point) => void;
  coverage: Point[];
  sectors?: typeof DEFAULT_CONFIG.sectors;
}) {
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const mounted = useRef(true);
  const request = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; }; }, []);
  const move = (p: Point) => { request.current++; setLocating(false); setAccuracy(null); setError(''); onChange(p); };
  const locate = () => {
    setError('');
    const current = ++request.current;
    setLocating(true);
    deviceLocation().then(position => {
      if (!mounted.current || request.current !== current) return;
      setLocating(false);
      setAccuracy(position.accuracy);
      onChange(position.point);
    }).catch(e => {
      if (!mounted.current || request.current !== current) return;
      setLocating(false);
      setError(e.message);
    });
  };
  return <div className="space-y-3">
    <p className="text-sm">Activa tu ubicación para marcar dónde estás. Úsala cuando estés en el lugar de entrega; también puedes elegir otra dirección en el mapa.</p>
    <button type="button" className="btn-primary w-full" onClick={locate} disabled={locating}>{locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}</button>
    {accuracy !== null && <p role="status" className="text-sm">Precisión aproximada del dispositivo: {Math.ceil(accuracy)} metros. {accuracy > 50 ? 'La señal es poco precisa; ajusta el pin a la entrada de tu casa.' : 'Confirma que el pin coincide con la entrada.'}</p>}
    {error && <p role="alert" className="text-sm text-teja-600">{error}</p>}
    <DeliveryMap point={point} onChange={move} coverage={coverage} accuracy={accuracy} />
    {point && <p className="text-xs text-tinta-500">Punto seleccionado: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>}
    {point && !covered(point, coverage) && <p role="alert" className="text-sm text-teja-600">Este punto no está dentro de la zona de delivery configurada. Si tu dirección está en Lagunillas, consulta con la administración para revisar la cobertura.</p>}
  </div>;
}
