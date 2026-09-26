import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, prices } from '@/lib/commerce/schema';
import type { CoachPublicProfile } from '@/lib/commerce/types';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** No auth — this is the public storefront a client sees. Only a published coach's page exists. */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  try {
    const db = getDb();
    const coach = await db.query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.handle, handle) });
    if (!coach || !coach.published) {
      return apiError('NOT_FOUND', 'This page is not available.', 404);
    }

    const rows = await db
      .select({
        id: offers.id,
        type: offers.type,
        name: offers.name,
        description: offers.description,
        currency: prices.currency,
        unitAmountCents: prices.unitAmountCents,
        interval: prices.interval,
        intervalCount: prices.intervalCount,
      })
      .from(offers)
      .innerJoin(prices, and(eq(prices.offerId, offers.id), eq(prices.active, true)))
      .where(and(eq(offers.coachId, coach.id), eq(offers.active, true)))
      .orderBy(asc(offers.position));

    const profile: CoachPublicProfile = {
      handle: coach.handle,
      displayName: coach.displayName,
      bio: coach.bio,
      avatarUrl: coach.avatarUrl,
      offers: rows.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.description,
        price: {
          currency: r.currency,
          unitAmountCents: r.unitAmountCents,
          interval: r.interval,
          intervalCount: r.intervalCount,
        },
      })),
    };

    return apiSuccess<CoachPublicProfile>(profile, 'Storefront loaded.');
  } catch (err) {
    console.error(`GET /api/coach/${handle} failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
