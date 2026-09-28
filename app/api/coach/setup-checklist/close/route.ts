import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { coaches } from '@/lib/commerce/schema';
import type { SetupChecklistCloseResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * Marks the "Get ready to sell" checklist as closed for this coach, for good — called on the
 * coach's Hide click, or by the app itself once all six steps are done. Set once and never
 * cleared again (mirrors `coaches.storefrontCompletedAt`'s own "first write wins" pattern), so
 * repeat calls are idempotent and always return the original close time.
 */
export async function POST() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const current = await db.query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, session.coachId) });
    if (!current) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

    const closedAt = current.setupChecklistClosedAt ?? new Date();
    if (!current.setupChecklistClosedAt) {
      await db
        .update(coaches)
        .set({ setupChecklistClosedAt: closedAt, updatedAt: new Date() })
        .where(eq(coaches.id, session.coachId));
    }

    return apiSuccess<SetupChecklistCloseResponse>({ setupChecklistClosedAt: closedAt.toISOString() }, 'Checklist closed.');
  } catch (err) {
    console.error('POST /api/coach/setup-checklist/close failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
