import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

// `middleware.ts` was renamed to `proxy.ts` in Next.js 16 — see AGENTS.md. Proxy defaults to the
// Node.js runtime here, so this can safely reuse the same jose-based session verification the API
// routes use.

const AUTH_PAGES = new Set(['/login', '/signup']);

export const config = {
  matcher: ['/', '/clients/:path*', '/grow/:path*', '/business/:path*', '/login', '/signup'],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (AUTH_PAGES.has(pathname)) {
    // Already signed in — no reason to see the sign-up/login forms again.
    if (session) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
