import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, prices, subscriptions } from '@/lib/commerce/schema';
import { toClientSubscriptionSummary } from '@/lib/commerce/subscriptions';
import type { ClientSubscriptionsResponse } from '@/lib/commerce/types';
import { requireClientSession } from '@/lib/auth/require-client';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** The client's "My subscription" page — every subscription they hold with this one coach. */
export async function GET() {
  const session = await requireClientSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const rows = await db
      .select({ subscription: subscriptions, offer: offers, price: prices })
      .from(subscriptions)
      .innerJoin(offers, eq(offers.id, subscriptions.offerId))
      .innerJoin(prices, eq(prices.id, subscriptions.priceId))
      .where(eq(subscriptions.clientId, session.clientId))
      .orderBy(asc(subscriptions.createdAt));

    const data: ClientSubscriptionsResponse = {
      subscriptions: rows.map((r) =>
        toClientSubscriptionSummary(r.subscription, r.offer.name, {
          currency: r.price.currency,
          unitAmountCents: r.price.unitAmountCents,
          interval: r.price.interval,
          intervalCount: r.price.intervalCount,
        }),
      ),
    };
    return apiSuccess<ClientSubscriptionsResponse>(data, 'Loaded.');
  } catch (err) {
    console.error('GET /api/client/subscriptions failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
