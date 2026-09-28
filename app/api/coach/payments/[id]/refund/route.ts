import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { refunds } from '@/lib/commerce/schema';
import { mapRefundStatus, validateRefundAmount } from '@/lib/commerce/refunds';
import { getStripe } from '@/lib/stripe/client';
import type { RefundPaymentRequest, RefundPaymentResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * Creates the real Stripe refund. Never writes the `refunds` row itself — same "webhook is the
 * one writer of ledger rows" convention as every other payment in this app; `charge.refunded`
 * does that once Stripe confirms it. Always reverses Instar's platform fee and the transfer to
 * the coach's connected account proportionally (see Decisions.md) — both flags are required for
 * a destination charge, not optional extras.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }
  const b = (body ?? {}) as Partial<RefundPaymentRequest>;

  try {
    const db = getDb();
    const payment = await db.query.payments.findFirst({
      where: (p, { eq: eqCol, and: andCol }) => andCol(eqCol(p.id, id), eqCol(p.coachId, session.coachId)),
    });
    if (!payment) return apiError('NOT_FOUND', 'Payment not found.', 404);
    if (!payment.stripePaymentIntentId && !payment.stripeChargeId) {
      return apiError('NOT_REFUNDABLE', 'This payment has no Stripe charge to refund.', 422);
    }

    const succeededRefunds = await db
      .select({ amountCents: refunds.amountCents })
      .from(refunds)
      .where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'succeeded')));
    const alreadyRefundedCents = succeededRefunds.reduce((sum, r) => sum + r.amountCents, 0);
    const maxRefundableCents = payment.totalAmountCents - alreadyRefundedCents;

    const validation = validateRefundAmount(b.amountCents, maxRefundableCents);
    if ('errors' in validation) {
      return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
    }

    const stripeRefund = await getStripe().refunds.create({
      ...(payment.stripePaymentIntentId
        ? { payment_intent: payment.stripePaymentIntentId }
        : { charge: payment.stripeChargeId! }),
      amount: validation.value,
      refund_application_fee: true,
      reverse_transfer: true,
      metadata: b.reason ? { reason: b.reason } : undefined,
    });

    const data: RefundPaymentResponse = {
      id: stripeRefund.id,
      status: mapRefundStatus(stripeRefund.status),
      amountCents: stripeRefund.amount,
    };
    return apiSuccess<RefundPaymentResponse>(data, 'Refund started.');
  } catch (err) {
    console.error(`POST /api/coach/payments/${id}/refund failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
