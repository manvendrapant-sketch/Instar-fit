import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { clients, offers, payments, subscriptions } from '@/lib/commerce/schema';
import { toCoachClientSummary } from '@/lib/commerce/subscriptions';
import { toCoachPurchaseSummary } from '@/lib/commerce/purchases';
import type { CoachClientsResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * Coach view: which clients are active, paused and past due (one row per subscription), plus
 * everyone who's made a one-time (program/session) purchase — `payments` rows with no
 * `subscriptionId`, so a subscription's own billing-cycle payments never double up as a purchase.
 */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const [subscriptionRows, purchaseRows] = await Promise.all([
      db
        .select({ subscription: subscriptions, offer: offers, client: clients })
        .from(subscriptions)
        .innerJoin(clients, eq(clients.id, subscriptions.clientId))
        .innerJoin(offers, eq(offers.id, subscriptions.offerId))
        .where(eq(clients.coachId, session.coachId))
        .orderBy(desc(subscriptions.updatedAt)),
      db
        .select({ payment: payments, offer: offers, client: clients })
        .from(payments)
        .innerJoin(clients, eq(clients.id, payments.clientId))
        .innerJoin(offers, eq(offers.id, payments.offerId))
        .where(and(eq(payments.coachId, session.coachId), isNull(payments.subscriptionId), eq(payments.status, 'succeeded')))
        .orderBy(desc(payments.createdAt)),
    ]);

    const data: CoachClientsResponse = {
      clients: subscriptionRows.map((r) => toCoachClientSummary(r.subscription, r.offer.name, r.client.id, r.client.email, r.client.name)),
      purchases: purchaseRows.map((r) => toCoachPurchaseSummary(r.payment, r.offer.name, r.client.id, r.client.email, r.client.name)),
    };
    return apiSuccess<CoachClientsResponse>(data, 'Loaded.');
  } catch (err) {
    console.error('GET /api/coach/clients failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
