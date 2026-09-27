import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/commerce/db';
import { CLIENT_SESSION_COOKIE_NAME, verifyClientSessionToken } from '@/lib/auth/clientSession';
import { ClientAccountView } from '@/components/ClientAccountView';

export const metadata = { title: 'My account · Instar' };

export default async function ClientAccountPage({ params }: { params: Promise<{ handle: string }> }) {
  const handle = decodeURIComponent((await params).handle).toLowerCase();

  const token = (await cookies()).get(CLIENT_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyClientSessionToken(token) : null;
  // A session for a *different* coach's client relationship should never render this coach's
  // account page — same handle mismatch means "not logged in here," not "logged in as someone else."
  if (!session || session.coachHandle !== handle) {
    redirect(`/${handle}/account/login`);
  }

  const db = getDb();
  const client = await db.query.clients.findFirst({ where: (c, { eq }) => eq(c.id, session.clientId) });
  const coach = await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.id, session.coachId) });
  if (!client || !coach) {
    redirect(`/${handle}/account/login`);
  }

  return (
    <main className="ins-pub" style={{ paddingTop: 40 }}>
      <ClientAccountView email={client.email} name={client.name} coachDisplayName={coach.displayName} />
    </main>
  );
}
