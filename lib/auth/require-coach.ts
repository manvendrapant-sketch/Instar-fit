import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from './session';

/**
 * The cookie-read + verify steps every authenticated Route Handler needs (originally inlined in
 * GET /api/auth/me; pulled out once the Commerce storefront routes needed the same three lines
 * repeated across nearly a dozen handlers). Returns null for a missing/invalid/expired session —
 * never throws — so callers just do `if (!session) return apiError('NOT_AUTHENTICATED', ...)`.
 */
export async function requireCoachSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
