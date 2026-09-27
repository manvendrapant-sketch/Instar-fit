import 'server-only';
import type { payments } from './schema';
import type { ClientPurchaseSummary, CoachPurchaseSummary } from './types';

export function toClientPurchaseSummary(row: typeof payments.$inferSelect, offerName: string): ClientPurchaseSummary {
  return {
    id: row.id,
    offerName,
    currency: row.currency,
    amountCents: row.totalAmountCents,
    purchasedAt: row.createdAt.toISOString(),
  };
}

export function toCoachPurchaseSummary(
  row: typeof payments.$inferSelect,
  offerName: string,
  clientId: string,
  clientEmail: string,
  clientName: string | null,
): CoachPurchaseSummary {
  return {
    id: row.id,
    clientId,
    clientEmail,
    clientName,
    offerName,
    currency: row.currency,
    amountCents: row.totalAmountCents,
    purchasedAt: row.createdAt.toISOString(),
  };
}
