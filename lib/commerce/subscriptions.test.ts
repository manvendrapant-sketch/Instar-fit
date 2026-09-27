import {
  mapSubscriptionStatus,
  subscriptionSyncFields,
  toClientSubscriptionSummary,
  toCoachClientSummary,
  validatePauseInput,
} from './subscriptions';

describe('mapSubscriptionStatus', () => {
  it('maps incomplete_expired -> canceled and unpaid -> past_due', () => {
    expect(mapSubscriptionStatus('incomplete_expired')).toBe('canceled');
    expect(mapSubscriptionStatus('unpaid')).toBe('past_due');
  });

  it('passes through every known status verbatim', () => {
    for (const s of ['incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled']) {
      expect(mapSubscriptionStatus(s)).toBe(s);
    }
  });

  it('falls back to incomplete for an unrecognized status', () => {
    expect(mapSubscriptionStatus('something_new')).toBe('incomplete');
  });
});

describe('subscriptionSyncFields', () => {
  it('maps Stripe status and current_period_end when not paused', () => {
    const fields = subscriptionSyncFields(
      { status: 'past_due', items: { data: [{ current_period_end: 1700000000 }] }, pause_collection: null } as never,
      null,
    );
    expect(fields).toEqual({
      status: 'past_due',
      currentPeriodEnd: new Date(1700000000 * 1000),
      pauseResumesAt: null,
      pauseReason: null,
    });
  });

  it('reports status "paused" whenever pause_collection.resumes_at is set, even if Stripe reports status active underneath', () => {
    const fields = subscriptionSyncFields(
      { status: 'active', items: { data: [] }, pause_collection: { resumes_at: 1700000000 } } as never,
      'vacation',
    );
    expect(fields.status).toBe('paused');
    expect(fields.pauseResumesAt).toEqual(new Date(1700000000 * 1000));
    expect(fields.pauseReason).toBe('vacation');
  });

  it('clears pauseReason once pause_collection is gone', () => {
    const fields = subscriptionSyncFields({ status: 'active', items: { data: [] }, pause_collection: null } as never, 'vacation');
    expect(fields.pauseReason).toBeNull();
    expect(fields.status).toBe('active');
  });

  it('is null current_period_end when there are no subscription items', () => {
    const fields = subscriptionSyncFields({ status: 'active', items: { data: [] }, pause_collection: null } as never, null);
    expect(fields.currentPeriodEnd).toBeNull();
  });
});

const PRICE = { currency: 'usd', unitAmountCents: 19900, interval: 'month' as const, intervalCount: 1 };

describe('toClientSubscriptionSummary', () => {
  it('builds the client-facing summary shape', () => {
    const row = {
      id: 'sub-1',
      status: 'active' as const,
      currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      pauseResumesAt: null,
      pauseReason: null,
    };
    expect(toClientSubscriptionSummary(row as never, 'Monthly Coaching', PRICE)).toEqual({
      id: 'sub-1',
      offerName: 'Monthly Coaching',
      price: PRICE,
      status: 'active',
      currentPeriodEnd: '2026-10-01T00:00:00.000Z',
      pauseResumesAt: null,
      pauseReason: null,
    });
  });

  it('serializes pauseResumesAt/pauseReason when paused', () => {
    const row = {
      id: 'sub-1',
      status: 'paused' as const,
      currentPeriodEnd: null,
      pauseResumesAt: new Date('2026-11-01T00:00:00.000Z'),
      pauseReason: 'vacation',
    };
    const summary = toClientSubscriptionSummary(row as never, 'Monthly Coaching', PRICE);
    expect(summary.pauseResumesAt).toBe('2026-11-01T00:00:00.000Z');
    expect(summary.pauseReason).toBe('vacation');
  });
});

describe('toCoachClientSummary', () => {
  it('builds the coach-facing summary shape, one row per subscription', () => {
    const row = {
      id: 'sub-1',
      status: 'past_due' as const,
      currentPeriodEnd: null,
      pauseResumesAt: null,
      pauseReason: null,
    };
    expect(toCoachClientSummary(row as never, 'Monthly Coaching', 'client-1', 'a@b.com', 'Ada')).toEqual({
      clientId: 'client-1',
      clientEmail: 'a@b.com',
      clientName: 'Ada',
      subscriptionId: 'sub-1',
      offerName: 'Monthly Coaching',
      status: 'past_due',
      currentPeriodEnd: null,
      pauseResumesAt: null,
      pauseReason: null,
    });
  });
});

describe('validatePauseInput', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tooFar = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  it('accepts a valid reason and future resume date', () => {
    const result = validatePauseInput({ reason: 'vacation', resumeDate: future });
    expect(result).toEqual({ value: { reason: 'vacation', resumeDate: future } });
  });

  it('rejects an invalid reason', () => {
    const result = validatePauseInput({ reason: 'because', resumeDate: future });
    expect('errors' in result && result.errors.reason).toBeTruthy();
  });

  it('rejects a malformed date', () => {
    const result = validatePauseInput({ reason: 'vacation', resumeDate: '11/01/2026' });
    expect('errors' in result && result.errors.resumeDate).toBeTruthy();
  });

  it('rejects a resume date in the past', () => {
    const result = validatePauseInput({ reason: 'vacation', resumeDate: past });
    expect('errors' in result && result.errors.resumeDate).toBeTruthy();
  });

  it('rejects a resume date more than a year out', () => {
    const result = validatePauseInput({ reason: 'vacation', resumeDate: tooFar });
    expect('errors' in result && result.errors.resumeDate).toBeTruthy();
  });

  it('rejects a missing body', () => {
    const result = validatePauseInput(undefined);
    expect('errors' in result).toBe(true);
  });
});
