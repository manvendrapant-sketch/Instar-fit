import 'server-only';
import { headers } from 'next/headers';

/**
 * This request's own origin (e.g. "https://instar-fit.vercel.app"), so server components can call
 * the app's public API routes with an absolute URL. Vercel sets x-forwarded-proto/host.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
