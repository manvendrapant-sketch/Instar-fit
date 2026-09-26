import { getDb } from '@/lib/commerce/db';
import { deriveConnectStatus } from '@/lib/commerce/connect';
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
      where: (a, { eq }) => eq(a.coachId, session.coachId),
    });

    const data: OnboardingStatus = {
      status: deriveConnectStatus(account),
      chargesEnabled: account?.chargesEnabled ?? false,
      payoutsEnabled: account?.payoutsEnabled ?? false,
      requirementsDue: account?.requirementsDue ?? [],
    };

    return apiSuccess<OnboardingStatus>(data, 'Onboarding status loaded.');
  } catch (err) {
    console.error('GET /api/coach/onboarding-status failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
