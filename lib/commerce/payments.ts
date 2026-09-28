import 'server-only';
import type { payments } from './schema';
import type { CoachPaymentSummary } from './types';

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
    refundedAmountCents,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
