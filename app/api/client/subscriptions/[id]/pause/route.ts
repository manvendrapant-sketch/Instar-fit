import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { subscriptions } from '@/lib/commerce/schema';
import { findOwnClientSubscription, subscriptionSyncFields, toClientSubscriptionSummary, validatePauseInput } from '@/lib/commerce/subscriptions';
import { getStripe } from '@/lib/stripe/client';
import { requireClientSession } from '@/lib/auth/require-client';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * Pause flow, shown before cancel: vacation / injury / other, pick a resume date. Stripe itself
 * auto-resumes billing at that date and fires `customer.subscription.resumed`
 * (handleSubscriptionSynced) — this route doesn't need its own resume-scheduling logic.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const validation = validatePauseInput(body);
  if ('errors' in validation) {
    return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
  }
  const { reason, resumeDate } = validation.value;

  try {
    const db = getDb();
    const subscription = await findOwnClientSubscription(db, session.clientId, id);
    if (!subscription) return apiError('NOT_FOUND', 'Subscription not found.', 404);
    if (subscription.status === 'canceled') {
      return apiError('INVALID_STATE', 'This subscription is already canceled.', 409);
    }

    const resumesAtEpoch = Math.floor(new Date(`${resumeDate}T00:00:00.000Z`).getTime() / 1000);
    const updated = await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
      pause_collection: { behavior: 'void', resumes_at: resumesAtEpoch },
    });

    // `reason` stands in for "existing pauseReason" here — subscriptionSyncFields only keeps
    // whatever's passed while pause_collection is set, and it's always set right after this call.
    const fields = subscriptionSyncFields(updated, reason);
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
    return apiSuccess(data, 'Subscription paused.');
  } catch (err) {
    console.error(`POST /api/client/subscriptions/${id}/pause failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
