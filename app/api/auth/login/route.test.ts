import { POST } from '@/app/api/auth/login/route';
import { getDb } from '@/lib/commerce/db';
import { verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/password');

const COACH = {
  id: 'coach-1',
  email: 'maya@studio.com',
  passwordHash: 'hashed-password',
  handle: 'maya-reyes',
  displayName: 'Maya Reyes',
};

function postRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockDb(coach: object | undefined) {
  (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst: jest.fn().mockResolvedValue(coach) } } });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ success: false, code: 'INVALID_JSON' });
  });

  it('returns 422 VALIDATION_ERROR for a missing email/password', async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      fields: { email: 'Email is required.', password: 'Password is required.' },
    });
  });

  it('returns 401 INVALID_CREDENTIALS with no field errors when the email does not exist', async () => {
    mockDb(undefined);
    const res = await POST(postRequest({ email: 'nobody@studio.com', password: 'whatever12' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ success: false, code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' });
  });

  it('returns 401 INVALID_CREDENTIALS (same message) when the password is wrong', async () => {
    mockDb(COACH);
    (verifyPassword as jest.Mock).mockResolvedValue(false);
    const res = await POST(postRequest({ email: COACH.email, password: 'wrong-password' }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email or password.',
    });
  });

  it('never calls verifyPassword when no account exists for the email (nothing to compare against)', async () => {
    mockDb(undefined);
    await POST(postRequest({ email: 'nobody@studio.com', password: 'whatever12' }));
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('logs in successfully, setting a real session cookie for the found coach', async () => {
    mockDb(COACH);
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const res = await POST(postRequest({ email: COACH.email, password: 'supersecret1' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: 'Logged in successfully.',
      data: { coach: { id: COACH.id, email: COACH.email, handle: COACH.handle, displayName: COACH.displayName } },
    });

    expect(verifyPassword).toHaveBeenCalledWith('supersecret1', COACH.passwordHash);

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    const session = await verifySessionToken(cookie!.value);
    expect(session).toMatchObject({ coachId: COACH.id, email: COACH.email, handle: COACH.handle });
  });
});
