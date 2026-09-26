import { getDb } from '@/lib/commerce/db';
import { coaches } from '@/lib/commerce/schema';
import { generateUniqueHandle } from '@/lib/auth/handle';
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
  const { email, password, displayName } = validation.value;

  const db = getDb();

  const existing = await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.email, email) });
  if (existing) {
    return apiError(
      'EMAIL_TAKEN',
      'An account with this email already exists. Try logging in instead.',
      409,
      { email: 'This email is already registered.' },
    );
  }

  const [passwordHash, handle] = await Promise.all([hashPassword(password), generateUniqueHandle(displayName)]);

  let coach;
  try {
    [coach] = await db
      .insert(coaches)
      .values({ email, passwordHash, displayName, handle })
      .returning();
  } catch {
    // Guards the race between the pre-checks above and the insert (two signups for the same
    // email/handle landing at once) — the unique indexes are the real source of truth.
    return apiError('EMAIL_OR_HANDLE_TAKEN', "That email was just taken, or the account couldn't be created. Please try again.", 409);
  }

  const token = await createSessionToken({
    coachId: coach.id,
    email: coach.email,
    handle: coach.handle,
    displayName: coach.displayName,
  });

  const response = apiSuccess<SignupResponseData>(
    { coach: { id: coach.id, email: coach.email, handle: coach.handle, displayName: coach.displayName } },
    'Account created successfully.',
    201,
  );
  setSessionCookie(response.cookies, token);
  return response;
}
