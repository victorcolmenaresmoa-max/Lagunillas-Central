/**
 * Datos legales de comercios y repartidores.
 * Se guardan en la tabla privada legal_profiles (ver schema.sql, sección 8):
 * solo los ven el dueño de la cuenta y la administración.
 */

/** Cambia esta fecha cada vez que modifiques /terminos o /privacidad: a todos se les pedirá aceptar de nuevo */
export const TERMS_VERSION = '2026-09-30';

/** Datos de contacto que aparecen en los términos y la privacidad (opcional en Vercel) */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';

export const MIN_AGE = 18;

export type IdType = 'V' | 'E' | 'P';
export const ID_TYPES: { id: IdType; label: string }[] = [
  { id: 'V', label: 'V' },
  { id: 'E', label: 'E' },
  { id: 'P', label: 'Pasaporte' },
];

export type DocKey = 'cedula' | 'selfie' | 'rif' | 'licencia_actividades' | 'licencia' | 'circulacion' | 'rcv';

export interface DocSpec {
  key: DocKey;
  title: string;
  hint: string;
  /** obligatorio para aprobar la cuenta */
  required: boolean | ((l: Partial<LegalProfile>, vehicle?: string | null) => boolean);
}

const motorizado = (_l: Partial<LegalProfile>, vehicle?: string | null) => vehicle === 'moto' || vehicle === 'carro';

export const DOCS: Record<'merchant' | 'delivery', DocSpec[]> = {
  merchant: [
    { key: 'cedula', title: 'Cédula del responsable', hint: 'Foto clara del frente, que se lean nombre y número.', required: true },
    { key: 'rif', title: 'RIF del comercio', hint: 'Foto o PDF del comprobante de RIF vigente.', required: true },
    { key: 'licencia_actividades', title: 'Licencia de actividades económicas', hint: 'Permiso de la alcaldía, si lo tienes.', required: false },
  ],
  delivery: [
    { key: 'cedula', title: 'Cédula de identidad', hint: 'Foto clara del frente, que se lean nombre y número.', required: true },
    { key: 'selfie', title: 'Foto tuya con la cédula', hint: 'Un selfie sosteniendo tu cédula junto a la cara.', required: true },
    { key: 'licencia', title: 'Licencia de conducir', hint: 'Vigente. Solo si repartes en moto o carro.', required: motorizado },
    { key: 'circulacion', title: 'Certificado de circulación', hint: 'El "carnet" del vehículo. Solo moto o carro.', required: motorizado },
    { key: 'rcv', title: 'Póliza de RCV vigente', hint: 'Seguro de Responsabilidad Civil Vehicular. Solo moto o carro.', required: motorizado },
  ],
};

export interface LegalProfile {
  user_id: string;
  kind: 'merchant' | 'delivery';
  legal_name: string | null;
  id_type: IdType | null;
  id_number: string | null;
  birth_date: string | null;
  home_address: string | null;
  business_legal_name: string | null;
  rif: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  has_license: boolean | null;
  has_rcv: boolean | null;
  docs: Partial<Record<DocKey, string>>;
  terms_version: string | null;
  terms_accepted_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------------- Validaciones ---------------- */

export const cleanId = (v: string) => v.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

export function idError(type: IdType, number: string): string | null {
  const n = cleanId(number);
  if (!n) return 'Escribe tu número de cédula.';
  if (type === 'P') return /^[A-Z0-9]{5,15}$/.test(n) ? null : 'Escribe el número de pasaporte completo.';
  return /^\d{6,9}$/.test(n) ? null : 'La cédula lleva solo números, por ejemplo 12345678.';
}

/** RIF: letra + 9 dígitos (J-12345678-9). Acepta con o sin guiones. */
export const cleanRif = (v: string) => cleanId(v);
export function rifError(v: string): string | null {
  const r = cleanRif(v);
  if (!r) return 'Escribe el RIF del comercio.';
  return /^[JVEGPC]\d{8,9}$/.test(r) ? null : 'Revisa el RIF. Debe verse así: J-12345678-9 o V-12345678-9.';
}
export function formatRif(v: string | null | undefined) {
  const r = cleanRif(v ?? '');
  if (!/^[JVEGPC]\d{8,9}$/.test(r)) return v ?? '';
  return r.length === 10 ? `${r[0]}-${r.slice(1, 9)}-${r[9]}` : `${r[0]}-${r.slice(1)}`;
}

export function ageFrom(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function birthError(date: string): string | null {
  const age = ageFrom(date);
  if (age === null) return 'Escribe tu fecha de nacimiento.';
  if (age < MIN_AGE) return `Debes ser mayor de ${MIN_AGE} años.`;
  if (age > 100) return 'Revisa la fecha de nacimiento.';
  return null;
}

/** Fecha máxima para el selector (hace 18 años) */
export function maxBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE);
  return d.toISOString().slice(0, 10);
}

export const formatId = (type: IdType | null, n: string | null) => (n ? `${type === 'P' ? 'Pasaporte' : type ?? 'V'}-${n}` : '—');

/* ---------------- Estado de la verificación ---------------- */

export function isRequired(spec: DocSpec, l: Partial<LegalProfile>, vehicle?: string | null) {
  return typeof spec.required === 'function' ? spec.required(l, vehicle) : spec.required;
}

/** Qué falta para que la cuenta quede completa (datos + documentos obligatorios) */
export function missingItems(kind: 'merchant' | 'delivery', l: Partial<LegalProfile> | null, vehicle?: string | null): string[] {
  const out: string[] = [];
  if (!l) return ['Tus datos legales'];
  if (!l.legal_name) out.push('Nombre completo');
  if (!l.id_number) out.push('Cédula');
  if (!l.birth_date) out.push('Fecha de nacimiento');
  if (kind === 'merchant') {
    if (!l.rif) out.push('RIF');
    if (!l.business_legal_name) out.push('Razón social');
  } else {
    if (!l.home_address) out.push('Dirección de residencia');
    if (!l.emergency_name || !l.emergency_phone) out.push('Contacto de emergencia');
  }
  for (const d of DOCS[kind]) if (isRequired(d, l, vehicle) && !l.docs?.[d.key]) out.push(d.title);
  if (l.terms_version !== TERMS_VERSION) out.push('Aceptar los términos vigentes');
  return out;
}
