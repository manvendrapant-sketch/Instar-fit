import 'server-only';
import { and, eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import { clients, disputes, offers, payments } from './schema';
import type { CoachDisputeSummary, DisputeEvidenceFields } from './types';

type Db = PostgresJsDatabase<typeof schema>;

/**
 * A curated subset of Stripe's ~25 dispute evidence fields (see `types.ts`'s `DisputeEvidenceFields`
 * doc comment for why not all of them) — this maps our own camelCase keys to Stripe's snake_case
 * field names, in both directions.
 */
const EVIDENCE_FIELD_MAP: Record<keyof DisputeEvidenceFields, string> = {
  customerName: 'customer_name',
  customerEmailAddress: 'customer_email_address',
  customerPurchaseIp: 'customer_purchase_ip',
  productDescription: 'product_description',
  billingAddress: 'billing_address',
  refundPolicyDisclosure: 'refund_policy_disclosure',
  refundRefusalExplanation: 'refund_refusal_explanation',
  cancellationPolicyDisclosure: 'cancellation_policy_disclosure',
  cancellationRebuttal: 'cancellation_rebuttal',
  serviceDate: 'service_date',
  uncategorizedText: 'uncategorized_text',
  customerCommunication: 'customer_communication',
  serviceDocumentation: 'service_documentation',
  uncategorizedFile: 'uncategorized_file',
};

function fileFieldValue(v: string | Stripe.File | null | undefined): string | null {
  if (!v) return null;
  return typeof v === 'string' ? v : v.id;
}

/** Reads Stripe's own dispute evidence object back into our camelCase shape — this doubles as
 * "what's currently staged" for a draft in progress, since Stripe's dispute object *is* the draft. */
export function toEvidenceFields(evidence: Stripe.Dispute.Evidence | undefined): DisputeEvidenceFields {
  const e = evidence ?? ({} as Partial<Stripe.Dispute.Evidence>);
  return {
    customerName: e.customer_name ?? null,
    customerEmailAddress: e.customer_email_address ?? null,
    customerPurchaseIp: e.customer_purchase_ip ?? null,
    productDescription: e.product_description ?? null,
    billingAddress: e.billing_address ?? null,
    refundPolicyDisclosure: e.refund_policy_disclosure ?? null,
    refundRefusalExplanation: e.refund_refusal_explanation ?? null,
    cancellationPolicyDisclosure: e.cancellation_policy_disclosure ?? null,
    cancellationRebuttal: e.cancellation_rebuttal ?? null,
    serviceDate: e.service_date ?? null,
    uncategorizedText: e.uncategorized_text ?? null,
    customerCommunication: fileFieldValue(e.customer_communication),
    serviceDocumentation: fileFieldValue(e.service_documentation),
    uncategorizedFile: fileFieldValue(e.uncategorized_file),
  };
}

/** The reverse of `toEvidenceFields` — only includes keys actually present in `fields`, so a
 * partial save (`PATCH .../evidence`) never clobbers fields the coach didn't touch this time;
 * Stripe merges by field, not by whole-object replacement. */
export function toEvidenceParams(fields: Partial<DisputeEvidenceFields>): Stripe.DisputeUpdateParams.Evidence {
  const params: Record<string, string> = {};
  for (const key of Object.keys(fields) as (keyof DisputeEvidenceFields)[]) {
    const value = fields[key];
    if (value != null) params[EVIDENCE_FIELD_MAP[key]] = value;
  }
  return params as Stripe.DisputeUpdateParams.Evidence;
}

/**
 * Which of our curated evidence fields are actually relevant for a given dispute reason —
 * Stripe's API doesn't return this itself (only its own Dashboard has this guidance built in), so
 * this is a hand-curated mapping using Stripe's well-documented reason codes. Reasons needing
 * fields outside our curated set (`duplicate`'s own charge-comparison fields, in particular)
 * fall back to the general set — flagged in CLAUDE.md as a deliberate v1 scope reduction.
 */
const EVIDENCE_FIELDS_BY_REASON: Record<string, (keyof DisputeEvidenceFields)[]> = {
  product_not_received: ['productDescription', 'customerCommunication', 'serviceDate', 'serviceDocumentation'],
  not_received: ['productDescription', 'customerCommunication', 'serviceDate', 'serviceDocumentation'],
  product_unacceptable: ['productDescription', 'customerCommunication', 'refundPolicyDisclosure', 'refundRefusalExplanation'],
  subscription_canceled: ['cancellationPolicyDisclosure', 'cancellationRebuttal', 'customerCommunication', 'serviceDate'],
  fraudulent: ['customerName', 'customerEmailAddress', 'customerPurchaseIp', 'customerCommunication', 'productDescription'],
  unrecognized: ['customerName', 'customerEmailAddress', 'customerPurchaseIp', 'productDescription', 'customerCommunication'],
  credit_not_processed: ['refundPolicyDisclosure', 'refundRefusalExplanation', 'customerCommunication'],
};

const GENERAL_EVIDENCE_FIELDS: (keyof DisputeEvidenceFields)[] = [
  'productDescription',
  'customerCommunication',
  'uncategorizedText',
  'uncategorizedFile',
];

export function acceptedEvidenceFieldsForReason(reason: string): (keyof DisputeEvidenceFields)[] {
  return EVIDENCE_FIELDS_BY_REASON[reason] ?? GENERAL_EVIDENCE_FIELDS;
}

/** Scoped to this coach's own id so one coach can never read/edit another's dispute by guessing
 * its uuid — a mismatch reads identically to "doesn't exist". Mirrors findOwnOffer. */
export async function findOwnDispute(db: Db, coachId: string, id: string) {
  const [row] = await db
    .select({ dispute: disputes, payment: payments, client: clients, offer: offers })
    .from(disputes)
    .innerJoin(payments, eq(payments.id, disputes.paymentId))
    .innerJoin(clients, eq(clients.id, payments.clientId))
    .leftJoin(offers, eq(offers.id, payments.offerId))
    .where(and(eq(disputes.id, id), eq(payments.coachId, coachId)))
    .limit(1);
  return row ?? null;
}

export function toCoachDisputeSummary(
  row: typeof disputes.$inferSelect,
  currency: string,
  clientEmail: string,
  clientName: string | null,
  offerName: string,
): CoachDisputeSummary {
  return {
    id: row.id,
    paymentId: row.paymentId,
    clientName,
    clientEmail,
    offerName,
    currency,
    amountCents: row.amountCents,
    reason: row.reason ?? 'general',
    status: row.status,
    evidenceDueBy: row.evidenceDueBy ? row.evidenceDueBy.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
