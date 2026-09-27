import { getDb } from '@/lib/commerce/db';
import { clientLoginTokens } from '@/lib/commerce/schema';
import { generateLoginToken, hashLoginToken, LOGIN_TOKEN_TTL_MS } from '@/lib/auth/clientToken';
import { sendMagicLinkEmail } from '@/lib/email/send';
import type { ClientLoginRequest } from '@/lib/commerce/types';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Requests a fresh login link — never a standing reusable one. Always responds with the same
 * generic success message whether or not a matching client actually exists, so this can't be used
 * to enumerate which emails have bought from a given coach.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }
  const b = (body ?? {}) as Partial<ClientLoginRequest>;

  const handle = typeof b.handle === 'string' ? b.handle.trim().toLowerCase() : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const fields: Record<string, string> = {};
  if (!handle) fields.handle = 'handle is required.';
  if (!email || !EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
  if (Object.keys(fields).length > 0) {
    return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, fields);
  }

  const genericSuccess = () =>
    apiSuccess<null>(null, "If an account exists for that email, we've sent a login link.");

  try {
    const db = getDb();
    const coach = await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.handle, handle) });
    if (!coach) return genericSuccess();

    const client = await db.query.clients.findFirst({
      where: (c, { eq: eqCol, and: andCol }) => andCol(eqCol(c.coachId, coach.id), eqCol(c.email, email)),
    });
    if (!client) return genericSuccess();

    const rawToken = generateLoginToken();
    await db.insert(clientLoginTokens).values({
      clientId: client.id,
      tokenHash: hashLoginToken(rawToken),
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
    });

    const origin = new URL(req.url).origin;
    const loginUrl = new URL(`/api/client/login/verify?token=${rawToken}`, origin).toString();

    try {
      await sendMagicLinkEmail(client.email, loginUrl, coach.displayName);
    } catch (err) {
      // Don't let an email-provider hiccup reveal (via a different response) that the account
      // exists — log it server-side and still return the generic success message.
      console.error('POST /api/client/login/request: sendMagicLinkEmail failed:', err);
    }

    return genericSuccess();
  } catch (err) {
    console.error('POST /api/client/login/request failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
