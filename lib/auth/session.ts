import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { NextResponse } from 'next/server';

// Next.js doesn't publicly export the `ResponseCookies` type `NextResponse.cookies` returns, so
// this is derived from `NextResponse` itself rather than reaching into `next/dist` internals.
type ResponseCookies = NextResponse['cookies'];

export const SESSION_COOKIE_NAME = 'instar_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload extends JWTPayload {
  coachId: string;
  email: string;
  handle: string;
  // Not sensitive, and letting server components read it straight off the token (via
  // verifySessionToken) saves them a DB round trip just to render a name/initials in the chrome.
  displayName: string;
}

/**
 * Lazy on purpose — see the comment in lib/stripe/client.ts. Reading `process.env` inside a
 * function that only ever runs at request time (never at module-eval/build time) keeps a missing
 * AUTH_JWT_SECRET from failing `next build`.
 */
function getSessionSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is not set. Add it in .env.local / the Vercel project env vars.');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: Omit<SessionPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

/** Returns the decoded session, or null for a missing/invalid/expired token — never throws. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Sets the session cookie on an outgoing response (signup/login) — Route Handlers only. */
export function setSessionCookie(cookies: ResponseCookies, token: string) {
  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clears the session cookie (logout). */
export function clearSessionCookie(cookies: ResponseCookies) {
  cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
