import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, prices } from '@/lib/commerce/schema';
import type { CoachOfferSummary } from '@/lib/commerce/types';
import { createStripeReplacementPrice, toCoachOfferSummary, validateUpdateOfferInput } from '@/lib/commerce/offers';
import { getStripe } from '@/lib/stripe/client';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export interface UpdateOfferResponseData {
  offer: CoachOfferSummary;
}

async function findOwnOffer(coachId: string, id: string) {
  const db = getDb();
  // Scoped to this coach's own id so one coach can never read/edit another's offer by guessing
  // its uuid — a mismatch reads identically to "doesn't exist".
  return db.query.offers.findFirst({
    where: (o, { eq: eqCol, and: andCol }) => andCol(eqCol(o.id, id), eqCol(o.coachId, coachId)),
  });
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

    const offer = await findOwnOffer(session.coachId, id);
    if (!offer) return apiError('NOT_FOUND', 'Offer not found.', 404);

    const validation = validateUpdateOfferInput(body, offer.type);
    if ('errors' in validation) {
      return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
    }
    const updates = validation.value;

    const fieldUpdates = {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.active !== undefined ? { active: updates.active } : {}),
      ...(updates.includes !== undefined ? { includes: updates.includes } : {}),
      ...(updates.lengthWeeks !== undefined ? { lengthWeeks: updates.lengthWeeks } : {}),
      ...(updates.sessionMinutes !== undefined ? { sessionMinutes: updates.sessionMinutes } : {}),
    };
    if (Object.keys(fieldUpdates).length > 0) {
      await db.update(offers).set({ ...fieldUpdates, updatedAt: new Date() }).where(eq(offers.id, offer.id));
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

    return apiSuccess<UpdateOfferResponseData>({ offer: toCoachOfferSummary(updatedOffer, activePrice) }, 'Offer updated.');
  } catch (err) {
    console.error(`PATCH /api/offers/${id} failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}

/** Postgres foreign_key_violation is SQLSTATE 23503 — postgres-js surfaces it as `err.code`. */
function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === '23503';
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  try {
    const offer = await findOwnOffer(session.coachId, id);
    if (!offer) return apiError('NOT_FOUND', 'Offer not found.', 404);

    const db = getDb();

    // Once Sprint 3's checkout shipped, both `subscriptions.offerId` and `payments.offerId` can
    // reference this offer — a hard delete used to be safe (this comment used to say so, back
    // when Sprint 1 had no checkout at all), but neither FK has an `onDelete` rule, so Postgres
    // now rejects the delete outright once a real client has ever bought this offer. Check first
    // and return a clear, actionable error instead of letting that surface as a bare 500 —
    // deactivating (`active: false`, already how the offer builder hides an offer without
    // deleting it) is the right move for an offer with real history, not deleting it.
    const [hasSubscription, hasPayment] = await Promise.all([
      db.query.subscriptions.findFirst({ where: (s, { eq: eqCol }) => eqCol(s.offerId, offer.id) }),
      db.query.payments.findFirst({ where: (p, { eq: eqCol }) => eqCol(p.offerId, offer.id) }),
    ]);
    if (hasSubscription || hasPayment) {
      return apiError(
        'OFFER_IN_USE',
        'This offer has clients or payments tied to it and can’t be deleted. Turn it off instead.',
        409,
      );
    }

    // Deletes the offer row; its prices cascade (prices.offerId has onDelete: 'cascade').
    await db.delete(offers).where(eq(offers.id, offer.id));

    // Best-effort Stripe hygiene — archiving the product isn't required for correctness (nothing
    // reads a deleted offer's Stripe ids again), so a failure here shouldn't fail the delete.
    if (offer.stripeProductId) {
      try {
        await getStripe().products.update(offer.stripeProductId, { active: false });
      } catch (err) {
        console.error(`DELETE /api/offers/${id}: failed to archive Stripe product:`, err);
      }
    }

    return apiSuccess<{ id: string }>({ id: offer.id }, 'Offer deleted.');
  } catch (err) {
    console.error(`DELETE /api/offers/${id} failed:`, err);
    // Belt-and-suspenders for the check above: if some other reference this route doesn't know
    // about ever blocks the delete, still report it as an actionable conflict, not a generic 500.
    if (isForeignKeyViolation(err)) {
      return apiError('OFFER_IN_USE', 'This offer has clients or payments tied to it and can’t be deleted. Turn it off instead.', 409);
    }
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
