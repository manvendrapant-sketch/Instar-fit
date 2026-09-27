import { apiFetch } from './api-client';
import type { CoachClientSummary, SubscriptionStatus } from './commerce/types';

export const CLIENTS_PATH = '/business/clients';

export const STATUS_LABEL: Record<SubscriptionStatus, { label: string; chip: string }> = {
  incomplete: { label: 'Incomplete', chip: 'k-quiet' },
  trialing: { label: 'Trialing', chip: 'k-checkin' },
  active: { label: 'Active', chip: 'k-lead' },
  past_due: { label: 'Past due', chip: 'k-renew' },
  paused: { label: 'Paused', chip: 'k-quiet' },
  canceled: { label: 'Canceled', chip: '' },
};

export async function fetchCoachClients(): Promise<{ ok: true; clients: CoachClientSummary[] } | { ok: false; message: string }> {
  const result = await apiFetch<{ clients: CoachClientSummary[] }>('/api/coach/clients');
  if (result.success) return { ok: true, clients: result.data.clients };
  return { ok: false, message: result.message };
}
