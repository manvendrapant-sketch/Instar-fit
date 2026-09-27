import { apiFetch } from './api-client';
import { formatMoney } from './offers';
import type { ClientSubscriptionSummary, PauseReason, PauseSubscriptionRequest } from './commerce/types';

const INTERVAL_SUFFIX: Record<string, string> = { week: '/wk', month: '/mo', year: '/yr' };

/** "$199/mo", "$499". */
export function formatSubscriptionPrice(s: Pick<ClientSubscriptionSummary, 'price'>): string {
  const base = formatMoney(s.price.unitAmountCents);
  return s.price.interval ? base + INTERVAL_SUFFIX[s.price.interval] : base;
}

export const PAUSE_REASON_LABEL: Record<PauseReason, string> = {
  vacation: 'Vacation',
  injury: 'Injury',
  other: 'Other',
};

export type ClientSubscriptionsResult =
  | { ok: true; subscriptions: ClientSubscriptionSummary[] }
  | { ok: false; message: string };

export async function fetchClientSubscriptions(): Promise<ClientSubscriptionsResult> {
  const result = await apiFetch<{ subscriptions: ClientSubscriptionSummary[] }>('/api/client/subscriptions');
  if (result.success) return { ok: true, subscriptions: result.data.subscriptions };
  return { ok: false, message: result.message };
}

export type PauseFieldErrors = Partial<Record<'reason' | 'resumeDate', string>>;

export type SubscriptionActionResult =
  | { ok: true; subscription: ClientSubscriptionSummary }
  | { ok: false; message: string; fieldErrors?: PauseFieldErrors };

export async function pauseSubscriptionApi(id: string, input: PauseSubscriptionRequest): Promise<SubscriptionActionResult> {
  const result = await apiFetch<{ subscription: ClientSubscriptionSummary }>(`/api/client/subscriptions/${id}/pause`, {
    method: 'POST',
    body: input,
  });
  if (result.success) return { ok: true, subscription: result.data.subscription };
  return { ok: false, message: result.message, fieldErrors: result.fields };
}

export async function resumeSubscriptionApi(id: string): Promise<SubscriptionActionResult> {
  const result = await apiFetch<{ subscription: ClientSubscriptionSummary }>(`/api/client/subscriptions/${id}/resume`, {
    method: 'POST',
  });
  if (result.success) return { ok: true, subscription: result.data.subscription };
  return { ok: false, message: result.message };
}

export async function cancelSubscriptionApi(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await apiFetch<{ id: string }>(`/api/client/subscriptions/${id}/cancel`, { method: 'POST' });
  if (result.success) return { ok: true };
  return { ok: false, message: result.message };
}

export async function openBillingPortal(): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const result = await apiFetch<{ url: string }>('/api/client/portal', { method: 'POST' });
  if (result.success) return { ok: true, url: result.data.url };
  return { ok: false, message: result.message };
}
