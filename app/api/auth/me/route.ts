import { cookies } from 'next/headers';
import { getDb } from '@/lib/commerce/db';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export interface MeResponseData {
  coach: {
    id: string;
    email: string;
    handle: string;
    displayName: string;
  };
}

/** Lets the frontend check whether the visitor is currently signed in. */
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return apiError('SESSION_EXPIRED', 'Your session has expired. Please log in again.', 401);
  }

  const coach = await getDb().query.coaches.findFirst({ where: (c, { eq }) => eq(c.id, session.coachId) });
  if (!coach) {
    return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);
  }

  return apiSuccess<MeResponseData>(
    { coach: { id: coach.id, email: coach.email, handle: coach.handle, displayName: coach.displayName } },
    'Session is active.',
  );
}
