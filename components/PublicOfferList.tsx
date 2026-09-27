'use client';

import { useState } from 'react';
import type { OfferSummary } from '@/lib/commerce/types';
import { OfferCard } from '@/components/OfferCard';
import { CheckoutDialog } from '@/components/CheckoutDialog';

/** The public page's offer cards. Selecting one opens the email-collection dialog that starts real checkout. */
export function PublicOfferList({ offers }: { offers: OfferSummary[] }) {
  const [selected, setSelected] = useState<OfferSummary | null>(null);
  return (
    <>
      {offers.map((o) => (
        <OfferCard key={o.id} offer={o} onSelect={setSelected} />
      ))}
      {selected && <CheckoutDialog offer={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
