import lagoon from "./laguna-urao.json";
export const LAGOON = lagoon.polygon;
export interface Point {
  lat: number;
  lng: number;
}
export interface DeliveryConfig {
  base: number;
  includedKm: number;
  perKm: number;
  step: number;
  cap: number;
  factor: number;
  commission: number;
  bcv: number;
  bcvDate: string;
  coverage: Point[];
  sectors: { name: string; point: Point }[];
  minutes: {
    accept: number;
    products: number;
    merchantConfirm: number;
    search: number;
    delivery: number;
    driverConfirm: number;
  };
}
// OSM node 722277188. The polygon is an initial operational envelope, not a barrio boundary.
export const CENTER: Point = { lat: 8.4978615, lng: -71.3896149 };
export const DEFAULT_CONFIG: DeliveryConfig = {
  base: 1,
  includedKm: 1.5,
  perKm: 0.4,
  step: 0.25,
  cap: 4,
  factor: 1.4,
  commission: 10,
  bcv: 0,
  bcvDate: "",
  coverage: [
    { lat: 8.518, lng: -71.389 },
    { lat: 8.508, lng: -71.383 },
    { lat: 8.502, lng: -71.38 },
    { lat: 8.49, lng: -71.382 },
    { lat: 8.478, lng: -71.389 },
    { lat: 8.477, lng: -71.394 },
    { lat: 8.492, lng: -71.399 },
    { lat: 8.493, lng: -71.41 },
    { lat: 8.502, lng: -71.414 },
    { lat: 8.511, lng: -71.411 },
    { lat: 8.51, lng: -71.405 },
    { lat: 8.507, lng: -71.393 },
  ],
  sectors: [
    { name: "Centro de Lagunillas", point: CENTER },
    { name: "El Molino", point: { lat: 8.5074744, lng: -71.4080858 } },
  ],
  minutes: {
    accept: 10,
    products: 20,
    merchantConfirm: 15,
    search: 15,
    delivery: 10,
    driverConfirm: 10,
  },
};
export function isPoint(p: unknown): p is Point {
  const v = p as Point;
  return (
    !!v &&
    typeof v.lat === "number" &&
    typeof v.lng === "number" &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    Math.abs(v.lat) <= 90 &&
    Math.abs(v.lng) <= 180
  );
}
export function inside(p: Point, polygon: Point[]) {
  if (!isPoint(p) || polygon.length < 3) return false;
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    const cross =
      (p.lng - a.lng) * (b.lat - a.lat) - (p.lat - a.lat) * (b.lng - a.lng);
    if (
      Math.abs(cross) < 1e-10 &&
      p.lng >= Math.min(a.lng, b.lng) &&
      p.lng <= Math.max(a.lng, b.lng) &&
      p.lat >= Math.min(a.lat, b.lat) &&
      p.lat <= Math.max(a.lat, b.lat)
    )
      return true;
    if (
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng
    )
      hit = !hit;
  }
  return hit;
}
export function covered(p: Point, polygon: Point[]) {
  return inside(p, polygon) && !inside(p, LAGOON);
}
export function kmBetween(a: Point, b: Point) {
  const r = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function deliveryPrice(km: number, c: DeliveryConfig) {
  if (!Number.isFinite(km) || km < 0) throw new Error("Distancia inválida.");
  return (
    Math.round(
      Math.min(
        c.cap,
        Math.ceil(
          (c.base + c.perKm * Math.max(0, km - c.includedKm) - 1e-9) / c.step,
        ) * c.step,
      ) * 100,
    ) / 100
  );
}
export function validConfig(c: DeliveryConfig) {
  return (
    !!c &&
    [
      "base",
      "includedKm",
      "perKm",
      "step",
      "cap",
      "factor",
      "commission",
      "bcv",
    ].every(
      (k) =>
        typeof (c as any)[k] === "number" && Number.isFinite((c as any)[k]),
    ) &&
    c.base >= 0 &&
    c.includedKm >= 0 &&
    c.perKm >= 0 &&
    c.step > 0 &&
    c.cap >= c.base &&
    c.factor >= 1 &&
    c.factor <= 5 &&
    c.commission >= 0 &&
    c.commission <= 100 &&
    c.bcv > 0 &&
    validDate(c.bcvDate) &&
    Array.isArray(c.coverage) &&
    c.coverage.length >= 3 &&
    c.coverage.length <= 100 &&
    c.coverage.every((p) => isPoint(p) && kmBetween(CENTER, p) < 10) &&
    simplePolygon(c.coverage) &&
    covered(CENTER, c.coverage) &&
    Array.isArray(c.sectors) &&
    c.sectors.length <= 100 &&
    c.sectors.every(
      (s) =>
        s.name?.length > 1 && isPoint(s.point) && covered(s.point, c.coverage),
    ) &&
    [
      "accept",
      "products",
      "merchantConfirm",
      "search",
      "delivery",
      "driverConfirm",
    ].every(
      (k) =>
        Number.isInteger((c.minutes as any)?.[k]) &&
        (c.minutes as any)[k] >= 1 &&
        (c.minutes as any)[k] <= 120,
    )
  );
}
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s
  );
}
export function simplePolygon(p: Point[]) {
  const orient = (a: Point, b: Point, c: Point) =>
    (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    if (kmBetween(a, b) < 0.005) return false;
    area += a.lng * b.lat - b.lng * a.lat;
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      const c = p[j],
        d = p[(j + 1) % p.length];
      if (
        orient(a, b, c) * orient(a, b, d) <= 0 &&
        orient(c, d, a) * orient(c, d, b) <= 0 &&
        Math.max(Math.min(a.lng, b.lng), Math.min(c.lng, d.lng)) <=
          Math.min(Math.max(a.lng, b.lng), Math.max(c.lng, d.lng)) &&
        Math.max(Math.min(a.lat, b.lat), Math.min(c.lat, d.lat)) <=
          Math.min(Math.max(a.lat, b.lat), Math.max(c.lat, d.lat))
      )
        return false;
    }
  }
  return Math.abs(area) > 1e-7;
}
