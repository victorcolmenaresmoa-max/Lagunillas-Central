import type { Merchant } from './types';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatPrice(value: number) {
  return `$${Number(value).toFixed(2)}`;
}

/** "08:00:00" → "8:00 am" */
export function formatTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function minutesOf(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Hora actual en Venezuela, sin importar dónde corra el servidor */
function nowInVenezuela() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function isOpenNow(m: Pick<Merchant, 'opens_at' | 'closes_at' | 'is_active'>) {
  if (!m.is_active) return false;
  if (!m.opens_at || !m.closes_at) return true;
  const now = nowInVenezuela();
  const open = minutesOf(m.opens_at);
  const close = minutesOf(m.closes_at);
  // Soporta horarios que cruzan la medianoche (ej. 18:00 → 02:00)
  return open <= close ? now >= open && now < close : now >= open || now < close;
}

/** Deja solo dígitos; si empieza por 0 (0414...) lo convierte a 58414... */
export function normalizeWhatsapp(num: string) {
  let digits = num.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '58' + digits.slice(1);
  return digits;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
