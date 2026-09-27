import { GET } from './route';
import { getDb } from '@/lib/commerce/db';
import { CLIENT_SESSION_COOKIE_NAME, verifyClientSessionToken } from '@/lib/auth/clientSession';

jest.mock('@/lib/commerce/db');

function req(token: string | null) {
  const url = token ? `http://localhost/api/client/login/verify?token=${token}` : 'http://localhost/api/client/login/verify';
  return new Request(url);
}

const CLIENT = { id: 'client-1', coachId: 'coach-1', email: 'client@example.com' };
const COACH = { id: 'coach-1', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function mockDb(opts: { tokenRow?: unknown; client?: unknown; coach?: unknown; updateReturning?: unknown[] }) {
  const tokenFindFirst = jest.fn().mockResolvedValue(opts.tokenRow);
  const clientFindFirst = jest.fn().mockResolvedValue(opts.client);
  const coachFindFirst = jest.fn().mockResolvedValue(opts.coach);
  const updateReturning = jest.fn().mockResolvedValue(opts.updateReturning ?? []);
  const updateWhere = jest.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });
  (getDb as jest.Mock).mockReturnValue({
    query: { clientLoginTokens: { findFirst: tokenFindFirst }, clients: { findFirst: clientFindFirst }, coaches: { findFirst: coachFindFirst } },
    update,
  });
  return { updateReturning };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/client/login/verify', () => {
  it('returns an invalid-link page when no token is given', async () => {
    const res = await GET(req(null));
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toMatch(/invalid or has expired/i);
  });

  it('returns an invalid-link page when the token does not exist', async () => {
    mockDb({ tokenRow: undefined });
    const res = await GET(req('unknown-token'));
    expect(res.status).toBe(400);
  });

  it('redirects to the coach login page with error=expired when the token has expired', async () => {
    mockDb({
      tokenRow: { id: 'tok-1', clientId: 'client-1', expiresAt: new Date(Date.now() - 1000), usedAt: null },
      client: CLIENT,
      coach: COACH,
    });
    const res = await GET(req('some-token'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/maya-reyes/account/login?error=expired');
  });

  it('redirects to error=expired when the token was already used', async () => {
    mockDb({
      tokenRow: { id: 'tok-1', clientId: 'client-1', expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() },
      client: CLIENT,
      coach: COACH,
    });
    const res = await GET(req('some-token'));
    expect(res.headers.get('location')).toBe('http://localhost/maya-reyes/account/login?error=expired');
  });

  it('redirects to error=expired when marking the token used loses the race (already consumed concurrently)', async () => {
    mockDb({
      tokenRow: { id: 'tok-1', clientId: 'client-1', expiresAt: new Date(Date.now() + 60_000), usedAt: null },
      client: CLIENT,
      coach: COACH,
      updateReturning: [],
    });
    const res = await GET(req('some-token'));
    expect(res.headers.get('location')).toBe('http://localhost/maya-reyes/account/login?error=expired');
  });

  it('marks the token used, sets a client session cookie, and redirects to the account page on success', async () => {
    mockDb({
      tokenRow: { id: 'tok-1', clientId: 'client-1', expiresAt: new Date(Date.now() + 60_000), usedAt: null },
      client: CLIENT,
      coach: COACH,
      updateReturning: [{ id: 'tok-1' }],
    });

    const res = await GET(req('some-token'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/maya-reyes/account');
    const cookie = res.cookies.get(CLIENT_SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    await expect(verifyClientSessionToken(cookie!.value)).resolves.toMatchObject({
      clientId: 'client-1',
      coachId: 'coach-1',
      coachHandle: 'maya-reyes',
      email: 'client@example.com',
    });
  });

  it('returns an invalid-link page on a DB error', async () => {
    (getDb as jest.Mock).mockReturnValue({
      query: { clientLoginTokens: { findFirst: jest.fn().mockRejectedValue(new Error('db down')) } },
    });
    const res = await GET(req('some-token'));
    expect(res.status).toBe(400);
  });
});
