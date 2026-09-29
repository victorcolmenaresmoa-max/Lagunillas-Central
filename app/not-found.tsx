import Link from 'next/link';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-slate-800 bg-ink-900">
        <MapPinOff size={34} className="text-slate-500" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-white">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-slate-400">Puede que el comercio ya no esté disponible.</p>
      <Link href="/" className="btn-primary mt-6">Volver al inicio</Link>
    </main>
  );
}
