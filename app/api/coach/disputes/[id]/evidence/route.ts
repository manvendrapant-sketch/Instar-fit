import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { acceptedEvidenceFieldsForReason, findOwnDispute, toCoachDisputeSummary, toEvidenceFields, toEvidenceParams } from '@/lib/commerce/disputes';
import type { CoachDisputeDetailResponse, DisputeEvidenceFields } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * PATCH saves a draft (`submit: false`); POST submits it to the bank (`submit: true`). Both call
 * the exact same Stripe update — Stripe's own dispute object *is* the draft state, so there's no
 * local evidence table to keep in sync (see Decisions.md's Sprint 5 entry). Neither writes our
 * own `disputes` row directly; the resulting `charge.dispute.updated` webhook does that, same
 * "webhook is the one writer of ledger rows" convention as every other payment in this app.
 */
async function updateEvidence(req: Request, id: string, submit: boolean) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  try {
    const db = getDb();
    const row = await findOwnDispute(db, session.coachId, id);
    if (!row) return apiError('NOT_FOUND', 'Dispute not found.', 404);

    const evidence = toEvidenceParams((body ?? {}) as Partial<DisputeEvidenceFields>);
    const stripeDispute = await getStripe().disputes.update(row.dispute.stripeDisputeId, { evidence, submit });

    const data: CoachDisputeDetailResponse = {
      ...toCoachDisputeSummary(row.dispute, row.payment.currency, row.client.email, row.client.name, row.offer?.name ?? 'Deleted offer'),
      evidence: toEvidenceFields(stripeDispute.evidence),
      acceptedEvidenceFields: acceptedEvidenceFieldsForReason(row.dispute.reason ?? 'general'),
      submissionCount: stripeDispute.evidence_details?.submission_count ?? 0,
      pastDue: stripeDispute.evidence_details?.past_due ?? false,
    };
    return apiSuccess<CoachDisputeDetailResponse>(data, submit ? 'Evidence submitted.' : 'Draft saved.');
  } catch (err) {
    console.error(`.../api/coach/disputes/${id}/evidence (submit=${submit}) failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return updateEvidence(req, id, false);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return updateEvidence(req, id, true);
}
