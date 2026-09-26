import type { CoachOfferSummary, CoachProfile, CoachPublicProfile, OnboardingStatus } from './commerce/types';
import { canPublish, handleToName, loadPublicProfile, publishSteps, toPreviewProfile } from './publicStorefront';
import { storefrontLink } from './storefront';

const profile: CoachProfile = {
  handle: 'maya-reyes',
  displayName: 'Maya Reyes',
  bio: 'Hi',
  avatarUrl: null,
  specialties: ['Strength'],
  location: 'Austin, TX',
  coachingMode: 'online',
  timeZone: 'America/Chicago',
  completed: true,
};
const offer = (id: string, active: boolean): CoachOfferSummary => ({
  id,
  type: 'subscription',
  name: id,
  description: null,
  price: { currency: 'usd', unitAmountCents: 19900, interval: 'month', intervalCount: 1 },
  includes: [],
  lengthWeeks: null,
  sessionMinutes: null,
  active,
  position: 0,
});
const NOT_STARTED: OnboardingStatus = { status: 'not_started', chargesEnabled: false, payoutsEnabled: false, requirementsDue: [] };
const READY: OnboardingStatus = { status: 'ready', chargesEnabled: true, payoutsEnabled: true, requirementsDue: [] };
const REVIEW: OnboardingStatus = { status: 'pending_review', chargesEnabled: false, payoutsEnabled: false, requirementsDue: [] };

const publicProfile: CoachPublicProfile = { ...toPreviewProfile(profile, [offer('a', true)]) };

function fakeFetch(status: number, body: unknown) {
  return jest.fn(async () => ({ status, json: async () => body }) as unknown as Response);
}

describe('loadPublicProfile', () => {
  it('calls the public API for the handle', async () => {
    const f = fakeFetch(200, { success: true, message: 'ok', data: publicProfile });
    await expect(loadPublicProfile('https://x.test', 'maya-reyes', f)).resolves.toEqual({ kind: 'found', profile: publicProfile });
    expect(f).toHaveBeenCalledWith('https://x.test/api/coach/maya-reyes', { cache: 'no-store' });
  });

  it('treats 404 (unknown or unpublished) as not found', async () => {
    const f = fakeFetch(404, { success: false, code: 'NOT_FOUND', message: 'This page is not available.' });
    await expect(loadPublicProfile('https://x.test', 'nobody', f)).resolves.toEqual({ kind: 'not_found' });
  });

  it('treats other failures as an error, never throwing', async () => {
    await expect(loadPublicProfile('https://x.test', 'a', fakeFetch(500, { success: false, code: 'INTERNAL_ERROR', message: 'x' }))).resolves.toEqual({ kind: 'error' });
    const badJson = jest.fn(async () => ({ status: 502, json: async () => { throw new Error('not json'); } }) as unknown as Response);
    await expect(loadPublicProfile('https://x.test', 'a', badJson)).resolves.toEqual({ kind: 'error' });
    const offline = jest.fn(async () => { throw new Error('offline'); });
    await expect(loadPublicProfile('https://x.test', 'a', offline)).resolves.toEqual({ kind: 'error' });
  });

  it('encodes the handle', async () => {
    const f = fakeFetch(404, {});
    await loadPublicProfile('https://x.test', 'a/b', f);
    expect(f).toHaveBeenCalledWith('https://x.test/api/coach/a%2Fb', { cache: 'no-store' });
  });
});

describe('toPreviewProfile', () => {
  it('keeps only active offers and drops private fields', () => {
    const p = toPreviewProfile(profile, [offer('hidden', false), offer('shown', true)]);
    expect(p.offers.map((o) => o.id)).toEqual(['shown']);
    expect(p).not.toHaveProperty('timeZone');
    expect(p).not.toHaveProperty('completed');
  });
});

describe('publishSteps / canPublish', () => {
  it('marks each step done from profile, active offers and payouts', () => {
    const done = (s: ReturnType<typeof publishSteps>) => s.filter((x) => x.done).map((x) => x.key);
    expect(done(publishSteps({ storefront: null, offers: [], payouts: NOT_STARTED }))).toEqual([]);
    expect(done(publishSteps({ storefront: { ...profile, completed: false }, offers: [], payouts: NOT_STARTED }))).toEqual([]);
    expect(done(publishSteps({ storefront: profile, offers: [offer('a', false)], payouts: READY }))).toEqual(['storefront', 'payouts']);
    expect(done(publishSteps({ storefront: profile, offers: [offer('a', true)], payouts: READY }))).toEqual(['storefront', 'offer', 'payouts']);
  });

  it('explains each blocker and links to where to fix it', () => {
    const steps = publishSteps({ storefront: profile, offers: [offer('a', false)], payouts: REVIEW });
    expect(steps[1]).toMatchObject({ why: expect.stringMatching(/hidden/), href: '/business/offers' });
    expect(steps[2].why).toMatch(/checking/);
    expect(publishSteps({ storefront: profile, offers: [], payouts: NOT_STARTED })[1].href).toBe('/business/offers/new');
  });

  it('leaves the publish decision to the server', () => {
    expect(canPublish(null)).toBe(false);
    const base = { handle: 'm', published: false, connectStatus: 'ready' as const, publicUrl: '/m' };
    expect(canPublish({ ...base, canPublish: false })).toBe(false);
    expect(canPublish({ ...base, canPublish: true })).toBe(true);
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
