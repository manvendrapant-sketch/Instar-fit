import { cookies } from 'next/headers';
import { requireClientSession } from './require-client';
import { createClientSessionToken } from './clientSession';

jest.mock('next/headers');

function mockCookieValue(value: string | undefined) {
  (cookies as jest.Mock).mockResolvedValue({
    get: jest.fn().mockReturnValue(value === undefined ? undefined : { value }),
  });
}

const PAYLOAD = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

describe('requireClientSession', () => {
  it('returns null when there is no session cookie', async () => {
    mockCookieValue(undefined);
    expect(await requireClientSession()).toBeNull();
  });

  it('returns null for an invalid/expired token', async () => {
    mockCookieValue('not-a-valid-jwt');
    expect(await requireClientSession()).toBeNull();
  });

  it('returns the decoded session for a valid token', async () => {
    const token = await createClientSessionToken(PAYLOAD);
    mockCookieValue(token);
    await expect(requireClientSession()).resolves.toMatchObject(PAYLOAD);
  });
});
