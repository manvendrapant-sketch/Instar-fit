import { getDb } from '@/lib/commerce/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { validateLoginInput } from '@/lib/auth/validation';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export interface LoginResponseData {
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

  const validation = validateLoginInput(body);
  if ('errors' in validation) {
    return apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, validation.errors);
  }
  const { email, password } = validation.value;

  const db = getDb();
  const coach = await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.email, email) });

  // Same message whether the email doesn't exist or the password is wrong — never reveal which.
  const invalidCredentials = () =>
    apiError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);

  if (!coach) return invalidCredentials();

  const passwordMatches = await verifyPassword(password, coach.passwordHash);
  if (!passwordMatches) return invalidCredentials();

  const token = await createSessionToken({
    coachId: coach.id,
    email: coach.email,
    handle: coach.handle,
    displayName: coach.displayName,
  });

  const response = apiSuccess<LoginResponseData>(
    { coach: { id: coach.id, email: coach.email, handle: coach.handle, displayName: coach.displayName } },
    'Logged in successfully.',
  );
  setSessionCookie(response.cookies, token);
  return response;
}
