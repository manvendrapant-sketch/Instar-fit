import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { clients, offers, subscriptions } from '@/lib/commerce/schema';
import { toCoachClientSummary } from '@/lib/commerce/subscriptions';
import type { CoachClientsResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Coach view: which clients are active, paused and past due — one row per subscription. */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const rows = await db
      .select({ subscription: subscriptions, offer: offers, client: clients })
      .from(subscriptions)
      .innerJoin(clients, eq(clients.id, subscriptions.clientId))
      .innerJoin(offers, eq(offers.id, subscriptions.offerId))
      .where(eq(clients.coachId, session.coachId))
      .orderBy(desc(subscriptions.updatedAt));

    const data: CoachClientsResponse = {
      clients: rows.map((r) => toCoachClientSummary(r.subscription, r.offer.name, r.client.id, r.client.email, r.client.name)),
    };
    return apiSuccess<CoachClientsResponse>(data, 'Loaded.');
  } catch (err) {
    console.error('GET /api/coach/clients failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
