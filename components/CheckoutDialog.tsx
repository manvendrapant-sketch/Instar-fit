'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { TextField } from '@/components/AuthFields';
import { createCheckoutSessionApi } from '@/lib/checkout';
import { formatOfferPrice } from '@/lib/offers';
import { offerCta } from '@/components/OfferCard';
import type { OfferSummary } from '@/lib/commerce/types';
import { useAppState } from '@/lib/store';

/**
 * The one screen between a public storefront offer button and Stripe-hosted Checkout: just
 * collects the client's email (POST /api/checkout needs it; Stripe itself collects card details
 * on its own page). On success this navigates away from the app entirely to the Checkout URL, so
 * there's no client-router state to worry about resetting afterward.
 */
export function CheckoutDialog({ offer, onClose }: { offer: OfferSummary; onClose: () => void }) {
  const { toast } = useAppState();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email to continue.');
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await createCheckoutSessionApi(offer.id, trimmed);
    if (result.ok) {
      window.location.href = result.checkoutUrl;
      return;
    }
    setPending(false);
    if (result.emailError) setError(result.emailError);
    else toast(result.message);
  }

  return (
    <div
      className="ins-checkout-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-dialog-title"
      onClick={() => !pending && onClose()}
    >
      <div className="ins-panel ins-checkout-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ins-checkout-close" onClick={onClose} disabled={pending} aria-label="Close">
          <Icon name="close" />
        </button>

        <span className="ins-label">{offerCta(offer.type)}</span>
        <h2 id="checkout-dialog-title">{offer.name}</h2>
        <p className="ins-checkout-price ins-num">{formatOfferPrice(offer)}</p>

        <form onSubmit={onSubmit} noValidate className="ins-auth-form">
          <TextField
            name="email"
            label="Email"
            icon="mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            hint="We'll send your receipt here."
            required
          />
          <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Starting checkout…' : 'Continue to payment'}
            <Icon name="arrow" />
          </button>
        </form>
      </div>
    </div>
  );
}
