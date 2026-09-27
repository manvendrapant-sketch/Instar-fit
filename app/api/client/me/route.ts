import { getDb } from '@/lib/commerce/db';
import { requireClientSession } from '@/lib/auth/require-client';
import type { ClientMeResponse } from '@/lib/commerce/types';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireClientSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  try {
    const db = getDb();
    const client = await db.query.clients.findFirst({ where: (c, { eq }) => eq(c.id, session.clientId) });
    const coach = await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.id, session.coachId) });
    if (!client || !coach) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

    const data: ClientMeResponse = {
      client: { email: client.email, name: client.name },
      coach: { handle: coach.handle, displayName: coach.displayName },
    };
    return apiSuccess<ClientMeResponse>(data, 'Loaded.');
  } catch (err) {
    console.error('GET /api/client/me failed:', err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
