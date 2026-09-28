import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import { payments, refunds } from './schema';
import type { CoachPaymentSummary } from './types';

type Db = PostgresJsDatabase<typeof schema>;

export function toCoachPaymentSummary(
  row: typeof payments.$inferSelect,
  offerName: string,
  clientEmail: string,
  clientName: string | null,
  refundedAmountCents: number,
): CoachPaymentSummary {
  return {
    id: row.id,
    clientName,
    clientEmail,
    offerName,
    currency: row.currency,
    totalAmountCents: row.totalAmountCents,
    netCents: Math.max(0, row.totalAmountCents - row.platformFeeCents - refundedAmountCents),
    refundedAmountCents,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * What the coach actually keeps (after Instar's platform fee and any refunds) from payments
 * created in `[start, end)`. Used for the balance page's "earned this/last month" figures — its
 * own approximation, not authoritative (Stripe's live balance is, per Decisions.md); a `failed`
 * payment never happened so it's excluded, everything else that moved money counts.
 */
export async function sumNetEarnedCents(db: Db, coachId: string, start: Date, end: Date): Promise<number> {
  const rows = await db.query.payments.findMany({
    where: (p, { eq: eqCol, and: andCol, gte: gteCol, lt: ltCol, ne: neCol }) =>
      andCol(eqCol(p.coachId, coachId), gteCol(p.createdAt, start), ltCol(p.createdAt, end), neCol(p.status, 'failed')),
  });
  if (rows.length === 0) return 0;

  const ids = rows.map((r) => r.id);
  const refundRows = await db
    .select({ paymentId: refunds.paymentId, amountCents: refunds.amountCents })
    .from(refunds)
    .where(and(inArray(refunds.paymentId, ids), eq(refunds.status, 'succeeded')));

  const refundedByPayment = new Map<string, number>();
  for (const r of refundRows) {
    refundedByPayment.set(r.paymentId, (refundedByPayment.get(r.paymentId) ?? 0) + r.amountCents);
  }

  return rows.reduce(
    (sum, p) => sum + Math.max(0, p.totalAmountCents - p.platformFeeCents - (refundedByPayment.get(p.id) ?? 0)),
    0,
  );
}
