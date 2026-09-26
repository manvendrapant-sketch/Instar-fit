import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { offers } from '@/lib/commerce/schema';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const orderedIds = (body as { orderedIds?: unknown } | null)?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 || !orderedIds.every((id) => typeof id === 'string')) {
    return apiError('VALIDATION_ERROR', 'orderedIds must be a non-empty array of offer ids.', 422, {
      orderedIds: 'orderedIds must be a non-empty array of offer ids.',
    });
  }

  try {
    const db = getDb();
    const existing = await db
      .select({ id: offers.id })
      .from(offers)
      .where(eq(offers.coachId, session.coachId));

    // orderedIds must be exactly a permutation of this coach's own offers — not a subset (that
    // would silently orphan the missing ones at whatever position they last had) and not anyone
    // else's id (a coach could otherwise probe/tamper with another coach's offer ids).
    const existingIds = new Set(existing.map((o) => o.id));
    const providedIds = new Set(orderedIds as string[]);
    const isExactMatch = existingIds.size === providedIds.size && [...existingIds].every((id) => providedIds.has(id));
    if (!isExactMatch) {
      return apiError('VALIDATION_ERROR', 'orderedIds must list exactly this account’s own offers.', 422);
    }

    await db.transaction(async (tx) => {
      for (const [index, id] of (orderedIds as string[]).entries()) {
        await tx.update(offers).set({ position: index }).where(eq(offers.id, id));
      }
    });

    return apiSuccess<{ orderedIds: string[] }>({ orderedIds: orderedIds as string[] }, 'Offers reordered.');
  } catch (err) {
    console.error('PATCH /api/offers/reorder failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
