import 'server-only';
import { getStripe } from '@/lib/stripe/client';
import { PLATFORM_TAKE_RATE_BPS, computeCheckoutBreakdown } from './money';
import type { BillingInterval, MoneyBreakdown, OfferType } from './types';

export interface CheckoutSessionInput {
  offerId: string;
  offerType: OfferType;
  coachId: string;
  /** The coach's Stripe Express account id — where funds land, per the destination-charge decision. */
  connectedAccountId: string;
  price: {
    stripePriceId: string;
    currency: string;
    unitAmountCents: number;
    interval: BillingInterval | null;
    intervalCount: number | null;
  };
  clientEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  breakdown: MoneyBreakdown;
}

/**
 * Creates the Stripe Checkout Session for one offer purchase. Charge shape follows the Week-1
 * decisions (see Decisions.md): destination charges with `on_behalf_of` the coach's connected
 * account (so the client's card statement shows the coach, not Instar), the disclosed "Service
 * fee" as its own line item — never folded into the base price or labeled a surcharge — and
 * Instar's cut taken as an application fee, a share of the base price rather than added on top.
 *
 * The full breakdown is snapshotted into the session's (and payment_intent_data's /
 * subscription_data's) metadata as strings, so the webhook handlers that write `payments` rows
 * later never have to recompute or trust a possibly-since-changed offer price.
 *
 * Known approximation for subscriptions: Stripe's Connect application fee on a Subscription can
 * only be a *percentage* of the invoice total (`application_fee_percent`), not a fixed cents
 * amount — so on a subscription it necessarily also takes that percentage of the Service fee line,
 * not just of the base price, unlike the one-time path (`application_fee_amount`), which is exact.
 * Revisit if this needs to be exact for subscriptions too (would mean billing the fee as a
 * separate invoice item outside Checkout rather than as a line item within it).
 */
export async function createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const breakdown = computeCheckoutBreakdown(input.price.unitAmountCents, input.price.currency);
  const isSubscription = input.offerType === 'subscription';

  const metadata: Record<string, string> = {
    coachId: input.coachId,
    offerId: input.offerId,
    clientEmail: input.clientEmail,
    baseAmountCents: String(breakdown.baseAmountCents),
    serviceFeeCents: String(breakdown.serviceFeeCents),
    platformFeeCents: String(breakdown.platformFeeCents),
    totalAmountCents: String(breakdown.totalAmountCents),
    currency: breakdown.currency,
  };

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: isSubscription ? 'subscription' : 'payment',
    customer_email: input.clientEmail,
    // Payment mode only creates a Customer when told to; subscription mode always does.
    ...(isSubscription ? {} : { customer_creation: 'always' as const }),
    line_items: [
      { price: input.price.stripePriceId, quantity: 1 },
      {
        price_data: {
          currency: breakdown.currency,
          unit_amount: breakdown.serviceFeeCents,
          product_data: { name: 'Service fee' },
          ...(isSubscription
            ? { recurring: { interval: input.price.interval ?? 'month', interval_count: input.price.intervalCount ?? 1 } }
            : {}),
        },
        quantity: 1,
      },
    ],
    metadata,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(isSubscription
      ? {
          subscription_data: {
            application_fee_percent: PLATFORM_TAKE_RATE_BPS / 100,
            on_behalf_of: input.connectedAccountId,
            transfer_data: { destination: input.connectedAccountId },
            metadata,
          },
        }
      : {
          payment_intent_data: {
            application_fee_amount: breakdown.platformFeeCents,
            on_behalf_of: input.connectedAccountId,
            transfer_data: { destination: input.connectedAccountId },
            metadata,
          },
        }),
  });

  if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
  return { checkoutUrl: session.url, breakdown };
}
