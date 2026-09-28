import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { acceptedEvidenceFieldsForReason, findOwnDispute, toCoachDisputeSummary, toEvidenceFields } from '@/lib/commerce/disputes';
import type { CoachDisputeDetailResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** The summary plus what's needed to actually respond: the evidence currently staged on Stripe's
 * side (there's no separate draft store — see Decisions.md), and which of our curated fields are
 * relevant for this dispute's reason code. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  try {
    const db = getDb();
    const row = await findOwnDispute(db, session.coachId, id);
    if (!row) return apiError('NOT_FOUND', 'Dispute not found.', 404);

    const stripeDispute = await getStripe().disputes.retrieve(row.dispute.stripeDisputeId);

    const data: CoachDisputeDetailResponse = {
      ...toCoachDisputeSummary(row.dispute, row.payment.currency, row.client.email, row.client.name, row.offer?.name ?? 'Deleted offer'),
      evidence: toEvidenceFields(stripeDispute.evidence),
      acceptedEvidenceFields: acceptedEvidenceFieldsForReason(row.dispute.reason ?? 'general'),
      submissionCount: stripeDispute.evidence_details?.submission_count ?? 0,
      pastDue: stripeDispute.evidence_details?.past_due ?? false,
    };
    return apiSuccess<CoachDisputeDetailResponse>(data, 'Dispute loaded.');
  } catch (err) {
    console.error(`GET /api/coach/disputes/${id} failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
