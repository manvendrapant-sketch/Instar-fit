import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { NextResponse } from 'next/server';

type ResponseCookies = NextResponse['cookies'];

export const CLIENT_SESSION_COOKIE_NAME = 'instar_client_session';
// Clients come back to check on their subscription occasionally, not daily like a coach — longer
// lived than the coach session, but the login link itself is still short-lived and single-use.
const CLIENT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface ClientSessionPayload extends JWTPayload {
  clientId: string;
  coachId: string;
  coachHandle: string;
  email: string;
}

/**
 * A separate secret from AUTH_JWT_SECRET (coach sessions) on purpose — coaches and clients are
 * different trust domains (a coach can see every client's data across their whole business; a
 * client can only ever see their own one relationship with one coach), so a bug that ever confused
 * the two token types shouldn't be possible just because they happen to share a signing key.
 */
function getClientSessionSecret(): Uint8Array {
  const secret = process.env.CLIENT_SESSION_JWT_SECRET;
  if (!secret) {
    throw new Error('CLIENT_SESSION_JWT_SECRET is not set. Add it in .env.local / the Vercel project env vars.');
  }
  return new TextEncoder().encode(secret);
}

export async function createClientSessionToken(payload: Omit<ClientSessionPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${CLIENT_SESSION_TTL_SECONDS}s`)
    .sign(getClientSessionSecret());
}

/** Returns the decoded session, or null for a missing/invalid/expired token — never throws. */
export async function verifyClientSessionToken(token: string): Promise<ClientSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getClientSessionSecret());
    return payload as ClientSessionPayload;
  } catch {
    return null;
  }
}

export function setClientSessionCookie(cookies: ResponseCookies, token: string) {
  cookies.set(CLIENT_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CLIENT_SESSION_TTL_SECONDS,
  });
}

export function clearClientSessionCookie(cookies: ResponseCookies) {
  cookies.set(CLIENT_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
