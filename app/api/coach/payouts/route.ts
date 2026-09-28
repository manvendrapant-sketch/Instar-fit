import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { toCoachPayoutSummary } from '@/lib/commerce/payouts';
import type { CoachPayoutsResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Payout history — read live from Stripe (see Decisions.md for why), newest first, one page
 * (pagination isn't built yet; flagged in CLAUDE.md). */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq: eqCol }) => eqCol(a.coachId, session.coachId),
    });
    if (!account) return apiError('NOT_CONNECTED', 'Connect payouts first to see your payout history.', 422);

    const list = await getStripe().payouts.list({ limit: 25 }, { stripeContext: account.stripeAccountId });
    const data: CoachPayoutsResponse = {
      payouts: list.data.map(toCoachPayoutSummary),
      hasMore: list.has_more,
    };
    return apiSuccess<CoachPayoutsResponse>(data, 'Payouts loaded.');
  } catch (err) {
    console.error('GET /api/coach/payouts failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
