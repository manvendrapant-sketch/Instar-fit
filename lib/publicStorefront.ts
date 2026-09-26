import type { CoachPublicProfile, OnboardingStatus } from './commerce/types';
import type { OfferDraft } from './offers';
import { isPayoutsReady, PAYOUTS_PATH } from './payouts';
import { locationLine, STOREFRONT_PATH, type StorefrontDraft } from './storefront';
import { OFFERS_PATH } from './offers';

// The public storefront clients see at /<handle>, frontend only. The real page will load
// GET /api/coach/[handle] (CoachPublicProfile in lib/commerce/types.ts). Until then it can show:
// the signed-in coach's own storefront from this browser (so they can preview and share it),
// or one built-in demo coach, matching the seed data's `maya-test`.

export interface PublicStorefront extends Omit<CoachPublicProfile, 'offers' | 'socialProof'> {
  specialties: string[];
  /** "Austin, TX · Online". */
  where: string;
  /** Visible offers only, in the coach's order. */
  offers: OfferDraft[];
}

export function toPublicStorefront(s: StorefrontDraft, offers: OfferDraft[]): PublicStorefront {
  return {
    handle: s.handle,
    displayName: s.displayName,
    bio: s.bio,
    avatarUrl: s.avatarUrl,
    specialties: s.specialties,
    where: locationLine(s),
    offers: offers.filter((o) => o.visible),
  };
}

export const DEMO_HANDLE = 'maya-test';

export const DEMO_STOREFRONT: PublicStorefront = {
  handle: DEMO_HANDLE,
  displayName: 'Maya Reyes',
  bio: 'Strength coach for busy parents. Three sessions a week, real food, no burnout.',
  avatarUrl: null,
  specialties: ['Strength', 'Mobility', 'Nutrition'],
  where: 'Austin, TX · Online and in person',
  offers: [
    {
      id: 'demo-coaching',
      type: 'subscription',
      name: '1:1 Coaching',
      description: 'A plan built around your week, adjusted every Sunday from your check-in.',
      price: { currency: 'usd', unitAmountCents: 19900, interval: 'month', intervalCount: 1 },
      includes: ['Custom training plan, updated weekly', 'Weekly video check-in', 'Message me any time'],
      lengthWeeks: null,
      sessionMinutes: null,
      visible: true,
    },
    {
      id: 'demo-program',
      type: 'one_time',
      name: '12-week strength block',
      description: 'Learn the big lifts and get measurably stronger, at your own pace.',
      price: { currency: 'usd', unitAmountCents: 49900, interval: null, intervalCount: null },
      includes: ['3 sessions a week', 'Video form reviews'],
      lengthWeeks: 12,
      sessionMinutes: null,
      visible: true,
    },
    {
      id: 'demo-call',
      type: 'session',
      name: 'Discovery call',
      description: 'Not sure yet? Tell me about your goals and we’ll see if we’re a fit.',
      price: { currency: 'usd', unitAmountCents: 4900, interval: null, intervalCount: null },
      includes: [],
      lengthWeeks: null,
      sessionMinutes: 30,
      visible: true,
    },
  ],
};

export type PublicView =
  | { kind: 'owner'; live: boolean; storefront: PublicStorefront }
  | { kind: 'demo'; storefront: PublicStorefront }
  | { kind: 'not_found' };

/**
 * What /<handle> shows. `local` is this browser's saved storefront (if any): its owner sees their
 * page live or as a private preview; anyone else only ever sees the demo coach or "not found".
 */
export function resolvePublicView(
  handle: string,
  local: { storefront: StorefrontDraft | null; offers: OfferDraft[]; published: boolean },
): PublicView {
  const h = handle.toLowerCase();
  if (local.storefront && local.storefront.handle === h) {
    return { kind: 'owner', live: local.published, storefront: toPublicStorefront(local.storefront, local.offers) };
  }
  if (h === DEMO_HANDLE) return { kind: 'demo', storefront: DEMO_STOREFRONT };
  return { kind: 'not_found' };
}

export interface PublishStep {
  key: 'storefront' | 'offer' | 'payouts';
  label: string;
  done: boolean;
  href: string;
  /** Why it blocks publishing, shown while not done. */
  why: string;
}

/** The three things a storefront needs before it can go public, in order. */
export function publishSteps(state: {
  storefront: StorefrontDraft | null;
  offers: OfferDraft[];
  payouts: OnboardingStatus;
}): PublishStep[] {
  return [
    {
      key: 'storefront',
      label: 'Create your storefront',
      done: !!state.storefront,
      href: STOREFRONT_PATH,
      why: 'Clients need your name, link and specialty.',
    },
    {
      key: 'offer',
      label: 'Add an offer clients can see',
      done: state.offers.some((o) => o.visible),
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

export function canPublish(steps: PublishStep[]): boolean {
  return steps.every((s) => s.done);
}

/** "maya-reyes" → "Maya Reyes", for titles when only the handle is known. */
export function handleToName(handle: string): string {
  return handle
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
