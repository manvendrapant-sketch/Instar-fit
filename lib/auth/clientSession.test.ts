import {
  CLIENT_SESSION_COOKIE_NAME,
  clearClientSessionCookie,
  createClientSessionToken,
  setClientSessionCookie,
  verifyClientSessionToken,
} from './clientSession';

const PAYLOAD = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

function fakeCookies() {
  return { set: jest.fn() };
}

describe('createClientSessionToken / verifyClientSessionToken', () => {
  it('round-trips the payload through a signed token', async () => {
    const token = await createClientSessionToken(PAYLOAD);
    await expect(verifyClientSessionToken(token)).resolves.toMatchObject(PAYLOAD);
  });

  it('returns null, never throws, for garbage input', async () => {
    await expect(verifyClientSessionToken('not-a-jwt')).resolves.toBeNull();
    await expect(verifyClientSessionToken('')).resolves.toBeNull();
  });

  it('returns null for a token tampered with after signing', async () => {
    const token = await createClientSessionToken(PAYLOAD);
    const tampered = token.slice(0, -2) + (token.at(-2) === 'a' ? 'b' : 'a') + token.at(-1);
    await expect(verifyClientSessionToken(tampered)).resolves.toBeNull();
  });

  it('returns null for a token signed with a different secret', async () => {
    const original = process.env.CLIENT_SESSION_JWT_SECRET;
    process.env.CLIENT_SESSION_JWT_SECRET = 'secret-a';
    const token = await createClientSessionToken(PAYLOAD);

    process.env.CLIENT_SESSION_JWT_SECRET = 'secret-b';
    await expect(verifyClientSessionToken(token)).resolves.toBeNull();
    process.env.CLIENT_SESSION_JWT_SECRET = original;
  });

  it('is not interchangeable with a coach session signed under a different secret', async () => {
    // Belt-and-suspenders: even though the payload shapes differ too, confirm the two token
    // families really do use separate secrets, not just separate TypeScript types.
    const { createSessionToken } = await import('./session');
    const coachToken = await createSessionToken({
      coachId: 'coach-1',
      email: 'maya@studio.com',
      handle: 'maya-reyes',
      displayName: 'Maya Reyes',
    });
    await expect(verifyClientSessionToken(coachToken)).resolves.toBeNull();
  });

  it('throws if CLIENT_SESSION_JWT_SECRET is not set', async () => {
    const original = process.env.CLIENT_SESSION_JWT_SECRET;
    delete process.env.CLIENT_SESSION_JWT_SECRET;
    await expect(createClientSessionToken(PAYLOAD)).rejects.toThrow(/CLIENT_SESSION_JWT_SECRET is not set/);
    process.env.CLIENT_SESSION_JWT_SECRET = original;
  });
});

describe('setClientSessionCookie / clearClientSessionCookie', () => {
  it('sets an httpOnly, sameSite=lax cookie with the token as its value', () => {
    const cookies = fakeCookies();
    setClientSessionCookie(cookies as never, 'the-token');
    expect(cookies.set).toHaveBeenCalledWith(
      CLIENT_SESSION_COOKIE_NAME,
      'the-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 }),
    );
  });

  it('clears the cookie with an empty value and maxAge 0', () => {
    const cookies = fakeCookies();
    clearClientSessionCookie(cookies as never);
    expect(cookies.set).toHaveBeenCalledWith(
      CLIENT_SESSION_COOKIE_NAME,
      '',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 }),
    );
  });
});
