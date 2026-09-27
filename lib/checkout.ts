import { apiFetch } from './api-client';
import type { CheckoutQuoteResponse, CreateCheckoutSessionResponse, MoneyBreakdown } from './commerce/types';

export type CheckoutQuoteResult = { ok: true; breakdown: MoneyBreakdown } | { ok: false; message: string };

/**
 * Calls GET /api/checkout/quote — the fee disclosure the client sees before paying. Never derived
 * client-side (the standing "never compute prices or fees in the browser" rule): the offer's own
 * price is already known from the storefront's own data, but the service fee always comes from
 * this endpoint's `computeCheckoutBreakdown` call, the one source of truth for that number.
 */
export async function fetchCheckoutQuote(offerId: string): Promise<CheckoutQuoteResult> {
  const result = await apiFetch<CheckoutQuoteResponse>(`/api/checkout/quote?offerId=${encodeURIComponent(offerId)}`);
  if (result.success) return { ok: true, breakdown: result.data.breakdown };
  return { ok: false, message: result.message };
}

export type CheckoutSessionResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; message: string; emailError?: string };

/**
 * Calls POST /api/checkout. Only ever creates a Stripe Checkout Session — the client/subscription/
 * payment rows land from the resulting webhooks, not from this call, so a visitor who never
 * completes payment leaves nothing behind.
 */
export async function createCheckoutSessionApi(offerId: string, clientEmail: string): Promise<CheckoutSessionResult> {
  const result = await apiFetch<CreateCheckoutSessionResponse>('/api/checkout', {
    method: 'POST',
    body: { offerId, clientEmail },
  });
  if (result.success) return { ok: true, checkoutUrl: result.data.checkoutUrl };
  return { ok: false, message: result.message, emailError: result.fields?.clientEmail };
}
