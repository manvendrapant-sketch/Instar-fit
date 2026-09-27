import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, prices } from '@/lib/commerce/schema';
import { computeCheckoutBreakdown } from '@/lib/commerce/money';
import type { CheckoutQuoteResponse } from '@/lib/commerce/types';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** No auth — the public storefront's "what will I pay" preview before starting checkout. */
export async function GET(req: Request) {
  const offerId = new URL(req.url).searchParams.get('offerId');
  if (!offerId) {
    return apiError('VALIDATION_ERROR', 'offerId is required.', 422, { offerId: 'offerId is required.' });
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
    const breakdown = computeCheckoutBreakdown(price.unitAmountCents, price.currency);

    const data: CheckoutQuoteResponse = {
      offer: {
        id: offer.id,
        type: offer.type,
        name: offer.name,
        description: offer.description,
        includes: offer.includes,
        lengthWeeks: offer.lengthWeeks,
        sessionMinutes: offer.sessionMinutes,
        price: {
          currency: price.currency,
          unitAmountCents: price.unitAmountCents,
          interval: price.interval,
          intervalCount: price.intervalCount,
        },
      },
      // Deliberately only the client-safe MoneyBreakdown fields (no platformFeeCents) — this is
      // served to an anonymous client, not the coach viewing their own offer builder.
      breakdown: {
        currency: breakdown.currency,
        baseAmountCents: breakdown.baseAmountCents,
        serviceFeeCents: breakdown.serviceFeeCents,
        totalAmountCents: breakdown.totalAmountCents,
      },
    };
    return apiSuccess<CheckoutQuoteResponse>(data, 'Quote computed.');
  } catch (err) {
    console.error('GET /api/checkout/quote failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
