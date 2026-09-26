import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, prices } from '@/lib/commerce/schema';
import type { CoachOfferSummary } from '@/lib/commerce/types';
import { createStripeReplacementPrice, validateUpdateOfferInput } from '@/lib/commerce/offers';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export interface UpdateOfferResponseData {
  offer: CoachOfferSummary;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  try {
    const db = getDb();

    // Scoped to this coach's own id so one coach can never read/edit another's offer by guessing
    // its uuid — a mismatch reads identically to "doesn't exist".
    const offer = await db.query.offers.findFirst({
      where: (o, { eq: eqCol, and: andCol }) => andCol(eqCol(o.id, id), eqCol(o.coachId, session.coachId)),
    });
    if (!offer) return apiError('NOT_FOUND', 'Offer not found.', 404);

    const validation = validateUpdateOfferInput(body, offer.type);
    if ('errors' in validation) {
      return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
    }
    const updates = validation.value;

    if (updates.name !== undefined || updates.description !== undefined || updates.active !== undefined) {
      await db
        .update(offers)
        .set({
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
          ...(updates.active !== undefined ? { active: updates.active } : {}),
          updatedAt: new Date(),
        })
        .where(eq(offers.id, offer.id));
    }

    let activePrice = await db.query.prices.findFirst({
      where: (p, { eq: eqCol, and: andCol }) => andCol(eqCol(p.offerId, offer.id), eqCol(p.active, true)),
    });

    if (updates.price) {
      const { stripePriceId } = offer.stripeProductId
        ? await createStripeReplacementPrice(offer.stripeProductId, updates.price)
        : { stripePriceId: null };

      if (activePrice) {
        await db.update(prices).set({ active: false }).where(eq(prices.id, activePrice.id));
      }

      [activePrice] = await db
        .insert(prices)
        .values({
          offerId: offer.id,
          stripePriceId,
          currency: updates.price.currency,
          unitAmountCents: updates.price.unitAmountCents,
          interval: updates.price.interval,
          intervalCount: updates.price.intervalCount,
        })
        .returning();
    }

    if (!activePrice) {
      // Shouldn't happen — every offer gets an active price at creation — but a missing one would
      // otherwise surface as a confusing null-field response rather than a clear error.
      console.error(`PATCH /api/offers/${id}: offer has no active price row`);
      return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
    }

    const updatedOffer = await db.query.offers.findFirst({ where: (o, { eq: eqCol }) => eqCol(o.id, offer.id) });
    if (!updatedOffer) return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);

    const summary: CoachOfferSummary = {
      id: updatedOffer.id,
      type: updatedOffer.type,
      name: updatedOffer.name,
      description: updatedOffer.description,
      active: updatedOffer.active,
      position: updatedOffer.position,
      price: {
        currency: activePrice.currency,
        unitAmountCents: activePrice.unitAmountCents,
        interval: activePrice.interval,
        intervalCount: activePrice.intervalCount,
      },
    };

    return apiSuccess<UpdateOfferResponseData>({ offer: summary }, 'Offer updated.');
  } catch (err) {
    console.error(`PATCH /api/offers/${id} failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
