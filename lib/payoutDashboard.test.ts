import {
  arrivalLabel,
  clientLabel,
  delayLabel,
  fetchPayoutDashboard,
  isEmptyDashboard,
  PAYMENT_STATUS,
  PAYOUT_DASHBOARD_ENDPOINT,
  PAYOUT_STATUS,
  SAMPLE_DASHBOARD,
  scheduleLabel,
  shortDate,
  type PayoutDashboardResponse,
} from './payoutDashboard';

const res = (status: number, body: unknown) =>
  jest.fn(async () => ({ status, json: async () => body }) as unknown as Response);

describe('fetchPayoutDashboard', () => {
  it('returns real data from the endpoint', async () => {
    const f = res(200, { success: true, message: 'ok', data: SAMPLE_DASHBOARD });
    await expect(fetchPayoutDashboard(f)).resolves.toEqual({ ok: true, data: SAMPLE_DASHBOARD, sample: false });
    expect(f).toHaveBeenCalledWith(PAYOUT_DASHBOARD_ENDPOINT);
  });

  it('falls back to labelled sample data only when the route does not exist yet (404)', async () => {
    const f = jest.fn(async () => ({ status: 404, json: async () => { throw new Error('html'); } }) as unknown as Response);
    await expect(fetchPayoutDashboard(f)).resolves.toMatchObject({ ok: true, sample: true });
  });

  it('reports API errors and dropped connections as errors, never sample data', async () => {
    await expect(fetchPayoutDashboard(res(401, { success: false, code: 'NOT_AUTHENTICATED', message: 'Log in' }))).resolves.toEqual({ ok: false, message: 'Log in' });
    await expect(fetchPayoutDashboard(res(500, { success: false, code: 'INTERNAL_ERROR', message: 'Oops' }))).resolves.toEqual({ ok: false, message: 'Oops' });
    const offline = jest.fn(async () => { throw new Error('offline'); });
    await expect(fetchPayoutDashboard(offline)).resolves.toMatchObject({ ok: false });
    const badJson = jest.fn(async () => ({ status: 502, json: async () => { throw new Error('html'); } }) as unknown as Response);
    await expect(fetchPayoutDashboard(badJson)).resolves.toMatchObject({ ok: false });
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
    const empty: PayoutDashboardResponse = {
      ...SAMPLE_DASHBOARD,
      payments: [],
      payouts: [],
      balance: { ...SAMPLE_DASHBOARD.balance, pendingCents: 0, availableCents: 0, nextPayout: null },
    };
    expect(isEmptyDashboard(empty)).toBe(true);
    expect(isEmptyDashboard(SAMPLE_DASHBOARD)).toBe(false);
    expect(isEmptyDashboard({ ...empty, balance: { ...empty.balance, pendingCents: 1 } })).toBe(false);
  });

  it('keeps sample figures as integer cents', () => {
    const cents = [
      ...Object.values(SAMPLE_DASHBOARD.balance).filter((v): v is number => typeof v === 'number'),
      ...SAMPLE_DASHBOARD.payments.flatMap((p) => [p.amountCents, p.netCents, p.refundedCents]),
      ...SAMPLE_DASHBOARD.payouts.map((p) => p.amountCents),
    ];
    for (const c of cents) expect(Number.isInteger(c)).toBe(true);
  });
});
