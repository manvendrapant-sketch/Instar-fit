import { apiFetch } from './api-client';
import type { CoachClientSummary, CoachPurchaseSummary, SubscriptionStatus } from './commerce/types';

export const CLIENTS_PATH = '/business/clients';

export const STATUS_LABEL: Record<SubscriptionStatus, { label: string; chip: string }> = {
  incomplete: { label: 'Incomplete', chip: 'k-quiet' },
  trialing: { label: 'Trialing', chip: 'k-checkin' },
  active: { label: 'Active', chip: 'k-lead' },
  past_due: { label: 'Past due', chip: 'k-renew' },
  paused: { label: 'Paused', chip: 'k-quiet' },
  canceled: { label: 'Canceled', chip: '' },
};

export async function fetchCoachClients(): Promise<
  { ok: true; clients: CoachClientSummary[]; purchases: CoachPurchaseSummary[] } | { ok: false; message: string }
> {
  const result = await apiFetch<{ clients: CoachClientSummary[]; purchases: CoachPurchaseSummary[] }>('/api/coach/clients');
  if (result.success) return { ok: true, clients: result.data.clients, purchases: result.data.purchases };
  return { ok: false, message: result.message };
}
