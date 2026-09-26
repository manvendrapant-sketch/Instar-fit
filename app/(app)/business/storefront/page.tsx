import { cookies } from 'next/headers';
import { StorefrontCreator } from '@/components/StorefrontCreator';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

export const metadata = { title: 'Storefront · Instar' };

export default async function StorefrontPage() {
  // Signup already reserved a handle from the coach's name (lib/auth/handle.ts); start from it
  // rather than a blank form. proxy.ts guarantees a session reaches this page.
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  return <StorefrontCreator defaults={{ handle: session?.handle ?? '', displayName: session?.displayName ?? '' }} />;
}
