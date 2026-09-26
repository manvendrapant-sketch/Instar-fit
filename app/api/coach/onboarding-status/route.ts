import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { connectedAccounts } from '@/lib/commerce/schema';
import { deriveConnectStatus } from '@/lib/commerce/connect';
import { getStripe } from '@/lib/stripe/client';
import type { OnboardingStatus } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq: eqCol }) => eqCol(a.coachId, session.coachId),
    });

    if (!account) {
      return apiSuccess<OnboardingStatus>(
        { status: 'not_started', chargesEnabled: false, payoutsEnabled: false, requirementsDue: [] },
        'Onboarding status loaded.',
      );
    }

    // account.updated webhook handling doesn't exist yet (see CLAUDE.md) — nothing else ever
    // pushes Stripe's real status into connected_accounts, so this row otherwise stays frozen at
    // whatever it was when the account was first created. Ask Stripe directly instead of trusting
    // only the cached copy; a Stripe hiccup here falls back to that cache rather than 500ing.
    let flags = {
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      requirementsDue: account.requirementsDue,
    };
    try {
      const stripeAccount = await getStripe().accounts.retrieve(account.stripeAccountId);
      flags = {
        chargesEnabled: stripeAccount.charges_enabled ?? false,
        payoutsEnabled: stripeAccount.payouts_enabled ?? false,
        detailsSubmitted: stripeAccount.details_submitted ?? false,
        requirementsDue: stripeAccount.requirements?.currently_due ?? [],
      };
      if (
        flags.chargesEnabled !== account.chargesEnabled ||
        flags.payoutsEnabled !== account.payoutsEnabled ||
        flags.detailsSubmitted !== account.detailsSubmitted ||
        JSON.stringify(flags.requirementsDue) !== JSON.stringify(account.requirementsDue)
      ) {
        await db.update(connectedAccounts).set({ ...flags, updatedAt: new Date() }).where(eq(connectedAccounts.id, account.id));
      }
    } catch (err) {
      console.error('GET /api/coach/onboarding-status: Stripe sync failed, using cached values:', err);
    }

    const data: OnboardingStatus = { status: deriveConnectStatus(flags), ...flags };
    return apiSuccess<OnboardingStatus>(data, 'Onboarding status loaded.');
  } catch (err) {
    console.error('GET /api/coach/onboarding-status failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
