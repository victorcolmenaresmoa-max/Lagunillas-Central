import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MerchantClient from '@/components/MerchantClient';
import { getActiveFlashDeals, getMerchantBySlug, getSettings } from '@/lib/data';
import { PLANS, effectivePlan } from '@/lib/plans';

// Siempre datos frescos: comercios recién aprobados, ofertas y horarios al instante
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const res = await getMerchantBySlug(params.slug);
  if (!res) return { title: 'Comercio no encontrado' };
  return {
    title: res.merchant.name,
    description: res.merchant.description ?? `${res.merchant.category} en Lagunillas, Mérida`,
    openGraph: res.merchant.logo_url ? { images: [res.merchant.logo_url] } : undefined,
  };
}

export default async function MerchantPage({ params }: { params: { slug: string } }) {
  const res = await getMerchantBySlug(params.slug);
  if (!res) notFound();
  const [deals, settings] = await Promise.all([getActiveFlashDeals(res.merchant.id), getSettings()]);
  const plan = PLANS[effectivePlan(res.merchant)];
  // La portada solo se muestra si el plan vigente la incluye
  const merchant = plan.cover ? res.merchant : { ...res.merchant, cover_url: null };
  return <MerchantClient merchant={merchant} products={res.products} deals={deals} deliveryFee={Number(settings.delivery_fee)} />;
}
