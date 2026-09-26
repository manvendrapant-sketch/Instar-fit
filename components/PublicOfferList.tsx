'use client';

import type { OfferSummary } from '@/lib/commerce/types';
import { useAppState } from '@/lib/store';
import { OfferCard } from '@/components/OfferCard';

/** The public page's offer cards. Checkout is Sprint 3, so for now the buttons say so. */
export function PublicOfferList({ offers }: { offers: OfferSummary[] }) {
  const { toast } = useAppState();
  const onSelect = () => toast('Checkout is coming soon. You’ll pay by card, Apple Pay or Google Pay.');
  return (
    <>
      {offers.map((o) => (
        <OfferCard key={o.id} offer={o} onSelect={onSelect} />
      ))}
    </>
  );
}
