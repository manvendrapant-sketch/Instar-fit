import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { DEFAULT_CURRENCY, startOfCurrentMonthUtc, toCoachBalanceResponse } from '@/lib/commerce/payouts';
import type { CoachBalanceResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Dashboard numbers: available/pending balance read live from the coach's connected Stripe
 * account, plus this month's revenue summed from our own `payments` rows (Stripe has no concept
 * of "revenue" for us to read back — that's ours to track). */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq: eqCol }) => eqCol(a.coachId, session.coachId),
    });
    if (!account) return apiError('NOT_CONNECTED', 'Connect payouts first to see your balance.', 422);

    const [balance, monthPayments] = await Promise.all([
      getStripe().balance.retrieve({}, { stripeContext: account.stripeAccountId }),
      db.query.payments.findMany({
        where: (p, { eq: eqCol, and: andCol, gte: gteCol }) =>
          andCol(eqCol(p.coachId, session.coachId), eqCol(p.status, 'succeeded'), gteCol(p.createdAt, startOfCurrentMonthUtc())),
      }),
    ]);

    const revenueThisMonthCents = monthPayments.reduce((sum, p) => sum + p.totalAmountCents, 0);
    const data = toCoachBalanceResponse(balance, DEFAULT_CURRENCY, revenueThisMonthCents);
    return apiSuccess<CoachBalanceResponse>(data, 'Balance loaded.');
  } catch (err) {
    console.error('GET /api/coach/balance failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
