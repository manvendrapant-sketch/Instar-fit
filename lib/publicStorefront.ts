import type { CoachOfferSummary, CoachProfile, CoachPublicProfile, OnboardingStatus, StorefrontStatus } from './commerce/types';
import type { ApiResult } from './api-client';
import { OFFERS_PATH } from './offers';
import { isPayoutsReady, PAYOUTS_PATH } from './payouts';
import { STOREFRONT_PATH } from './storefront';

// The public storefront clients see at /<handle>. Data comes from GET /api/coach/[handle]
// (CoachPublicProfile), which only returns a published coach's page and their active offers.

export type PublicProfileResult =
  | { kind: 'found'; profile: CoachPublicProfile }
  | { kind: 'not_found' }
  | { kind: 'error' };

/**
 * Loads a public profile from `${origin}/api/coach/<handle>`. Never throws: a 404 is "not found"
 * (unknown or unpublished), anything else that fails is "error" so the page can say so instead of
 * claiming the coach doesn't exist.
 */
export async function loadPublicProfile(
  origin: string,
  handle: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicProfileResult> {
  try {
    const res = await fetchImpl(`${origin}/api/coach/${encodeURIComponent(handle)}`, { cache: 'no-store' });
    if (res.status === 404) return { kind: 'not_found' };
    const body = (await res.json()) as ApiResult<CoachPublicProfile>;
    return body.success ? { kind: 'found', profile: body.data } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

/** The owner's own unpublished page, built from their signed-in profile and active offers. */
export function toPreviewProfile(profile: CoachProfile, offers: CoachOfferSummary[]): CoachPublicProfile {
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    specialties: profile.specialties,
    location: profile.location,
    coachingMode: profile.coachingMode,
    offers: offers.filter((o) => o.active),
  };
}

export interface PublishStep {
  key: 'storefront' | 'offer' | 'payouts';
  label: string;
  done: boolean;
  href: string;
  /** Why it blocks publishing, shown while not done. */
  why: string;
}

/**
 * The three things a storefront needs before it can go public, in order, for explaining *why*
 * Publish is locked. The server's StorefrontStatus.canPublish stays the source of truth for
 * whether publishing is allowed.
 */
export function publishSteps(state: {
  storefront: CoachProfile | null;
  offers: CoachOfferSummary[];
  payouts: OnboardingStatus;
}): PublishStep[] {
  return [
    {
      key: 'storefront',
      label: 'Create your storefront',
      done: !!state.storefront?.completed,
      href: STOREFRONT_PATH,
      why: 'Clients need your name, link and specialty.',
    },
    {
      key: 'offer',
      label: 'Add an offer clients can see',
      done: state.offers.some((o) => o.active),
      href: state.offers.length ? OFFERS_PATH : `${OFFERS_PATH}/new`,
      why: state.offers.length ? 'All your offers are hidden. Show at least one.' : 'Clients need something to buy.',
    },
    {
      key: 'payouts',
      label: 'Connect payouts',
      done: isPayoutsReady(state.payouts),
      href: PAYOUTS_PATH,
      why:
        state.payouts.status === 'pending_review'
          ? 'Stripe is still checking your details.'
          : 'So clients’ payments can reach your bank.',
    },
  ];
}

/** Publishing is allowed only when the server says so. */
export function canPublish(status: StorefrontStatus | null): boolean {
  return !!status?.canPublish;
}

/** "maya-reyes" → "Maya Reyes", for titles when only the handle is known. */
export function handleToName(handle: string): string {
  return handle
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
