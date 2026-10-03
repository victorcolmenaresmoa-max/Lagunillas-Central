export function deviceLocation(): Promise<{ point: { lat: number; lng: number }; accuracy: number }> {
  if (!window.isSecureContext) return Promise.reject(new Error('Abre la app con HTTPS para activar tu ubicación.'));
  if (!navigator.geolocation) return Promise.reject(new Error('Este dispositivo no permite ubicación. Puedes fijar el pin en el mapa.'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(position => {
    const { latitude: lat, longitude: lng, accuracy } = position.coords;
    if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0) return reject(new Error('El dispositivo devolvió una ubicación inválida. Intenta de nuevo o fija el pin en el mapa.'));
    resolve({ point: { lat, lng }, accuracy });
  }, e => reject(new Error(e.code === 1 ? 'Permite el acceso a tu ubicación en los ajustes del navegador, o fija el pin manualmente.' : e.code === 3 ? 'El GPS tardó demasiado. Intenta de nuevo con buena señal o fija el pin en el mapa.' : 'No se pudo obtener tu ubicación. Revisa la señal GPS o fija el pin en el mapa.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
}
