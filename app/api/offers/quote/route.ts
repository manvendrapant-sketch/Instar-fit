import { computeCheckoutBreakdown } from '@/lib/commerce/money';
import type { OfferQuoteResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** The offer builder's live "you'll receive" preview — computed from whatever price is currently typed in, before the offer is saved. */
export async function GET(req: Request) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const url = new URL(req.url);
  const rawAmount = url.searchParams.get('unitAmountCents');
  const currency = url.searchParams.get('currency')?.trim().toLowerCase() || 'usd';

  const unitAmountCents = rawAmount === null ? NaN : Number.parseInt(rawAmount, 10);
  if (!Number.isInteger(unitAmountCents) || unitAmountCents <= 0) {
    return apiError('VALIDATION_ERROR', 'unitAmountCents must be a positive integer.', 422, {
      unitAmountCents: 'Enter a price greater than $0.',
    });
  }

  const breakdown = computeCheckoutBreakdown(unitAmountCents, currency);
  const data: OfferQuoteResponse = {
    ...breakdown,
    coachReceivesCents: breakdown.baseAmountCents - breakdown.platformFeeCents,
  };

  return apiSuccess<OfferQuoteResponse>(data, 'Quote computed.');
}
