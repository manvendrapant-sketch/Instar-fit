import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, prices } from '@/lib/commerce/schema';
import { createCheckoutSession } from '@/lib/commerce/checkout';
import type { CreateCheckoutSessionRequest, CreateCheckoutSessionResponse } from '@/lib/commerce/types';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * No auth — this is a client buying an offer, not a coach. Only ever creates a Stripe Checkout
 * Session; the client/subscription/payment rows land from the resulting webhooks
 * (checkout.session.completed, payment_intent.succeeded, invoice.paid — see
 * lib/commerce/webhookHandlers.ts), never from this route directly, so a client who closes the
 * tab before paying never leaves a stray DB row behind.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }
  const b = (body ?? {}) as Partial<CreateCheckoutSessionRequest>;

  const offerId = typeof b.offerId === 'string' ? b.offerId : '';
  const clientEmail = typeof b.clientEmail === 'string' ? b.clientEmail.trim().toLowerCase() : '';
  const fields: Record<string, string> = {};
  if (!offerId) fields.offerId = 'offerId is required.';
  if (!clientEmail || !EMAIL_RE.test(clientEmail)) fields.clientEmail = 'Enter a valid email address.';
  if (Object.keys(fields).length > 0) {
    return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, fields);
  }

  try {
    const db = getDb();
    const rows = await db
      .select({ offer: offers, price: prices })
      .from(offers)
      .innerJoin(prices, and(eq(prices.offerId, offers.id), eq(prices.active, true)))
      .where(and(eq(offers.id, offerId), eq(offers.active, true)))
      .limit(1);
    if (rows.length === 0) {
      return apiError('NOT_FOUND', 'This offer is not available.', 404);
    }
    const { offer, price } = rows[0];
    if (!price.stripePriceId) {
      console.error(`POST /api/checkout: offer ${offerId} has an active price row with no stripePriceId`);
      return apiError('NOT_READY', 'This offer is not ready to sell yet.', 422);
    }

    const coach = await db.query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, offer.coachId) });
    if (!coach || !coach.published) {
      return apiError('NOT_FOUND', 'This offer is not available.', 404);
    }

    const account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq: eqCol }) => eqCol(a.coachId, offer.coachId),
    });
    if (!account?.chargesEnabled) {
      return apiError('NOT_READY', 'This coach is not ready to accept payments yet.', 422);
    }

    const origin = new URL(req.url).origin;
    const successPath = b.successPath && typeof b.successPath === 'string' ? b.successPath : `/${coach.handle}?checkout=success`;
    const cancelPath = b.cancelPath && typeof b.cancelPath === 'string' ? b.cancelPath : `/${coach.handle}?checkout=cancelled`;

    const { checkoutUrl } = await createCheckoutSession({
      offerId: offer.id,
      offerType: offer.type,
      coachId: offer.coachId,
      connectedAccountId: account.stripeAccountId,
      price: {
        stripePriceId: price.stripePriceId,
        currency: price.currency,
        unitAmountCents: price.unitAmountCents,
        interval: price.interval,
        intervalCount: price.intervalCount,
      },
      clientEmail,
      successUrl: new URL(successPath, origin).toString(),
      cancelUrl: new URL(cancelPath, origin).toString(),
    });

    return apiSuccess<CreateCheckoutSessionResponse>({ checkoutUrl }, 'Checkout session created.');
  } catch (err) {
    console.error('POST /api/checkout failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
