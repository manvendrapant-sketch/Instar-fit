import { apiFetch } from './api-client';
import type { ClientMeResponse } from './commerce/types';

export type RequestLoginLinkResult = { ok: true; message: string } | { ok: false; message: string };

/** Always resolves ok:true on a well-formed request — the backend never reveals whether the email matched an account. */
export async function requestClientLoginLink(handle: string, email: string): Promise<RequestLoginLinkResult> {
  const result = await apiFetch<null>('/api/client/login/request', { method: 'POST', body: { handle, email } });
  if (result.success) return { ok: true, message: result.message };
  return { ok: false, message: result.message };
}

export async function clientLogout(): Promise<void> {
  await apiFetch('/api/client/logout', { method: 'POST' });
}

export type ClientMeResult = { ok: true; data: ClientMeResponse } | { ok: false; message: string };

export async function fetchClientMe(): Promise<ClientMeResult> {
  const result = await apiFetch<ClientMeResponse>('/api/client/me');
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, message: result.message };
}
