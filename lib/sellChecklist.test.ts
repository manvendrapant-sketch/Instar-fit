import type { OnboardingStatus } from './commerce/types';
import { buildChecklist, fetchHasSale, headline, progress, type ChecklistInput } from './sellChecklist';

const payouts = (status: OnboardingStatus['status']): OnboardingStatus => ({
  status,
  chargesEnabled: status === 'ready',
  payoutsEnabled: status === 'ready',
  requirementsDue: [],
});

const fresh: ChecklistInput = {
  storefrontCompleted: false,
  activeOffers: 0,
  payouts: payouts('not_started'),
  published: false,
  canPublish: false,
  linkShared: false,
  hasSale: null,
};
const ready: ChecklistInput = { ...fresh, storefrontCompleted: true, activeOffers: 2, payouts: payouts('ready'), canPublish: true };
const live: ChecklistInput = { ...ready, published: true };

const states = (i: ChecklistInput) => Object.fromEntries(buildChecklist(i).map((s) => [s.key, s.state]));

describe('buildChecklist', () => {
  it('a brand-new coach starts at the storefront, with publish/share/sale locked', () => {
    expect(states(fresh)).toEqual({
      storefront: 'next',
      offer: 'todo',
      payouts: 'todo',
      publish: 'locked',
      share: 'locked',
      sale: 'locked',
    });
    const [first] = buildChecklist(fresh);
    expect(first.action).toEqual({ kind: 'link', label: 'Create storefront', href: '/business/storefront' });
  });

  it('moves "next" along as steps get done, in the agreed order', () => {
    expect(states({ ...fresh, storefrontCompleted: true }).offer).toBe('next');
    expect(states({ ...fresh, storefrontCompleted: true, activeOffers: 1 }).payouts).toBe('next');
    expect(states(ready).publish).toBe('next');
    expect(states(live)).toMatchObject({ publish: 'done', share: 'next', sale: 'waiting' });
  });

  it('only counts offers that are on the storefront', () => {
    const [, offer] = buildChecklist({ ...fresh, storefrontCompleted: true, activeOffers: 0 });
    expect(offer.state).toBe('next');
    expect(offer.action).toMatchObject({ href: '/business/offers/new' });
  });

  it('treats a Stripe review as waiting, and lets an earlier step become next meanwhile', () => {
    const s = buildChecklist({ ...fresh, storefrontCompleted: true, payouts: payouts('pending_review') });
    expect(s.find((x) => x.key === 'payouts')).toMatchObject({ state: 'waiting', action: { label: 'See status' } });
    expect(s.find((x) => x.key === 'offer')?.state).toBe('next');
  });

  it('asks for the missing Stripe details when action is needed', () => {
    const p = buildChecklist({ ...ready, payouts: payouts('action_needed'), canPublish: false }).find((x) => x.key === 'payouts');
    expect(p).toMatchObject({ state: 'next', action: { label: 'Finish on Stripe', href: '/business/payouts' } });
  });

  it('follows the server’s publish gate rather than its own guess', () => {
    // Every step looks done, but the server still says no (e.g. every offer hidden server-side).
    expect(states({ ...ready, canPublish: false }).publish).toBe('locked');
  });

  it('share is a copy action, done once copied or once a sale proves the link got out', () => {
    expect(buildChecklist(live).find((x) => x.key === 'share')?.action).toEqual({ kind: 'copy', label: 'Copy link' });
    expect(states({ ...live, linkShared: true }).share).toBe('done');
    expect(states({ ...live, hasSale: true }).share).toBe('done');
    // A copy before going live doesn't count: there was no live page to share yet.
    expect(states({ ...ready, linkShared: true }).share).toBe('locked');
  });

  it('never gives a done or locked step a button', () => {
    for (const input of [fresh, ready, live, { ...live, linkShared: true, hasSale: true }]) {
      for (const s of buildChecklist(input)) if (s.state === 'done' || s.state === 'locked') expect(s.action).toBeNull();
    }
  });

  it('marks exactly one step as next at most', () => {
    for (const input of [fresh, ready, live, { ...live, linkShared: true }]) {
      expect(buildChecklist(input).filter((s) => s.state === 'next').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('progress / headline', () => {
  it('counts done steps and names the next one', () => {
    expect(progress(buildChecklist(fresh))).toEqual({ done: 0, total: 6, complete: false });
    expect(headline(buildChecklist(fresh))).toBe('Next: create your storefront');
    expect(progress(buildChecklist(live))).toMatchObject({ done: 4 });
  });
  it('says what it’s waiting on when nothing is actionable', () => {
    expect(headline(buildChecklist({ ...live, linkShared: true }))).toBe('Waiting on your first client');
    expect(headline(buildChecklist({ ...ready, payouts: payouts('pending_review'), canPublish: false }))).toBe('Waiting on Stripe');
  });
  it('celebrates once everything is done', () => {
    const all = buildChecklist({ ...live, linkShared: true, hasSale: true });
    expect(progress(all).complete).toBe(true);
    expect(headline(all)).toBe('You’re open for business');
  });
});

describe('fetchHasSale', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  const respond = (body: unknown) => fetchMock.mockResolvedValueOnce({ json: async () => body } as Response);

  it('is true once any payment went through, ignoring failed ones', async () => {
    respond({ success: true, message: 'ok', data: { payments: [{ status: 'failed' }, { status: 'refunded' }] } });
    await expect(fetchHasSale()).resolves.toBe(true);
    respond({ success: true, message: 'ok', data: { payments: [{ status: 'failed' }] } });
    await expect(fetchHasSale()).resolves.toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/coach/payments');
  });
  it('is null (unknown) when the list can’t be loaded', async () => {
    respond({ success: false, code: 'INTERNAL_ERROR', message: 'x' });
    await expect(fetchHasSale()).resolves.toBeNull();
  });
});
