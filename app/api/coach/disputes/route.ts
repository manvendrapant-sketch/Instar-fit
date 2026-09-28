import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { clients, disputes, offers, payments } from '@/lib/commerce/schema';
import { toCoachDisputeSummary } from '@/lib/commerce/disputes';
import type { CoachDisputesResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Every dispute this coach has ever had, newest first — the "alert the coach" surface per the
 * workplan (see Decisions.md for why this pass doesn't also send a notification). */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const rows = await db
      .select({ dispute: disputes, payment: payments, client: clients, offer: offers })
      .from(disputes)
      .innerJoin(payments, eq(payments.id, disputes.paymentId))
      .innerJoin(clients, eq(clients.id, payments.clientId))
      .leftJoin(offers, eq(offers.id, payments.offerId))
      .where(eq(payments.coachId, session.coachId))
      .orderBy(desc(disputes.createdAt));

    const data: CoachDisputesResponse = {
      disputes: rows.map((r) =>
        toCoachDisputeSummary(r.dispute, r.payment.currency, r.client.email, r.client.name, r.offer?.name ?? 'Deleted offer'),
      ),
    };
    return apiSuccess<CoachDisputesResponse>(data, 'Disputes loaded.');
  } catch (err) {
    console.error('GET /api/coach/disputes failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
