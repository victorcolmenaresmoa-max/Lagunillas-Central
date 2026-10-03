import Link from 'next/link';
import { Bike, Store } from 'lucide-react';
import { AuthShell } from '@/components/auth';
export default function AliadosPage() {
  return <AuthShell showTabs={false} title="Trabaja con nosotros" subtitle="Un apartado para vender en Lagunillas o trabajar haciendo entregas.">
    <div className="space-y-4">
      <Link href="/aliados/registro?tipo=comercio" className="card flex items-center gap-3 p-5"><Store className="text-teja-600"/><span><b className="block">Registrar mi comercio</b><span className="text-sm text-tinta-500">Publica tu catálogo y recibe pedidos.</span></span></Link>
      <Link href="/aliados/registro?tipo=repartidor" className="card flex items-center gap-3 p-5"><Bike className="text-laguna-600"/><span><b className="block">Quiero ser repartidor</b><span className="text-sm text-tinta-500">Solicita tu registro para hacer entregas.</span></span></Link>
      <Link href="/entrar?acceso=negocio" className="btn-primary w-full">Entrar a mi panel</Link>
      <Link href="/" className="btn-ghost w-full">Volver a comprar</Link>
    </div>
  </AuthShell>;
}
