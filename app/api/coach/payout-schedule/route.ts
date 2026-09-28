import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { toPayoutScheduleResponse } from '@/lib/commerce/payouts';
import type { PayoutScheduleResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** How often Stripe pays this coach out — part of the connected account's own settings. */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq: eqCol }) => eqCol(a.coachId, session.coachId),
    });
    if (!account) return apiError('NOT_CONNECTED', 'Connect payouts first to see your schedule.', 422);

    const stripeAccount = await getStripe().accounts.retrieve(account.stripeAccountId);
    const data = toPayoutScheduleResponse(stripeAccount.settings?.payouts?.schedule);
    return apiSuccess<PayoutScheduleResponse>(data, 'Payout schedule loaded.');
  } catch (err) {
    console.error('GET /api/coach/payout-schedule failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
