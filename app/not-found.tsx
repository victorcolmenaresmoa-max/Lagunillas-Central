import Link from 'next/link';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] card">
        <MapPinOff size={34} className="text-tinta-400" />
      </div>
      <h1 className="mt-5 heading text-3xl">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-tinta-500">Puede que el comercio ya no esté disponible.</p>
      <Link href="/" className="btn-primary mt-6">Volver al inicio</Link>
    </main>
  );
}
