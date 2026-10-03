/** Official TomTom Orbis v2 raster API; browser keys must have domain restrictions. */
export function tomtomTileUrl(key: string): string {
  if (!key.trim()) throw new Error('El mapa aún no está habilitado. Puedes usar el GPS para guardar tu ubicación.');
  const params = new URLSearchParams({ apiVersion: '2', key: key.trim(), style: 'street-light', tileSize: '256' });
  return `https://api.tomtom.com/maps/orbis/display/raster/tile/{z}/{x}/{y}?${params}`;
}

export const TOMTOM_ATTRIBUTION = '<a href="https://www.tomtom.com/" target="_blank" rel="noopener noreferrer">© TomTom</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · <a href="https://www.tomtom.com/legal/en_gb/product-attributions/" target="_blank" rel="noopener noreferrer">Fuentes</a>';
