'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAppState } from '@/lib/store';
import { isMockResult, mockStatusAfter, PAYOUTS_PATH, STATUS_COPY } from '@/lib/payouts';

/**
 * Where Stripe sends the coach back. The real version fetches GET /api/coach/onboarding-status
 * (Stripe's return doesn't say whether onboarding finished) and then shows Payouts. The mock
 * reads the outcome picked on the stand-in screen instead.
 */
export function PayoutsReturn({ mock }: { mock: string | undefined }) {
  const router = useRouter();
  const { setPayouts, toast, hydrated } = useAppState();
  const applied = useRef(false);

  useEffect(() => {
    if (!hydrated || applied.current) return;
    applied.current = true;
    const t = setTimeout(() => {
      if (isMockResult(mock)) {
        const next = mockStatusAfter(mock);
        setPayouts(next);
        toast(`Back from Stripe · ${STATUS_COPY[next.status].chip}`);
      }
      router.replace(PAYOUTS_PATH);
    }, 900);
    return () => clearTimeout(t);
  }, [hydrated, mock, setPayouts, toast, router]);

  return (
    <section className="ins-po-checking" role="status" aria-live="polite">
      <span className="ins-po-spinner" aria-hidden="true" />
      <h1>Checking with Stripe…</h1>
      <p>One moment while we see where your payouts stand.</p>
    </section>
  );
}
