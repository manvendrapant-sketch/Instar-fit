import 'server-only';
import { randomBytes, createHash } from 'crypto';

/** Shared by the login-request route and the Sprint-4 dunning nudge — both mint the same kind of
 * single-use, short-lived token via clientLoginTokens. */
export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;

/** A random, URL-safe login token. Only ever exists in the emailed link and briefly in memory. */
export function generateLoginToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What actually gets stored — a leak of `client_login_tokens` alone can't be used to log in. */
export function hashLoginToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
