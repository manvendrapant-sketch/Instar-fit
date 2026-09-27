'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { TextField } from '@/components/AuthFields';
import { createCheckoutSessionApi, fetchCheckoutQuote } from '@/lib/checkout';
import { formatMoney, formatOfferPrice } from '@/lib/offers';
import { offerCta } from '@/components/OfferCard';
import type { BillingInterval, MoneyBreakdown, OfferSummary } from '@/lib/commerce/types';
import { useAppState } from '@/lib/store';

const INTERVAL_SUFFIX: Record<BillingInterval, string> = { week: '/wk', month: '/mo', year: '/yr' };

/**
 * The one screen between a public storefront offer button and Stripe-hosted Checkout: shows the
 * fee breakdown before pay (Sprint 3's own disclosure requirement) and collects the client's
 * email (POST /api/checkout needs it; Stripe itself collects card details on its own page). On
 * success this navigates away from the app entirely to the Checkout URL, so there's no
 * client-router state to worry about resetting afterward.
 */
export function CheckoutDialog({ offer, onClose }: { offer: OfferSummary; onClose: () => void }) {
  const { toast } = useAppState();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [quote, setQuote] = useState<MoneyBreakdown | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCheckoutQuote(offer.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setQuote(result.breakdown);
      else setQuoteFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [offer.id]);

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

        {quote ? (
          <div className="ins-checkout-breakdown ins-num" aria-live="polite">
            <div className="ins-checkout-row">
              <span>{offer.name}</span>
              <span>{formatMoney(quote.baseAmountCents)}</span>
            </div>
            <div className="ins-checkout-row muted">
              <span>Service fee</span>
              <span>{formatMoney(quote.serviceFeeCents)}</span>
            </div>
            <div className="ins-checkout-row total">
              <span>Total{offer.type === 'subscription' && offer.price.interval ? INTERVAL_SUFFIX[offer.price.interval] : ''}</span>
              <span>{formatMoney(quote.totalAmountCents)}</span>
            </div>
          </div>
        ) : quoteFailed ? (
          <p className="ins-checkout-price ins-num">{formatOfferPrice(offer)} + a service fee, shown at checkout</p>
        ) : (
          <p className="ins-checkout-price">Calculating price…</p>
        )}

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
