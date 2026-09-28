import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { DEFAULT_CURRENCY, monthRangeUtc, toCoachBalanceResponse } from '@/lib/commerce/payouts';
import { sumNetEarnedCents } from '@/lib/commerce/payments';
import type { CoachBalanceResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Dashboard numbers: available/pending balance read live from the coach's connected Stripe
 * account, plus what they've earned this month and last, net of Instar's fee and refunds, summed
 * from our own `payments`/`refunds` rows (Stripe has no concept of "earned" for us to read back —
 * that's ours to track). */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq: eqCol }) => eqCol(a.coachId, session.coachId),
    });
    if (!account) return apiError('NOT_CONNECTED', 'Connect payouts first to see your balance.', 422);

    const thisMonth = monthRangeUtc(0);
    const lastMonth = monthRangeUtc(1);
    const [balance, earnedThisMonthCents, earnedLastMonthCents] = await Promise.all([
      getStripe().balance.retrieve({}, { stripeContext: account.stripeAccountId }),
      sumNetEarnedCents(db, session.coachId, thisMonth.start, thisMonth.end),
      sumNetEarnedCents(db, session.coachId, lastMonth.start, lastMonth.end),
    ]);

    const data = toCoachBalanceResponse(balance, DEFAULT_CURRENCY, earnedThisMonthCents, earnedLastMonthCents);
    return apiSuccess<CoachBalanceResponse>(data, 'Balance loaded.');
  } catch (err) {
    console.error('GET /api/coach/balance failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
