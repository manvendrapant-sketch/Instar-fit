import { cookies } from 'next/headers';
import { GET } from '@/app/api/auth/me/route';
import { getDb } from '@/lib/commerce/db';
import { createSessionToken } from '@/lib/auth/session';

jest.mock('next/headers');
jest.mock('@/lib/commerce/db');

function mockCookieValue(value: string | undefined) {
  (cookies as jest.Mock).mockResolvedValue({
    get: jest.fn().mockReturnValue(value === undefined ? undefined : { value }),
  });
}

const PAYLOAD = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

describe('GET /api/auth/me', () => {
  it('returns 401 NOT_AUTHENTICATED when there is no session cookie', async () => {
    mockCookieValue(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ success: false, code: 'NOT_AUTHENTICATED' });
  });

  it('returns 401 SESSION_EXPIRED for an invalid/expired token', async () => {
    mockCookieValue('not-a-valid-jwt');
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ success: false, code: 'SESSION_EXPIRED' });
  });

  it('returns 401 NOT_AUTHENTICATED if the token is valid but the coach no longer exists', async () => {
    const token = await createSessionToken(PAYLOAD);
    mockCookieValue(token);
    (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst: jest.fn().mockResolvedValue(undefined) } } });

    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ success: false, code: 'NOT_AUTHENTICATED' });
  });

  it('returns the current coach for a valid session', async () => {
    const token = await createSessionToken(PAYLOAD);
    mockCookieValue(token);
    const coach = { id: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
    (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst: jest.fn().mockResolvedValue(coach) } } });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: 'Session is active.',
      data: { coach },
    });
  });
});
