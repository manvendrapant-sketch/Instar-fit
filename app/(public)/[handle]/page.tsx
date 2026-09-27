import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicStorefrontView, PublicUnavailable } from '@/components/PublicStorefrontView';
import { OwnerPreview } from '@/components/OwnerPreview';
import type { CheckoutOutcome } from '@/components/CheckoutOutcomeBanner';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import { handleToName } from '@/lib/publicStorefront';
import { getPublicProfile, normalizeParam } from './load';

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function readCheckoutOutcome(value: string | string[] | undefined): CheckoutOutcome | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'success' || v === 'cancelled' ? v : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = normalizeParam((await params).handle);
  const result = await getPublicProfile(handle);
  if (result.kind !== 'found') {
    return { title: `${handleToName(handle) || 'Coach'} · Instar`, robots: { index: false } };
  }
  const { displayName, bio, specialties } = result.profile;
  const description =
    bio ?? `${specialties.length ? `${specialties.join(', ')} coaching` : 'Coaching'} with ${displayName}. Pick an offer and pay in about a minute.`;
  return {
    title: `${displayName} · Instar`,
    description,
    openGraph: { title: `${displayName} · Coaching on Instar`, description, type: 'profile', url: `/${handle}` },
    twitter: { card: 'summary_large_image', title: `${displayName} · Coaching on Instar`, description },
  };
}

export default async function PublicStorefrontPage({ params, searchParams }: Props) {
  const handle = normalizeParam((await params).handle);
  const checkoutOutcome = readCheckoutOutcome((await searchParams).checkout);
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isOwner = session?.handle === handle;

  const result = await getPublicProfile(handle);
  if (result.kind === 'found') {
    return (
      <PublicStorefrontView profile={result.profile} banner={isOwner ? 'owner-live' : null} checkoutOutcome={checkoutOutcome} />
    );
  }
  // The public API only serves published pages; the owner can still preview theirs.
  if (isOwner) return <OwnerPreview />;
  return <PublicUnavailable handle={handle} reason={result.kind} />;
}
