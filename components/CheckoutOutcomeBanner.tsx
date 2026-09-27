'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/icons';

export type CheckoutOutcome = 'success' | 'cancelled';

/**
 * Shown at the top of the public storefront when a client lands back from Stripe Checkout
 * (?checkout=success|cancelled, set via the successUrl/cancelUrl passed to createCheckoutSession).
 * Dismissing — or the client just navigating away and back — cleans the query param via
 * router.replace so a refresh doesn't keep re-showing it.
 */
export function CheckoutOutcomeBanner({ outcome, pathname }: { outcome: CheckoutOutcome; pathname: string }) {
  const router = useRouter();
  const dismiss = () => router.replace(pathname);
  const success = outcome === 'success';

  return (
    <div className={`ins-panel ins-checkout-outcome ${success ? 'ok' : ''}`} role="status">
      <span className="ins-checkout-outcome-icon" aria-hidden="true">
        <Icon name={success ? 'check' : 'close'} />
      </span>
      <div className="ins-checkout-outcome-body">
        <b>{success ? 'Payment received.' : 'Checkout cancelled.'}</b>
        <p>
          {success
            ? "Check your email for a receipt — your coach will be in touch to get you started."
            : "You weren't charged. Pick an offer below whenever you're ready."}
        </p>
      </div>
      <button type="button" className="ins-checkout-outcome-close" onClick={dismiss} aria-label="Dismiss">
        <Icon name="close" />
      </button>
    </div>
  );
}
