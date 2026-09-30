import HomeClient from '@/components/HomeClient';
import { getActiveFlashDeals, getMerchants } from '@/lib/data';

// Siempre datos frescos: comercios recién aprobados, ofertas y horarios al instante
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [merchants, deals] = await Promise.all([getMerchants(), getActiveFlashDeals()]);
  return <HomeClient merchants={merchants} deals={deals} />;
}
