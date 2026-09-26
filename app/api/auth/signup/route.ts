import { getDb } from '@/lib/commerce/db';
import { coaches } from '@/lib/commerce/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { validateSignupInput } from '@/lib/auth/validation';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export interface SignupResponseData {
  coach: {
    id: string;
    email: string;
    handle: string;
    displayName: string;
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const validation = validateSignupInput(body);
  if ('errors' in validation) {
    return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
  }
  const { email, password, displayName, handle } = validation.value;

  const db = getDb();

  const existing = await db.query.coaches.findFirst({
    where: (c, { or, eq }) => or(eq(c.email, email), eq(c.handle, handle)),
  });
  if (existing) {
    if (existing.email === email) {
      return apiError(
        'EMAIL_TAKEN',
        'An account with this email already exists. Try logging in instead.',
        409,
        { email: 'This email is already registered.' },
      );
    }
    return apiError('HANDLE_TAKEN', 'That handle is already taken. Please choose another.', 409, {
      handle: 'This handle is already taken.',
    });
  }

  const passwordHash = await hashPassword(password);

  let coach;
  try {
    [coach] = await db
      .insert(coaches)
      .values({ email, passwordHash, displayName, handle })
      .returning();
  } catch {
    // Guards the race between the pre-check above and the insert (two signups for the same
    // email/handle landing at once) — the unique indexes are the real source of truth.
    return apiError('EMAIL_OR_HANDLE_TAKEN', 'That email or handle was just taken. Please try again.', 409);
  }

  const token = await createSessionToken({ coachId: coach.id, email: coach.email, handle: coach.handle });

  const response = apiSuccess<SignupResponseData>(
    { coach: { id: coach.id, email: coach.email, handle: coach.handle, displayName: coach.displayName } },
    'Account created successfully.',
    201,
  );
  setSessionCookie(response.cookies, token);
  return response;
}
