import { cookies } from 'next/headers';
import { requireCoachSession } from './require-coach';
import { createSessionToken } from './session';

jest.mock('next/headers');

function mockCookieValue(value: string | undefined) {
  (cookies as jest.Mock).mockResolvedValue({
    get: jest.fn().mockReturnValue(value === undefined ? undefined : { value }),
  });
}

const PAYLOAD = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

describe('requireCoachSession', () => {
  it('returns null when there is no session cookie', async () => {
    mockCookieValue(undefined);
    expect(await requireCoachSession()).toBeNull();
  });

  it('returns null for an invalid/expired token', async () => {
    mockCookieValue('not-a-valid-jwt');
    expect(await requireCoachSession()).toBeNull();
  });

  it('returns the decoded session for a valid token', async () => {
    const token = await createSessionToken(PAYLOAD);
    mockCookieValue(token);
    await expect(requireCoachSession()).resolves.toMatchObject(PAYLOAD);
  });
});
