import 'server-only';
import { cookies } from 'next/headers';
import { CLIENT_SESSION_COOKIE_NAME, verifyClientSessionToken, type ClientSessionPayload } from './clientSession';

/** Mirrors requireCoachSession — never throws, returns null for no/invalid/expired session. */
export async function requireClientSession(): Promise<ClientSessionPayload | null> {
  const token = (await cookies()).get(CLIENT_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyClientSessionToken(token);
}
