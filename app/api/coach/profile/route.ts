import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/commerce/db';
import { coaches } from '@/lib/commerce/schema';
import type { CoachProfile } from '@/lib/commerce/types';
import { validateProfileInput } from '@/lib/commerce/profile';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

function toProfile(coach: {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  specialties: string[];
  location: string | null;
  coachingMode: CoachProfile['coachingMode'];
  timeZone: string;
  storefrontCompletedAt: Date | null;
}): CoachProfile {
  return {
    handle: coach.handle,
    displayName: coach.displayName,
    bio: coach.bio,
    avatarUrl: coach.avatarUrl,
    specialties: coach.specialties,
    location: coach.location,
    coachingMode: coach.coachingMode,
    timeZone: coach.timeZone,
    completed: coach.storefrontCompletedAt !== null,
  };
}

export async function GET() {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const coach = await getDb().query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, session.coachId) });
    if (!coach) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);
    return apiSuccess<CoachProfile>(toProfile(coach), 'Profile loaded.');
  } catch (err) {
    console.error('GET /api/coach/profile failed:', err);
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

  const validation = validateProfileInput(body);
  if ('errors' in validation) {
    return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
  }
  const input = validation.value;

  try {
    const db = getDb();

    const current = await db.query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, session.coachId) });
    if (!current) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

    const taken = await db.query.coaches.findFirst({
      where: (c, { eq: eqCol, and: andCol, ne: neCol }) => andCol(eqCol(c.handle, input.handle), neCol(c.id, session.coachId)),
    });
    if (taken) {
      return apiError('HANDLE_TAKEN', `${input.handle}.instar.co is taken. Try another.`, 409, {
        handle: `${input.handle}.instar.co is taken. Try another.`,
      });
    }

    const [updated] = await db
      .update(coaches)
      .set({
        handle: input.handle,
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        specialties: input.specialties,
        location: input.location,
        coachingMode: input.coachingMode,
        timeZone: input.timeZone,
        // Set once, on the first save, and never cleared again.
        storefrontCompletedAt: current.storefrontCompletedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(coaches.id, session.coachId))
      .returning();

    const response = apiSuccess<CoachProfile>(toProfile(updated), 'Storefront saved.');

    // The JWT bakes in handle/displayName (session.ts's SessionPayload) so server components can
    // render them without a DB round trip — reissue it whenever either changes, or those pages
    // would keep showing the old values until the coach logs in again.
    if (updated.handle !== session.handle || updated.displayName !== session.displayName) {
      const token = await createSessionToken({
        coachId: session.coachId,
        email: session.email,
        handle: updated.handle,
        displayName: updated.displayName,
      });
      setSessionCookie(response.cookies, token);
    }

    return response;
  } catch (err) {
    console.error('PATCH /api/coach/profile failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
