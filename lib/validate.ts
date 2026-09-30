/** Validaciones compartidas entre el navegador y el servidor */

/** Normaliza un teléfono venezolano: 0414-123.45.67 → 584141234567 */
export function normalizePhone(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '58' + d.slice(1);
  if (d.length === 10 && d.startsWith('4')) d = '58' + d;
  return d;
}

export function isValidPhone(input: string) {
  const d = normalizePhone(input);
  return d.length >= 11 && d.length <= 15;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const clean = (s: unknown, max: number) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** 584141234567 → 0414-1234567 (para mostrar) */
export function displayPhone(p: string | null | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  const local = d.startsWith('58') && d.length === 12 ? '0' + d.slice(2) : d;
  return /^0\d{10}$/.test(local) ? `${local.slice(0, 4)}-${local.slice(4)}` : p;
}
