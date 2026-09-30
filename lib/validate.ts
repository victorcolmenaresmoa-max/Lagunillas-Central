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
