import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { clientLoginTokens } from '@/lib/commerce/schema';
import { hashLoginToken } from '@/lib/auth/clientToken';
import { createClientSessionToken, setClientSessionCookie } from '@/lib/auth/clientSession';

export const runtime = 'nodejs';

function invalidLinkResponse() {
  return new NextResponse(
    '<!doctype html><html><body style="font-family: sans-serif; padding: 40px; text-align: center;">' +
      '<h1>This link is invalid or has expired</h1>' +
      '<p>Login links can only be used once and expire after 15 minutes. Go back to your coach’s ' +
      'storefront and request a fresh one.</p>' +
      '</body></html>',
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * Where a client's emailed login link points. A GET (not POST) on purpose — it's meant to be
 * opened directly from an email client, not called from our own frontend. Marks the token used
 * atomically (the `isNull(usedAt)` guard in the UPDATE) so double-clicking the same link, or a
 * retried delivery, can't log in twice from one token.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return invalidLinkResponse();

  try {
    const db = getDb();
    const tokenHash = hashLoginToken(token);

    const existing = await db.query.clientLoginTokens.findFirst({
      where: (t, { eq: eqCol }) => eqCol(t.tokenHash, tokenHash),
    });
    if (!existing) return invalidLinkResponse();

    const client = await db.query.clients.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, existing.clientId) });
    const coach = client
      ? await db.query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, client.coachId) })
      : undefined;

    const expired = existing.expiresAt.getTime() < Date.now();
    if (expired || existing.usedAt || !client || !coach) {
      if (coach) return NextResponse.redirect(new URL(`/${coach.handle}/account/login?error=expired`, req.url));
      return invalidLinkResponse();
    }

    const consumed = await db
      .update(clientLoginTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(clientLoginTokens.id, existing.id), isNull(clientLoginTokens.usedAt)))
      .returning({ id: clientLoginTokens.id });
    if (consumed.length === 0) {
      // Lost a race against another request for the same token (e.g. an email client's link
      // previewer fetching it first) — treat exactly like already-used.
      return NextResponse.redirect(new URL(`/${coach.handle}/account/login?error=expired`, req.url));
    }

    const sessionToken = await createClientSessionToken({
      clientId: client.id,
      coachId: coach.id,
      coachHandle: coach.handle,
      email: client.email,
    });

    const response = NextResponse.redirect(new URL(`/${coach.handle}/account`, req.url));
    setClientSessionCookie(response.cookies, sessionToken);
    return response;
  } catch (err) {
    console.error('GET /api/client/login/verify failed:', err);
    return invalidLinkResponse();
  }
}
