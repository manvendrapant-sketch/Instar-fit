import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { requireClientSession } from '@/lib/auth/require-client';
import type { ClientPortalResponse } from '@/lib/commerce/types';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * Card update, per the workplan's "Stripe Customer Portal session or our own update-card
 * endpoint" — the Portal is the one Manvendra's own workplan calls out by name, and it needs no
 * new UI here (Stripe hosts it). Requires a Customer Portal Configuration to exist in the Stripe
 * Dashboard (Settings -> Billing -> Customer portal) — a Dashboard-only step, flagged in CLAUDE.md
 * alongside Smart Retries, not something this route can do for itself.
 */
export async function POST(req: Request) {
  const session = await requireClientSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const client = await db.query.clients.findFirst({ where: (c, { eq }) => eq(c.id, session.clientId) });
    if (!client?.stripeCustomerId) {
      return apiError('NO_STRIPE_CUSTOMER', 'No billing account found yet — this needs at least one completed checkout.', 422);
    }

    const returnUrl = new URL(`/${session.coachHandle}/account`, new URL(req.url).origin).toString();
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: returnUrl,
    });

    return apiSuccess<ClientPortalResponse>({ url: portalSession.url }, 'Redirecting to Stripe.');
  } catch (err) {
    console.error('POST /api/client/portal failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
