import {
  arrivalLabel,
  clientLabel,
  delayLabel,
  fetchPayoutDashboard,
  findNextPayout,
  isEmptyDashboard,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  scheduleLabel,
  shortDate,
  type PayoutDashboardData,
} from './payoutDashboard';

const BALANCE = { currency: 'usd', availableCents: 21_040, pendingCents: 38_220, earnedThisMonthCents: 164_332, earnedLastMonthCents: 142_110 };
const SCHEDULE = { interval: 'daily' as const, delayDays: 2, weeklyAnchor: null, monthlyAnchor: null };
const PAYOUTS = [
  { id: 'po_1', currency: 'usd', amountCents: 19_502, status: 'in_transit' as const, arrivalDate: '2026-09-29T00:00:00.000Z', createdAt: '2026-09-27T00:00:00.000Z' },
  { id: 'po_2', currency: 'usd', amountCents: 48_902, status: 'paid' as const, arrivalDate: '2026-09-24T00:00:00.000Z', createdAt: '2026-09-22T00:00:00.000Z' },
];
const PAYMENTS = [
  {
    id: 'pay_1',
    clientName: 'Leah Kim',
    clientEmail: 'leah@example.com',
    offerName: '1:1 Coaching',
    currency: 'usd',
    totalAmountCents: 20_497,
    netCents: 19_502,
    refundedAmountCents: 0,
    status: 'succeeded' as const,
    createdAt: '2026-09-28T00:00:00.000Z',
  },
];

function mockFetch(byPath: Record<string, { status: number; body: unknown }>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const entry = byPath[path];
    if (!entry) throw new Error(`unexpected fetch to ${path}`);
    return { status: entry.status, json: async () => entry.body } as unknown as Response;
  }) as typeof fetch;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchPayoutDashboard', () => {
  it('combines the four endpoints into one dashboard, deriving nextPayout from the payouts list', async () => {
    mockFetch({
      '/api/coach/balance': { status: 200, body: { success: true, message: 'ok', data: BALANCE } },
      '/api/coach/payout-schedule': { status: 200, body: { success: true, message: 'ok', data: SCHEDULE } },
      '/api/coach/payouts': { status: 200, body: { success: true, message: 'ok', data: { payouts: PAYOUTS, hasMore: false } } },
      '/api/coach/payments': { status: 200, body: { success: true, message: 'ok', data: { payments: PAYMENTS } } },
    });

    const result = await fetchPayoutDashboard();

    expect(result).toEqual({
      ok: true,
      data: {
        balance: BALANCE,
        schedule: SCHEDULE,
        payouts: PAYOUTS,
        payments: PAYMENTS,
        nextPayout: { amountCents: 19_502, arrivalDate: '2026-09-29T00:00:00.000Z' },
      },
    });
  });

  it('reports the first failing endpoint\'s message rather than fetching what it can', async () => {
    mockFetch({
      '/api/coach/balance': { status: 401, body: { success: false, code: 'NOT_AUTHENTICATED', message: 'Log in' } },
      '/api/coach/payout-schedule': { status: 200, body: { success: true, message: 'ok', data: SCHEDULE } },
      '/api/coach/payouts': { status: 200, body: { success: true, message: 'ok', data: { payouts: [], hasMore: false } } },
      '/api/coach/payments': { status: 200, body: { success: true, message: 'ok', data: { payments: [] } } },
    });
    await expect(fetchPayoutDashboard()).resolves.toEqual({ ok: false, message: 'Log in' });
  });

  it('reports a dropped connection as a real error, never sample data', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as typeof fetch;
    const result = await fetchPayoutDashboard();
    expect(result.ok).toBe(false);
  });
});

describe('findNextPayout', () => {
  it('picks the soonest pending or in_transit payout', () => {
    expect(findNextPayout(PAYOUTS)).toEqual({ amountCents: 19_502, arrivalDate: '2026-09-29T00:00:00.000Z' });
  });

  it('returns null once everything has arrived', () => {
    expect(findNextPayout([PAYOUTS[1]])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findNextPayout([])).toBeNull();
  });
});

describe('schedule labels', () => {
  const base = { delayDays: 2, weeklyAnchor: null, monthlyAnchor: null };
  it('describes each interval', () => {
    expect(scheduleLabel({ ...base, interval: 'daily' })).toBe('Daily');
    expect(scheduleLabel({ ...base, interval: 'weekly', weeklyAnchor: 'friday' })).toBe('Every Friday');
    expect(scheduleLabel({ ...base, interval: 'weekly', weeklyAnchor: 'nonsense' })).toBe('Every Monday');
    expect(scheduleLabel({ ...base, interval: 'monthly', monthlyAnchor: 1 })).toBe('Monthly on the 1st');
    expect(scheduleLabel({ ...base, interval: 'monthly', monthlyAnchor: 22 })).toBe('Monthly on the 22nd');
    expect(scheduleLabel({ ...base, interval: 'monthly', monthlyAnchor: 13 })).toBe('Monthly on the 13th');
    expect(scheduleLabel({ ...base, interval: 'manual' })).toBe('Manual');
  });

  it('explains the delay', () => {
    expect(delayLabel({ ...base, interval: 'daily' })).toBe('Payments become available 2 days after a client pays.');
    expect(delayLabel({ ...base, interval: 'daily', delayDays: 1 })).toMatch(/1 day after/);
    expect(delayLabel({ ...base, interval: 'manual' })).toMatch(/yourself/);
  });
});

describe('dates', () => {
  const now = new Date('2026-09-28T15:00:00Z');
  it('omits the year for this year', () => {
    expect(shortDate('2026-09-01T10:00:00Z', now)).toBe('Sep 1');
    expect(shortDate('2025-12-31T10:00:00Z', now)).toBe('Dec 31, 2025');
    expect(shortDate(null, now)).toBe('—');
  });

  it('describes arrival relative to today', () => {
    expect(arrivalLabel('2026-09-28T23:00:00Z', now)).toBe('Today');
    expect(arrivalLabel('2026-09-29T01:00:00Z', now)).toBe('Tomorrow');
    expect(arrivalLabel('2026-10-01T00:00:00Z', now)).toBe('In 3 days');
    expect(arrivalLabel('2026-10-20T00:00:00Z', now)).toBe('Oct 20');
  });
});

describe('labels and empty state', () => {
  it('has a label and chip for every status enum value', () => {
    expect(Object.keys(PAYOUT_STATUS).sort()).toEqual(['canceled', 'failed', 'in_transit', 'paid', 'pending']);
    expect(Object.keys(PAYMENT_STATUS).sort()).toEqual(['disputed', 'failed', 'partially_refunded', 'refunded', 'succeeded']);
  });

  it('falls back to email when a client has no name', () => {
    expect(clientLabel({ clientName: '  ', clientEmail: 'a@b.co' })).toBe('a@b.co');
    expect(clientLabel({ clientName: 'Leah', clientEmail: 'a@b.co' })).toBe('Leah');
  });

  it('is empty only with no payments, no payouts and no balance', () => {
    const empty: PayoutDashboardData = {
      balance: { ...BALANCE, pendingCents: 0, availableCents: 0 },
      schedule: SCHEDULE,
      payouts: [],
      payments: [],
      nextPayout: null,
    };
    expect(isEmptyDashboard(empty)).toBe(true);
    expect(isEmptyDashboard({ ...empty, payments: PAYMENTS })).toBe(false);
    expect(isEmptyDashboard({ ...empty, balance: { ...empty.balance, pendingCents: 1 } })).toBe(false);
  });
});
