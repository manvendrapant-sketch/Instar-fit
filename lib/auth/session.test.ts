import {
  clearSessionCookie,
  createSessionToken,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifySessionToken,
} from '@/lib/auth/session';

const PAYLOAD = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function fakeCookies() {
  return { set: jest.fn() };
}

describe('createSessionToken / verifySessionToken', () => {
  it('round-trips the payload through a signed token', async () => {
    const token = await createSessionToken(PAYLOAD);
    const session = await verifySessionToken(token);
    expect(session).toMatchObject(PAYLOAD);
  });

  it('returns null, never throws, for garbage input', async () => {
    await expect(verifySessionToken('not-a-jwt')).resolves.toBeNull();
    await expect(verifySessionToken('')).resolves.toBeNull();
  });

  it('returns null for a token tampered with after signing', async () => {
    const token = await createSessionToken(PAYLOAD);
    const tampered = token.slice(0, -2) + (token.at(-2) === 'a' ? 'b' : 'a') + token.at(-1);
    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it('returns null for a token signed with a different secret', async () => {
    // getSessionSecret() reads process.env on every call (must stay lazy — see the source
    // comment), so swapping the secret between calls is enough; no re-import needed.
    const original = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = 'secret-a';
    const token = await createSessionToken(PAYLOAD);

    process.env.AUTH_JWT_SECRET = 'secret-b';
    await expect(verifySessionToken(token)).resolves.toBeNull();
    process.env.AUTH_JWT_SECRET = original;
  });

  it('returns null for an already-expired token', async () => {
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET);
    const expiredToken = await new SignJWT({ ...PAYLOAD })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // 60s in the past
      .sign(secret);
    await expect(verifySessionToken(expiredToken)).resolves.toBeNull();
  });

  it('throws if AUTH_JWT_SECRET is not set', async () => {
    const original = process.env.AUTH_JWT_SECRET;
    delete process.env.AUTH_JWT_SECRET;
    await expect(createSessionToken(PAYLOAD)).rejects.toThrow(/AUTH_JWT_SECRET is not set/);
    process.env.AUTH_JWT_SECRET = original;
  });
});

describe('setSessionCookie / clearSessionCookie', () => {
  it('sets an httpOnly, sameSite=lax cookie with the token as its value', () => {
    const cookies = fakeCookies();
    setSessionCookie(cookies as never, 'the-token');
    expect(cookies.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'the-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 }),
    );
  });

  it('clears the cookie with an empty value and maxAge 0', () => {
    const cookies = fakeCookies();
    clearSessionCookie(cookies as never);
    expect(cookies.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      '',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 }),
    );
  });
});
