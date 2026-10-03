import { googleMapsSearch, googleMapsDirections } from "@/lib/maps-address";
export default function AddressLinks({
  address,
  sector = "",
  navigate = false,
}: {
  address: string;
  sector?: string;
  navigate?: boolean;
}) {
  if (!address?.trim()) return null;
  return (
    <a
      className="underline text-laguna-700"
      href={
        navigate
          ? googleMapsDirections(address, sector)
          : googleMapsSearch(address, sector)
      }
      target="_blank"
      rel="noopener noreferrer"
    >
      {navigate
        ? "Cómo llegar con Google Maps"
        : "Ver dirección en Google Maps"}
    </a>
  );
}
