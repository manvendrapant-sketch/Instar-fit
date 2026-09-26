import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers, prices } from '@/lib/commerce/schema';
import type { CoachOfferSummary } from '@/lib/commerce/types';
import { createStripeProductAndPrice, validateCreateOfferInput } from '@/lib/commerce/offers';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export interface ListOffersResponseData {
  offers: CoachOfferSummary[];
}

/** The offer builder's list — includes inactive offers and management fields the public profile never shows. */
export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: offers.id,
        type: offers.type,
        name: offers.name,
        description: offers.description,
        active: offers.active,
        position: offers.position,
        currency: prices.currency,
        unitAmountCents: prices.unitAmountCents,
        interval: prices.interval,
        intervalCount: prices.intervalCount,
      })
      .from(offers)
      // Exactly one active price per offer at a time (editing a price retires the old row) — the
      // active filter here is what keeps that a guarantee rather than an assumption.
      .innerJoin(prices, and(eq(prices.offerId, offers.id), eq(prices.active, true)))
      .where(eq(offers.coachId, session.coachId))
      .orderBy(asc(offers.position));

    const summaries: CoachOfferSummary[] = rows.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.description,
        active: r.active,
        position: r.position,
        price: {
          currency: r.currency,
          unitAmountCents: r.unitAmountCents,
          interval: r.interval,
          intervalCount: r.intervalCount,
        },
      }));

    return apiSuccess<ListOffersResponseData>({ offers: summaries }, 'Offers loaded.');
  } catch (err) {
    console.error('GET /api/offers failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}

export interface CreateOfferResponseData {
  offer: CoachOfferSummary;
}

export async function POST(req: Request) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const validation = validateCreateOfferInput(body);
  if ('errors' in validation) {
    return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
  }
  const input = validation.value;

  try {
    const db = getDb();

    // Stripe calls happen before the DB write since they can't be rolled back by a DB transaction
    // anyway; a DB failure after this leaves an orphan test-mode Stripe product, which is an
    // acceptable cost in test mode (see CLAUDE.md "Stripe test mode... until Sprint 6").
    const { stripeProductId, stripePriceId } = await createStripeProductAndPrice(input);

    const [last] = await db
      .select({ position: offers.position })
      .from(offers)
      .where(eq(offers.coachId, session.coachId))
      .orderBy(desc(offers.position))
      .limit(1);
    const position = last ? last.position + 1 : 0;

    const [offer] = await db
      .insert(offers)
      .values({
        coachId: session.coachId,
        type: input.type,
        name: input.name,
        description: input.description,
        stripeProductId,
        position,
      })
      .returning();

    const [price] = await db
      .insert(prices)
      .values({
        offerId: offer.id,
        stripePriceId,
        currency: input.price.currency,
        unitAmountCents: input.price.unitAmountCents,
        interval: input.price.interval,
        intervalCount: input.price.intervalCount,
      })
      .returning();

    const summary: CoachOfferSummary = {
      id: offer.id,
      type: offer.type,
      name: offer.name,
      description: offer.description,
      active: offer.active,
      position: offer.position,
      price: {
        currency: price.currency,
        unitAmountCents: price.unitAmountCents,
        interval: price.interval,
        intervalCount: price.intervalCount,
      },
    };

    return apiSuccess<CreateOfferResponseData>({ offer: summary }, 'Offer created.', 201);
  } catch (err) {
    console.error('POST /api/offers failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
