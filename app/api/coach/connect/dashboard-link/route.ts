import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import type { DashboardLinkResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * A one-time login link into the coach's own Stripe Express dashboard (their limited-scope view:
 * balance, payout history, bank account) — the "Manage on Stripe" button on the payouts page.
 * Distinct from the account_onboarding Account Link: this only works once payouts are connected,
 * and Stripe's login links expire after a single use / a few minutes, so a fresh one is created on
 * every click rather than cached.
 */
export async function POST() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq }) => eq(a.coachId, session.coachId),
    });
    if (!account) return apiError('NOT_CONNECTED', 'Connect payouts first.', 422);

    const loginLink = await getStripe().accounts.createLoginLink(account.stripeAccountId);
    return apiSuccess<DashboardLinkResponse>({ url: loginLink.url }, 'Dashboard link created.');
  } catch (err) {
    console.error('POST /api/coach/connect/dashboard-link failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
