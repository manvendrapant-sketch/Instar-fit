import { apiFetch } from './api-client';
import type { CreateCheckoutSessionResponse } from './commerce/types';

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
