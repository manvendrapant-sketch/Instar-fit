import { cookies } from 'next/headers';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

// Coach dashboard chrome: top bar, sidebar directory and command palette. proxy.ts already
// guarantees a valid session reaches here (it redirects unauthenticated requests to /login), so
// this only needs to decode the token for display — no DB round trip, and no redirect of its own.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const coach = { displayName: session?.displayName ?? 'Coach', email: session?.email ?? '' };

  return (
    <>
      <div className="ins-page">
        <TopBar coach={coach} />
        <div className="ins-app">
          <Sidebar coach={coach} />
          <main className="ins-wrap" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </>
  );
}
