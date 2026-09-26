'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAppState } from '@/lib/store';
import { fetchOnboardingStatus, PAYOUTS_PATH, STATUS_COPY } from '@/lib/payouts';

/**
 * Where Stripe sends the coach back. Stripe's return doesn't itself say whether onboarding
 * finished, so this fetches GET /api/coach/onboarding-status directly (rather than the store's
 * cached `payouts`, which could still be a render behind) and refreshes the shared cache with it.
 */
export function PayoutsReturn() {
  const router = useRouter();
  const { refreshPayouts, toast, hydrated } = useAppState();
  const applied = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated || applied.current) return;
    applied.current = true;

    let cancelled = false;
    (async () => {
      const result = await fetchOnboardingStatus();
      await refreshPayouts();
      if (cancelled) return;
      timer.current = setTimeout(() => {
        if (result.ok) toast(`Back from Stripe · ${STATUS_COPY[result.status.status].chip}`);
        router.replace(PAYOUTS_PATH);
      }, 900);
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hydrated, refreshPayouts, toast, router]);

  return (
    <section className="ins-po-checking" role="status" aria-live="polite">
      <span className="ins-po-spinner" aria-hidden="true" />
      <h1>Checking with Stripe…</h1>
      <p>One moment while we see where your payouts stand.</p>
    </section>
  );
}
