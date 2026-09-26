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
      .select({ offer: offers, price: prices })
      .from(offers)
      .innerJoin(prices, and(eq(prices.offerId, offers.id), eq(prices.active, true)))
      .where(and(eq(offers.coachId, coach.id), eq(offers.active, true)))
      .orderBy(asc(offers.position));

    const profile: CoachPublicProfile = {
      handle: coach.handle,
      displayName: coach.displayName,
      bio: coach.bio,
      avatarUrl: coach.avatarUrl,
      specialties: coach.specialties,
      location: coach.location,
      coachingMode: coach.coachingMode,
      offers: rows.map((r) => ({
        id: r.offer.id,
        type: r.offer.type,
        name: r.offer.name,
        description: r.offer.description,
        includes: r.offer.includes,
        lengthWeeks: r.offer.lengthWeeks,
        sessionMinutes: r.offer.sessionMinutes,
        price: {
          currency: r.price.currency,
          unitAmountCents: r.price.unitAmountCents,
          interval: r.price.interval,
          intervalCount: r.price.intervalCount,
        },
      })),
    };

    return apiSuccess<CoachPublicProfile>(profile, 'Storefront loaded.');
  } catch (err) {
    console.error(`GET /api/coach/${handle} failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
