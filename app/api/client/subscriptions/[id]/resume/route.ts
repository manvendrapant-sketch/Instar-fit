import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { subscriptions } from '@/lib/commerce/schema';
import { findOwnClientSubscription, subscriptionSyncFields, toClientSubscriptionSummary } from '@/lib/commerce/subscriptions';
import { getStripe } from '@/lib/stripe/client';
import { requireClientSession } from '@/lib/auth/require-client';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Lets a paused client resume before their chosen date, rather than waiting for Stripe's own auto-resume. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  try {
    const db = getDb();
    const subscription = await findOwnClientSubscription(db, session.clientId, id);
    if (!subscription) return apiError('NOT_FOUND', 'Subscription not found.', 404);
    if (subscription.status !== 'paused') {
      return apiError('INVALID_STATE', 'This subscription is not paused.', 409);
    }

    // Empty string clears pause_collection (Stripe's Emptyable convention) — collection resumes
    // immediately rather than waiting for the previously chosen resumesAt.
    const updated = await getStripe().subscriptions.update(subscription.stripeSubscriptionId, { pause_collection: '' });

    const fields = subscriptionSyncFields(updated, subscription.pauseReason);
    await db.update(subscriptions).set({ ...fields, updatedAt: new Date() }).where(eq(subscriptions.id, subscription.id));

    const [offer, priceRow] = await Promise.all([
      db.query.offers.findFirst({ where: (o, { eq: eqCol }) => eqCol(o.id, subscription.offerId) }),
      db.query.prices.findFirst({ where: (p, { eq: eqCol }) => eqCol(p.id, subscription.priceId) }),
    ]);

    const data = {
      subscription: toClientSubscriptionSummary(
        { ...subscription, ...fields },
        offer?.name ?? '',
        priceRow
          ? { currency: priceRow.currency, unitAmountCents: priceRow.unitAmountCents, interval: priceRow.interval, intervalCount: priceRow.intervalCount }
          : { currency: 'usd', unitAmountCents: 0, interval: null, intervalCount: null },
      ),
    };
    return apiSuccess(data, 'Subscription resumed.');
  } catch (err) {
    console.error(`POST /api/client/subscriptions/${id}/resume failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
