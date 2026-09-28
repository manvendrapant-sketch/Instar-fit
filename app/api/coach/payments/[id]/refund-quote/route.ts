import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { refunds } from '@/lib/commerce/schema';
import { computeRefundPreview } from '@/lib/commerce/refunds';
import type { RefundQuoteResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** The refund confirmation's live preview: what the client gets back, and what comes out of the
 * coach's own balance — computed the same way the real refund call will split it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;
  const amountCentsRaw = new URL(req.url).searchParams.get('amountCents');
  const requestedAmountCents = Number(amountCentsRaw);
  if (!amountCentsRaw || !Number.isFinite(requestedAmountCents)) {
    return apiError('VALIDATION_ERROR', 'amountCents is required and must be a number.', 422, { amountCents: 'Required.' });
  }

  try {
    const db = getDb();
    const payment = await db.query.payments.findFirst({
      where: (p, { eq: eqCol, and: andCol }) => andCol(eqCol(p.id, id), eqCol(p.coachId, session.coachId)),
    });
    if (!payment) return apiError('NOT_FOUND', 'Payment not found.', 404);

    const succeededRefunds = await db
      .select({ amountCents: refunds.amountCents })
      .from(refunds)
      .where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'succeeded')));
    const alreadyRefundedCents = succeededRefunds.reduce((sum, r) => sum + r.amountCents, 0);

    const data = computeRefundPreview(payment, requestedAmountCents, alreadyRefundedCents);
    return apiSuccess<RefundQuoteResponse>(data, 'Refund preview loaded.');
  } catch (err) {
    console.error(`GET /api/coach/payments/${id}/refund-quote failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
