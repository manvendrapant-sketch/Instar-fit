import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { coaches, offers } from '@/lib/commerce/schema';
import { deriveConnectStatus } from '@/lib/commerce/connect';
import type { StorefrontStatus } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

async function loadStatus(coachId: string): Promise<StorefrontStatus | null> {
  const db = getDb();
  const coach = await db.query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, coachId) });
  if (!coach) return null;

  const [account, activeOffers] = await Promise.all([
    db.query.connectedAccounts.findFirst({ where: (a, { eq: eqCol }) => eqCol(a.coachId, coachId) }),
    db.select({ id: offers.id }).from(offers).where(and(eq(offers.coachId, coachId), eq(offers.active, true))),
  ]);

  const connectStatus = deriveConnectStatus(account);
  return {
    handle: coach.handle,
    published: coach.published,
    canPublish: connectStatus === 'ready' && activeOffers.length > 0,
    connectStatus,
    publicUrl: `/${coach.handle}`,
  };
}

export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const status = await loadStatus(session.coachId);
    if (!status) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);
    return apiSuccess<StorefrontStatus>(status, 'Storefront status loaded.');
  } catch (err) {
    console.error('GET /api/storefront failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}

export async function PATCH(req: Request) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const published = (body as { published?: unknown } | null)?.published;
  if (typeof published !== 'boolean') {
    return apiError('VALIDATION_ERROR', 'published must be true or false.', 422, {
      published: 'published must be true or false.',
    });
  }

  try {
    const status = await loadStatus(session.coachId);
    if (!status) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

    // Unpublishing (hiding the storefront) is always allowed; publishing requires the readiness
    // gate so a coach can never go live with no way to get paid or nothing to sell.
    if (published && !status.canPublish) {
      return apiError(
        'NOT_READY',
        'Finish setting up payouts and add at least one offer before publishing.',
        422,
      );
    }

    const db = getDb();
    await db.update(coaches).set({ published, updatedAt: new Date() }).where(eq(coaches.id, session.coachId));

    return apiSuccess<StorefrontStatus>(
      { ...status, published },
      published ? "You're live." : 'Storefront hidden.',
    );
  } catch (err) {
    console.error('PATCH /api/storefront failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
