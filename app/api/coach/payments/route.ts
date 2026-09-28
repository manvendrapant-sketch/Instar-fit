import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { clients, offers, payments, refunds } from '@/lib/commerce/schema';
import { toCoachPaymentSummary } from '@/lib/commerce/payments';
import type { CoachPaymentsResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Every payment this coach has ever received, newest first, with how much of it has been
 * refunded so far. `offer` is a left join — an offer can be deleted after a payment happened. */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const rows = await db
      .select({ payment: payments, client: clients, offer: offers })
      .from(payments)
      .innerJoin(clients, eq(clients.id, payments.clientId))
      .leftJoin(offers, eq(offers.id, payments.offerId))
      .where(eq(payments.coachId, session.coachId))
      .orderBy(desc(payments.createdAt));

    const paymentIds = rows.map((r) => r.payment.id);
    // Only a succeeded refund actually reduced what the client was charged — a pending or failed
    // one never touched the payment.
    const refundRows = paymentIds.length
      ? await db
          .select({ paymentId: refunds.paymentId, amountCents: refunds.amountCents })
          .from(refunds)
          .where(and(inArray(refunds.paymentId, paymentIds), eq(refunds.status, 'succeeded')))
      : [];

    const refundedByPayment = new Map<string, number>();
    for (const r of refundRows) {
      refundedByPayment.set(r.paymentId, (refundedByPayment.get(r.paymentId) ?? 0) + r.amountCents);
    }

    const data: CoachPaymentsResponse = {
      payments: rows.map((r) =>
        toCoachPaymentSummary(
          r.payment,
          r.offer?.name ?? 'Deleted offer',
          r.client.email,
          r.client.name,
          refundedByPayment.get(r.payment.id) ?? 0,
        ),
      ),
    };
    return apiSuccess<CoachPaymentsResponse>(data, 'Payments loaded.');
  } catch (err) {
    console.error('GET /api/coach/payments failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
