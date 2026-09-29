import type { OnboardingStatus } from './commerce/types';
import { buildChecklist, closeSetupChecklist, headline, progress, type ChecklistInput } from './sellChecklist';

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
};
const ready: ChecklistInput = { storefrontCompleted: true, activeOffers: 2, payouts: payouts('ready'), published: false, canPublish: true };
const live: ChecklistInput = { ...ready, published: true };

const states = (i: ChecklistInput) => Object.fromEntries(buildChecklist(i).map((s) => [s.key, s.state]));

describe('buildChecklist', () => {
  it('has exactly the four setup steps, in order', () => {
    expect(buildChecklist(fresh).map((s) => s.key)).toEqual(['storefront', 'offer', 'payouts', 'publish']);
  });

  it('a brand-new coach starts at the storefront, with publish locked', () => {
    expect(states(fresh)).toEqual({ storefront: 'next', offer: 'todo', payouts: 'todo', publish: 'locked' });
    expect(buildChecklist(fresh)[0].action).toEqual({ label: 'Create storefront', href: '/business/storefront' });
  });

  it('moves "next" along as steps get done', () => {
    expect(states({ ...fresh, storefrontCompleted: true }).offer).toBe('next');
    expect(states({ ...fresh, storefrontCompleted: true, activeOffers: 1 }).payouts).toBe('next');
    expect(states(ready).publish).toBe('next');
    expect(buildChecklist(ready)[3].action).toEqual({ label: 'Publish', href: '/business/storefront' });
  });

  it('only counts offers that are on the storefront', () => {
    const offer = buildChecklist({ ...fresh, storefrontCompleted: true, activeOffers: 0 })[1];
    expect(offer).toMatchObject({ state: 'next', action: { href: '/business/offers/new' } });
  });

  it('treats a Stripe review as waiting, and lets an earlier step be next meanwhile', () => {
    const s = buildChecklist({ ...fresh, storefrontCompleted: true, payouts: payouts('pending_review') });
    expect(s.find((x) => x.key === 'payouts')).toMatchObject({ state: 'waiting', action: { label: 'See status' } });
    expect(s.find((x) => x.key === 'offer')?.state).toBe('next');
  });

  it('asks for the missing Stripe details when action is needed', () => {
    const p = buildChecklist({ ...ready, payouts: payouts('action_needed'), canPublish: false }).find((x) => x.key === 'payouts');
    expect(p).toMatchObject({ state: 'next', action: { label: 'Finish on Stripe', href: '/business/payouts' } });
  });

  it('follows the server’s publish gate rather than its own guess', () => {
    expect(states({ ...ready, canPublish: false }).publish).toBe('locked');
  });

  it('never gives a done or locked step a button, and has at most one next', () => {
    for (const input of [fresh, ready, live, { ...ready, payouts: payouts('pending_review') }]) {
      const steps = buildChecklist(input);
      for (const s of steps) if (s.state === 'done' || s.state === 'locked') expect(s.action).toBeNull();
      expect(steps.filter((s) => s.state === 'next').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('progress / headline', () => {
  it('counts done steps and names the next one', () => {
    expect(progress(buildChecklist(fresh))).toEqual({ done: 0, total: 4, complete: false });
    expect(headline(buildChecklist(fresh))).toBe('Next: create your storefront');
    expect(progress(buildChecklist(ready))).toMatchObject({ done: 3, complete: false });
  });
  it('says what it’s waiting on when nothing is actionable', () => {
    expect(headline(buildChecklist({ ...ready, payouts: payouts('pending_review'), canPublish: false }))).toBe('Waiting on Stripe');
  });
  it('is complete once the storefront is live, which is what closes it', () => {
    expect(progress(buildChecklist(live))).toEqual({ done: 4, total: 4, complete: true });
  });
});

describe('closeSetupChecklist', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  const respond = (body: unknown) => fetchMock.mockResolvedValueOnce({ json: async () => body } as Response);

  it('POSTs the close and returns the saved time', async () => {
    respond({ success: true, message: 'Checklist closed.', data: { setupChecklistClosedAt: '2026-09-29T10:00:00.000Z' } });
    await expect(closeSetupChecklist()).resolves.toBe('2026-09-29T10:00:00.000Z');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/coach/setup-checklist/close');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });
  it('returns null when it can’t be saved, so the browser flag is the fallback', async () => {
    respond({ success: false, code: 'INTERNAL_ERROR', message: 'x' });
    await expect(closeSetupChecklist()).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(closeSetupChecklist()).resolves.toBeNull();
  });
});
