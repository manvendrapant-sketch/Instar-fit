import {
  cancelSubscriptionApi,
  fetchClientSubscriptions,
  formatSubscriptionPrice,
  openBillingPortal,
  PAUSE_REASON_LABEL,
  pauseSubscriptionApi,
  resumeSubscriptionApi,
} from './clientSubscriptions';

describe('formatSubscriptionPrice', () => {
  it('appends the interval suffix for a recurring price', () => {
    expect(formatSubscriptionPrice({ price: { currency: 'usd', unitAmountCents: 19900, interval: 'month', intervalCount: 1 } })).toBe(
      '$199/mo',
    );
    expect(formatSubscriptionPrice({ price: { currency: 'usd', unitAmountCents: 5000, interval: 'week', intervalCount: 1 } })).toBe('$50/wk');
  });

  it('omits the suffix when there is no interval', () => {
    expect(formatSubscriptionPrice({ price: { currency: 'usd', unitAmountCents: 4900, interval: null, intervalCount: null } })).toBe('$49');
  });
});

describe('PAUSE_REASON_LABEL', () => {
  it('has a label for every PauseReason value', () => {
    expect(PAUSE_REASON_LABEL).toEqual({ vacation: 'Vacation', injury: 'Injury', other: 'Other' });
  });
});

describe('fetch wrappers', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchOnce(body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
  }

  it('fetchClientSubscriptions() returns ok:true with the subscriptions and purchases lists on success', async () => {
    mockFetchOnce({
      success: true,
      message: 'ok',
      data: { subscriptions: [{ id: 'sub-1' }], purchases: [{ id: 'pay-1' }] },
    });
    const result = await fetchClientSubscriptions();
    expect(result).toEqual({ ok: true, subscriptions: [{ id: 'sub-1' }], purchases: [{ id: 'pay-1' }] });
  });

  it('fetchClientSubscriptions() returns ok:false with the backend message on failure', async () => {
    mockFetchOnce({ success: false, code: 'NOT_AUTHENTICATED', message: 'You are not logged in.' });
    const result = await fetchClientSubscriptions();
    expect(result).toEqual({ ok: false, message: 'You are not logged in.' });
  });

  it('pauseSubscriptionApi() posts to the pause endpoint and returns the updated subscription', async () => {
    mockFetchOnce({ success: true, message: 'ok', data: { subscription: { id: 'sub-1', status: 'paused' } } });
    const result = await pauseSubscriptionApi('sub-1', { reason: 'vacation', resumeDate: '2026-12-01' });
    expect(result).toEqual({ ok: true, subscription: { id: 'sub-1', status: 'paused' } });
    expect(global.fetch).toHaveBeenCalledWith('/api/client/subscriptions/sub-1/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'vacation', resumeDate: '2026-12-01' }),
    });
  });

  it('pauseSubscriptionApi() surfaces field errors on validation failure', async () => {
    mockFetchOnce({ success: false, code: 'VALIDATION_ERROR', message: 'Fix the highlighted fields.', fields: { resumeDate: 'Pick a future date.' } });
    const result = await pauseSubscriptionApi('sub-1', { reason: 'vacation', resumeDate: '2020-01-01' });
    expect(result).toEqual({ ok: false, message: 'Fix the highlighted fields.', fieldErrors: { resumeDate: 'Pick a future date.' } });
  });

  it('resumeSubscriptionApi() posts to the resume endpoint', async () => {
    mockFetchOnce({ success: true, message: 'ok', data: { subscription: { id: 'sub-1', status: 'active' } } });
    const result = await resumeSubscriptionApi('sub-1');
    expect(result).toEqual({ ok: true, subscription: { id: 'sub-1', status: 'active' } });
    expect(global.fetch).toHaveBeenCalledWith('/api/client/subscriptions/sub-1/resume', { method: 'POST', headers: undefined, body: undefined });
  });

  it('cancelSubscriptionApi() posts to the cancel endpoint', async () => {
    mockFetchOnce({ success: true, message: 'ok', data: { id: 'sub-1' } });
    const result = await cancelSubscriptionApi('sub-1');
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith('/api/client/subscriptions/sub-1/cancel', { method: 'POST', headers: undefined, body: undefined });
  });

  it('openBillingPortal() returns the portal URL on success', async () => {
    mockFetchOnce({ success: true, message: 'ok', data: { url: 'https://billing.stripe.com/session/xyz' } });
    const result = await openBillingPortal();
    expect(result).toEqual({ ok: true, url: 'https://billing.stripe.com/session/xyz' });
  });

  it('openBillingPortal() returns ok:false on failure', async () => {
    mockFetchOnce({ success: false, code: 'NO_STRIPE_CUSTOMER', message: 'No billing account found yet.' });
    const result = await openBillingPortal();
    expect(result).toEqual({ ok: false, message: 'No billing account found yet.' });
  });
});
