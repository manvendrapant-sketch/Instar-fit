import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { subscriptions } from '@/lib/commerce/schema';
import { findOwnClientSubscription } from '@/lib/commerce/subscriptions';
import { getStripe } from '@/lib/stripe/client';
import { requireClientSession } from '@/lib/auth/require-client';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * Cancels immediately (not at period end) — the workplan just says "cancel," with no scheduling
 * spec, and an immediate cancel is the simpler of the two reasonable readings. Revisit if a
 * "keep access until the period you already paid for ends" requirement is ever stated explicitly.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  try {
    const db = getDb();
    const subscription = await findOwnClientSubscription(db, session.clientId, id);
    if (!subscription) return apiError('NOT_FOUND', 'Subscription not found.', 404);
    if (subscription.status === 'canceled') {
      return apiError('INVALID_STATE', 'This subscription is already canceled.', 409);
    }

    await getStripe().subscriptions.cancel(subscription.stripeSubscriptionId);

    // `customer.subscription.deleted` will also arrive and re-sync this via handleSubscriptionSynced
    // — writing it here too means the client's own screen reflects it without waiting on that
    // webhook round trip.
    await db
      .update(subscriptions)
      .set({ status: 'canceled', pauseResumesAt: null, pauseReason: null, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscription.id));

    return apiSuccess<{ id: string }>({ id: subscription.id }, 'Subscription canceled.');
  } catch (err) {
    console.error(`POST /api/client/subscriptions/${id}/cancel failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
