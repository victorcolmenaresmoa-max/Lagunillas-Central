/** Convierte los errores técnicos en mensajes claros para las personas */
export function friendlyError(err: unknown): string {
  const raw = typeof err === 'string' ? err : (err as any)?.message ?? '';
  // Nuestros errores de la base vienen como "CODIGO: mensaje legible"
  const m = raw.match(/^(PLAN_[A-Z]+|OFERTA_INVALIDA|NO_AUTORIZADO|YA_TOMADO|LIMITE|ESTADO_INVALIDO):\s*(.+)$/);
  if (m) return m[2];
  if (/Invalid login credentials/i.test(raw)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(raw)) return 'Primero confirma tu correo: te enviamos un enlace.';
  if (/User already registered/i.test(raw)) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (/Password should be at least/i.test(raw)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit|too many/i.test(raw)) return 'Demasiados intentos. Espera unos minutos y prueba otra vez.';
  if (/exceeded the maximum allowed size/i.test(raw)) return 'La foto es muy pesada (máximo 5 MB).';
  if (/mime type/i.test(raw)) return 'Formato de foto no permitido. Usa JPG, PNG o WEBP.';
  if (/Failed to fetch|NetworkError|network/i.test(raw)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  if (/JWT|session/i.test(raw)) return 'Tu sesión expiró. Vuelve a entrar.';
  return raw || 'Ocurrió un error. Intenta de nuevo.';
}
