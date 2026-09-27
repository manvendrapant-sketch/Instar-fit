import { getDb } from '@/lib/commerce/db';
import { ClientLoginForm } from '@/components/ClientLoginForm';

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: 'Log in · Instar' };

/**
 * Looks the coach up directly rather than through GET /api/coach/[handle] (the public storefront
 * endpoint, gated by `coaches.published`) — a client who bought before the coach unpublished
 * still needs to be able to log in and see their own subscription.
 */
export default async function ClientLoginPage({ params, searchParams }: Props) {
  const handle = decodeURIComponent((await params).handle).toLowerCase();
  const errorParam = (await searchParams).error;

  let coachDisplayName: string | null = null;
  try {
    const coach = await getDb().query.coaches.findFirst({ where: (c, { eq }) => eq(c.handle, handle) });
    coachDisplayName = coach?.displayName ?? null;
  } catch (err) {
    console.error(`GET /${handle}/account/login: failed to load coach:`, err);
  }

  return (
    <main className="ins-pub" style={{ paddingTop: 40 }}>
      {errorParam === 'expired' && (
        <p className="ins-pub-banner" role="alert">
          That link expired or was already used. Request a new one below.
        </p>
      )}
      {coachDisplayName ? (
        <ClientLoginForm handle={handle} coachDisplayName={coachDisplayName} />
      ) : (
        <section className="ins-panel ins-auth-card ins-in">
          <h2>We couldn&rsquo;t load this page</h2>
          <p>Check the link, or try again in a moment.</p>
        </section>
      )}
    </main>
  );
}
