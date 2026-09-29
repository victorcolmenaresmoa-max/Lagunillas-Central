import HomeClient from '@/components/HomeClient';
import { getActiveFlashDeals, getMerchants } from '@/lib/data';

// Se actualiza cada 30 segundos para mostrar nuevos comercios y ofertas
export const revalidate = 30;

export default async function HomePage() {
  const [merchants, deals] = await Promise.all([getMerchants(), getActiveFlashDeals()]);
  return <HomeClient merchants={merchants} deals={deals} />;
}
