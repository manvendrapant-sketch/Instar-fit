import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, payments, prices, subscriptions } from '@/lib/commerce/schema';
import { toClientSubscriptionSummary } from '@/lib/commerce/subscriptions';
import { toClientPurchaseSummary } from '@/lib/commerce/purchases';
import type { ClientSubscriptionsResponse } from '@/lib/commerce/types';
import { requireClientSession } from '@/lib/auth/require-client';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * The client's "My subscription" page — every subscription they hold with this coach, plus every
 * one-time (program/session) purchase. Purchases come from `payments` rows with no
 * `subscriptionId` — a subscription's own billing-cycle payments always have one, so this can't
 * double-count a renewal as a separate purchase.
 */
export async function GET() {
  const session = await requireClientSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const [subscriptionRows, purchaseRows] = await Promise.all([
      db
        .select({ subscription: subscriptions, offer: offers, price: prices })
        .from(subscriptions)
        .innerJoin(offers, eq(offers.id, subscriptions.offerId))
        .innerJoin(prices, eq(prices.id, subscriptions.priceId))
        .where(eq(subscriptions.clientId, session.clientId))
        .orderBy(asc(subscriptions.createdAt)),
      db
        .select({ payment: payments, offer: offers })
        .from(payments)
        .innerJoin(offers, eq(offers.id, payments.offerId))
        .where(and(eq(payments.clientId, session.clientId), isNull(payments.subscriptionId), eq(payments.status, 'succeeded')))
        .orderBy(desc(payments.createdAt)),
    ]);

    const data: ClientSubscriptionsResponse = {
      subscriptions: subscriptionRows.map((r) =>
        toClientSubscriptionSummary(r.subscription, r.offer.name, {
          currency: r.price.currency,
          unitAmountCents: r.price.unitAmountCents,
          interval: r.price.interval,
          intervalCount: r.price.intervalCount,
        }),
      ),
      purchases: purchaseRows.map((r) => toClientPurchaseSummary(r.payment, r.offer.name)),
    };
    return apiSuccess<ClientSubscriptionsResponse>(data, 'Loaded.');
  } catch (err) {
    console.error('GET /api/client/subscriptions failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
