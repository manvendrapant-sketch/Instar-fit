'use client';

import { useAppState } from '@/lib/store';
import { toPreviewProfile } from '@/lib/publicStorefront';
import { LoadingSection } from '@/components/LoadingSection';
import { PublicStorefrontView, PublicUnavailable } from '@/components/PublicStorefrontView';

/**
 * The signed-in coach looking at their own page before it's published: the public API won't serve
 * it yet, so build the same view from their own profile and active offers.
 */
export function OwnerPreview() {
  const { storefront, offers, hydrated } = useAppState();
  if (!hydrated) {
    return (
      <main className="ins-pub">
        <LoadingSection label="Loading your preview…" />
      </main>
    );
  }
  if (!storefront) return <PublicUnavailable handle="" reason="error" />;
  return <PublicStorefrontView profile={toPreviewProfile(storefront, offers)} banner="owner-preview" />;
}
