/** External Google Maps only: no geocoding, tracking or paid API calls. */
export function localAddress(address: string, sector = "") {
  return [
    address.trim(),
    sector.trim(),
    "Lagunillas, municipio Sucre, Mérida, Venezuela",
  ]
    .filter(Boolean)
    .join(", ");
}
export function googleMapsSearch(address: string, sector = "") {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: localAddress(address, sector) })}`;
}
export function googleMapsDirections(address: string, sector = "") {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: localAddress(address, sector), dir_action: "navigate" })}`;
}
