import { POST } from '@/app/api/auth/signup/route';
import { getDb } from '@/lib/commerce/db';
import { generateUniqueHandle } from '@/lib/auth/handle';
import { hashPassword } from '@/lib/auth/password';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/handle');
jest.mock('@/lib/auth/password');

const VALID_BODY = { email: 'maya@studio.com', password: 'supersecret1', displayName: 'Maya Reyes' };

function postRequest(body: unknown) {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockDb({
  existingCoach,
  insertedCoach,
  insertThrows,
}: {
  existingCoach?: object;
  insertedCoach?: object;
  insertThrows?: boolean;
}) {
  const returning = insertThrows
    ? jest.fn().mockRejectedValue(new Error('unique_violation'))
    : jest.fn().mockResolvedValue([insertedCoach]);
  (getDb as jest.Mock).mockReturnValue({
    query: { coaches: { findFirst: jest.fn().mockResolvedValue(existingCoach) } },
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning }) }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (generateUniqueHandle as jest.Mock).mockResolvedValue('maya-reyes');
  (hashPassword as jest.Mock).mockResolvedValue('hashed-password');
});

describe('POST /api/auth/signup', () => {
  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await POST(
      new Request('http://localhost/api/auth/signup', { method: 'POST', body: 'not json' }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ success: false, code: 'INVALID_JSON' });
  });

  it('returns 422 VALIDATION_ERROR with field messages for a bad body', async () => {
    mockDb({});
    const res = await POST(postRequest({ email: '', password: '', displayName: '' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.fields).toEqual({
      email: 'Email is required.',
      password: 'Password is required.',
      displayName: 'Name is required.',
    });
  });

  it('returns 409 EMAIL_TAKEN when the email is already registered', async () => {
    mockDb({ existingCoach: { id: 'existing', email: 'maya@studio.com' } });
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('EMAIL_TAKEN');
    expect(body.fields).toEqual({ email: 'This email is already registered.' });
  });

  it('creates the account, sets a real session cookie, and returns 201 on success', async () => {
    const insertedCoach = {
      id: 'coach-1',
      email: 'maya@studio.com',
      handle: 'maya-reyes',
      displayName: 'Maya Reyes',
    };
    mockDb({ existingCoach: undefined, insertedCoach });

    const res = await POST(postRequest(VALID_BODY));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      message: 'Account created successfully.',
      data: { coach: insertedCoach },
    });

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    const session = await verifySessionToken(cookie!.value);
    expect(session).toMatchObject({
      coachId: 'coach-1',
      email: 'maya@studio.com',
      handle: 'maya-reyes',
      displayName: 'Maya Reyes',
    });
  });

  it('hashes the password and derives the handle before inserting (never stores the plaintext)', async () => {
    const insertedCoach = { id: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
    const values = jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([insertedCoach]) });
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue(undefined) } },
      insert: jest.fn().mockReturnValue({ values }),
    });

    await POST(postRequest(VALID_BODY));

    expect(hashPassword).toHaveBeenCalledWith('supersecret1');
    expect(generateUniqueHandle).toHaveBeenCalledWith('Maya Reyes');
    expect(values).toHaveBeenCalledWith({
      email: 'maya@studio.com',
      passwordHash: 'hashed-password',
      displayName: 'Maya Reyes',
      handle: 'maya-reyes',
    });
  });

  it('returns 409 EMAIL_OR_HANDLE_TAKEN if the insert itself fails (race with another signup)', async () => {
    mockDb({ insertThrows: true });
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ success: false, code: 'EMAIL_OR_HANDLE_TAKEN' });
  });
});
