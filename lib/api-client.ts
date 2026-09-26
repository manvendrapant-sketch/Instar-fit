// The one fetch wrapper every frontend module calls the real /api/* routes through (auth, offers,
// payouts, storefront). Mirrors lib/api/response.ts's envelope — duplicated (rather than
// imported) because that file pulls in `next/server`, which client components can't bundle.

export type ApiResult<T> =
  | { success: true; message: string; data: T }
  | { success: false; code: string; message: string; fields?: Record<string, string> };

/**
 * Never throws: a network failure or a non-JSON response (a bare 500 from an infra problem, a
 * proxy error page, ...) becomes a normal ApiResult failure instead of an unhandled rejection. A
 * caller that let this throw would leave its own pending/loading state stuck forever with no
 * message shown — see lib/auth.ts's postJson, which had exactly this bug in production once
 * (2026-09-26: signup/login 500s left the button stuck disabled).
 */
export async function apiFetch<T>(
  path: string,
  init?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { success: false, code: 'NETWORK_ERROR', message: 'Something went wrong. Please try again.' };
  }
}
