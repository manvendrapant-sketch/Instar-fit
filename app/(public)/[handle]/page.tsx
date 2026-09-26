import type { Metadata } from 'next';
import { PublicStorefrontView } from '@/components/PublicStorefrontView';
import { DEMO_HANDLE, DEMO_STOREFRONT, handleToName } from '@/lib/publicStorefront';

type Props = { params: Promise<{ handle: string }> };

// Until GET /api/coach/[handle] exists the server only knows the handle (and the demo coach), so
// titles are derived from it; the real version reads the coach's name and bio from the API.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const h = decodeURIComponent(handle).toLowerCase();
  const name = h === DEMO_HANDLE ? DEMO_STOREFRONT.displayName : handleToName(h);
  const description =
    h === DEMO_HANDLE && DEMO_STOREFRONT.bio
      ? DEMO_STOREFRONT.bio
      : `Coaching, programs and sessions with ${name}. Pick an offer and pay in about a minute.`;
  return {
    title: `${name} · Instar`,
    description,
    openGraph: { title: `${name} · Coaching on Instar`, description, type: 'profile', url: `/${h}` },
    twitter: { card: 'summary_large_image', title: `${name} · Coaching on Instar`, description },
  };
}

export default async function PublicStorefrontPage({ params }: Props) {
  const { handle } = await params;
  return <PublicStorefrontView handle={decodeURIComponent(handle).toLowerCase()} />;
}
