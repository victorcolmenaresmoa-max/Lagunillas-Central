/** Convierte los errores técnicos en mensajes claros para las personas */
export function friendlyError(err: unknown): string {
  const raw = typeof err === 'string' ? err : (err as any)?.message ?? '';
  // Nuestros errores de la base vienen como "CODIGO: mensaje legible"
  const m = raw.match(/^(PLAN_[A-Z]+|OFERTA_INVALIDA|NO_AUTORIZADO|YA_TOMADO|LIMITE|ESTADO_INVALIDO):\s*(.+)$/);
  if (m) return m[2];
  if (/Invalid login credentials/i.test(raw)) return 'Correo o contraseña incorrectos.';
  if (/Email link is invalid or has expired/i.test(raw)) return 'Este enlace ya se usó o venció. Pide un código nuevo.';
  if (/Token has expired or is invalid|otp_expired|invalid.*otp/i.test(raw)) return 'El código no es correcto o ya venció. Revísalo o pide uno nuevo.';
  if (/only request this after (\d+) seconds/i.test(raw)) return `Espera ${raw.match(/after (\d+) seconds/i)![1]} segundos antes de pedir otro código.`;
  if (/email rate limit|over_email_send_rate_limit/i.test(raw)) return 'Se enviaron demasiados correos. Intenta de nuevo en unos minutos.';
  if (/should be different from the old password/i.test(raw)) return 'La contraseña nueva debe ser distinta a la anterior.';
  if (/invalid format|Unable to validate email/i.test(raw)) return 'Ese correo no es válido. Revísalo.';
  if (/Signups not allowed|signup.*disabled/i.test(raw)) return 'El registro está cerrado por ahora.';
  if (/Error sending (recovery|confirmation) email|sending.*email/i.test(raw)) return 'No pudimos enviar el correo. Avísale a la administración.';
  if (/Auth session missing/i.test(raw)) return 'Tu enlace o código ya venció. Pide uno nuevo.';
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
