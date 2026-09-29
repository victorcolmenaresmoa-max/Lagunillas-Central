import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MerchantClient from '@/components/MerchantClient';
import { getActiveFlashDeals, getMerchantBySlug } from '@/lib/data';

export const revalidate = 30;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const res = await getMerchantBySlug(params.slug);
  if (!res) return { title: 'Comercio no encontrado' };
  return {
    title: res.merchant.name,
    description: res.merchant.description ?? `${res.merchant.category} en Lagunillas, Mérida`,
  };
}

export default async function MerchantPage({ params }: { params: { slug: string } }) {
  const res = await getMerchantBySlug(params.slug);
  if (!res) notFound();
  const deals = await getActiveFlashDeals(res.merchant.id);
  return <MerchantClient merchant={res.merchant} products={res.products} deals={deals} />;
}
