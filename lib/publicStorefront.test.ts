import { blankOffer, type OfferDraft } from './offers';
import { MOCK_READY, NOT_STARTED, mockStatusAfter } from './payouts';
import {
  canPublish,
  DEMO_HANDLE,
  DEMO_STOREFRONT,
  handleToName,
  publishSteps,
  resolvePublicView,
  toPublicStorefront,
} from './publicStorefront';
import { storefrontLink, type StorefrontDraft } from './storefront';

const sf: StorefrontDraft = {
  handle: 'maya-reyes',
  displayName: 'Maya Reyes',
  bio: 'Hi',
  avatarUrl: null,
  specialties: ['Strength'],
  location: 'Austin, TX',
  coachingMode: 'online',
  timeZone: 'America/Chicago',
};
const shown: OfferDraft = { ...blankOffer('subscription', 'a'), name: 'Coaching' };
const hidden: OfferDraft = { ...blankOffer('session', 'b'), name: 'Call', visible: false };

describe('toPublicStorefront', () => {
  it('keeps only visible offers, in order, and writes the location line', () => {
    const p = toPublicStorefront(sf, [hidden, shown]);
    expect(p.offers.map((o) => o.id)).toEqual(['a']);
    expect(p.where).toBe('Austin, TX · Online');
    expect(p).not.toHaveProperty('timeZone');
  });
});

describe('resolvePublicView', () => {
  const none = { storefront: null, offers: [], published: false };

  it('shows the owner their own page, live or as a preview', () => {
    expect(resolvePublicView('maya-reyes', { storefront: sf, offers: [shown], published: false })).toMatchObject({ kind: 'owner', live: false });
    expect(resolvePublicView('Maya-Reyes', { storefront: sf, offers: [shown], published: true })).toMatchObject({ kind: 'owner', live: true });
  });

  it('shows the demo coach for the demo handle and not found otherwise', () => {
    expect(resolvePublicView(DEMO_HANDLE, none)).toEqual({ kind: 'demo', storefront: DEMO_STOREFRONT });
    expect(resolvePublicView('someone-else', none)).toEqual({ kind: 'not_found' });
    expect(resolvePublicView('someone-else', { storefront: sf, offers: [], published: true })).toEqual({ kind: 'not_found' });
  });

  it('gives the demo coach one of each offer type', () => {
    expect(DEMO_STOREFRONT.offers.map((o) => o.type).sort()).toEqual(['one_time', 'session', 'subscription']);
  });
});

describe('publishSteps / canPublish', () => {
  it('blocks until storefront, a visible offer and ready payouts all exist', () => {
    expect(canPublish(publishSteps({ storefront: null, offers: [], payouts: NOT_STARTED }))).toBe(false);
    expect(canPublish(publishSteps({ storefront: sf, offers: [shown], payouts: NOT_STARTED }))).toBe(false);
    expect(canPublish(publishSteps({ storefront: sf, offers: [hidden], payouts: MOCK_READY }))).toBe(false);
    expect(canPublish(publishSteps({ storefront: sf, offers: [shown], payouts: MOCK_READY }))).toBe(true);
  });

  it('explains each blocker', () => {
    const steps = publishSteps({ storefront: sf, offers: [hidden], payouts: mockStatusAfter('finished') });
    expect(steps.find((s) => s.key === 'offer')?.why).toMatch(/hidden/);
    expect(steps.find((s) => s.key === 'payouts')?.why).toMatch(/checking/);
    expect(steps.find((s) => s.key === 'offer')?.href).toBe('/business/offers');
    expect(publishSteps({ storefront: sf, offers: [], payouts: NOT_STARTED })[1].href).toBe('/business/offers/new');
  });
});

describe('links and names', () => {
  it('writes storefront links path-style', () => {
    expect(storefrontLink('maya-reyes')).toBe('instar.co/maya-reyes');
    expect(storefrontLink('')).toBe('instar.co/yourname');
  });

  it('turns a handle into a display name', () => {
    expect(handleToName('maya-reyes')).toBe('Maya Reyes');
    expect(handleToName('coach-2')).toBe('Coach 2');
  });
});
