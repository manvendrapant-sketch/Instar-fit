import { NextRequest } from 'next/server';
// Despite Next 16 renaming middleware.ts -> proxy.ts (see AGENTS.md), this test helper hasn't
// been renamed to match yet in this Next version — it's still unstable_doesMiddlewareMatch.
import { unstable_doesMiddlewareMatch as doesProxyMatch } from 'next/experimental/testing/server';
import { config, proxy } from '@/proxy';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

jest.mock('@/lib/auth/session', () => ({
  ...jest.requireActual('@/lib/auth/session'),
  verifySessionToken: jest.fn(),
}));

function requestFor(path: string, sessionCookie?: string) {
  const headers = sessionCookie ? { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}` } : undefined;
  return new NextRequest(new URL(path, 'http://localhost'), { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('proxy — matcher', () => {
  it('matches the protected dashboard routes', () => {
    for (const url of ['/', '/clients', '/clients/123', '/grow', '/business']) {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    }
  });

  it('matches the auth pages', () => {
    for (const url of ['/login', '/signup']) {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    }
  });

  it('does not match API routes (they must stay reachable while signed out)', () => {
    for (const url of ['/api/auth/login', '/api/auth/signup', '/api/webhooks/stripe']) {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
    }
  });
});

describe('proxy — behavior', () => {
  it('redirects a signed-out visitor away from a protected page, to /login', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue(null);
    const res = await proxy(requestFor('/clients'));
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('lets a signed-out visitor through to /login and /signup', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue(null);
    for (const path of ['/login', '/signup']) {
      const res = await proxy(requestFor(path));
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('lets a signed-in visitor through to a protected page', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue({ coachId: 'coach-1' });
    const res = await proxy(requestFor('/', 'a-valid-looking-token'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects a signed-in visitor away from /login and /signup, to /', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue({ coachId: 'coach-1' });
    for (const path of ['/login', '/signup']) {
      const res = await proxy(requestFor(path, 'a-valid-looking-token'));
      expect(res.headers.get('location')).toBe('http://localhost/');
    }
  });

  it('treats a present-but-invalid session cookie the same as no cookie at all', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue(null);
    const res = await proxy(requestFor('/', 'a-tampered-token'));
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('never calls verifySessionToken when there is no session cookie', async () => {
    await proxy(requestFor('/login'));
    expect(verifySessionToken).not.toHaveBeenCalled();
  });
});
