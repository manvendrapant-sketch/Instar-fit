import { getDb } from '@/lib/commerce/db';
import { connectedAccounts } from '@/lib/commerce/schema';
import { getStripe } from '@/lib/stripe/client';
import type { CreateAccountLinkResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * Creates the coach's Stripe Express account on first call, then always returns a fresh
 * onboarding Account Link — Stripe's account_onboarding links expire after a few minutes, so the
 * payouts screen calls this every time the coach clicks "Continue setup", not just once.
 */
export async function POST(req: Request) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — returnPath/refreshPath are optional.
  }
  const { returnPath, refreshPath } = (body ?? {}) as { returnPath?: unknown; refreshPath?: unknown };
  const origin = new URL(req.url).origin;
  const returnUrl = new URL(typeof returnPath === 'string' && returnPath ? returnPath : '/business', origin).toString();
  const refreshUrl = new URL(
    typeof refreshPath === 'string' && refreshPath ? refreshPath : '/business',
    origin,
  ).toString();

  try {
    const db = getDb();
    const coach = await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.id, session.coachId) });
    if (!coach) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

    let account = await db.query.connectedAccounts.findFirst({
      where: (a, { eq }) => eq(a.coachId, session.coachId),
    });

    const stripe = getStripe();

    if (!account) {
      const stripeAccount = await stripe.accounts.create({
        type: 'express',
        email: coach.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      [account] = await db
        .insert(connectedAccounts)
        .values({ coachId: session.coachId, stripeAccountId: stripeAccount.id })
        .returning();
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.stripeAccountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return apiSuccess<CreateAccountLinkResponse>({ url: accountLink.url }, 'Account link created.');
  } catch (err) {
    console.error('POST /api/coach/connect/account-link failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
