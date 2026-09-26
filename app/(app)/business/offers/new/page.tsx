import { OfferEditor } from '@/components/OfferEditor';
import { isOfferType } from '@/lib/offers';

export const metadata = { title: 'New offer · Instar' };

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { type } = await searchParams;
  return <OfferEditor mode="new" initialType={isOfferType(type) ? type : 'subscription'} />;
}
