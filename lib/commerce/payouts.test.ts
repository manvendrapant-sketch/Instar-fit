import { DEFAULT_CURRENCY, startOfCurrentMonthUtc, toCoachBalanceResponse, toCoachPayoutSummary, toPayoutScheduleResponse } from './payouts';

describe('toPayoutScheduleResponse', () => {
  it('maps a known interval and delay', () => {
    expect(toPayoutScheduleResponse({ interval: 'weekly', delay_days: 4 } as never)).toEqual({ interval: 'weekly', delayDays: 4 });
  });

  it('falls back to daily/2 when settings are missing', () => {
    expect(toPayoutScheduleResponse(undefined)).toEqual({ interval: 'daily', delayDays: 2 });
  });

  it('falls back to daily for an unrecognized interval string', () => {
    expect(toPayoutScheduleResponse({ interval: 'fortnightly' } as never).interval).toBe('daily');
  });
});

describe('toCoachBalanceResponse', () => {
  it('picks the requested currency out of Stripe\'s per-currency arrays', () => {
    const balance = {
      available: [{ amount: 500, currency: 'usd' }, { amount: 100, currency: 'eur' }],
      pending: [{ amount: 300, currency: 'usd' }],
    } as never;
    expect(toCoachBalanceResponse(balance, 'usd', 12000)).toEqual({
      currency: 'usd',
      availableCents: 500,
      pendingCents: 300,
      revenueThisMonthCents: 12000,
    });
  });

  it('defaults to 0 when the currency has no entry', () => {
    const balance = { available: [], pending: [] } as never;
    expect(toCoachBalanceResponse(balance, DEFAULT_CURRENCY, 0)).toEqual({
      currency: 'usd',
      availableCents: 0,
      pendingCents: 0,
      revenueThisMonthCents: 0,
    });
  });
});

describe('toCoachPayoutSummary', () => {
  it('maps a Stripe Payout to our summary shape, converting unix seconds to ISO', () => {
    const payout = { id: 'po_1', currency: 'usd', amount: 19900, status: 'paid', arrival_date: 1700000000, created: 1699900000 } as never;
    expect(toCoachPayoutSummary(payout)).toEqual({
      id: 'po_1',
      currency: 'usd',
      amountCents: 19900,
      status: 'paid',
      arrivalDate: new Date(1700000000 * 1000).toISOString(),
      createdAt: new Date(1699900000 * 1000).toISOString(),
    });
  });

  it('falls back to pending for an unrecognized status', () => {
    const payout = { id: 'po_1', currency: 'usd', amount: 100, status: 'something_new', arrival_date: 1700000000, created: 1699900000 } as never;
    expect(toCoachPayoutSummary(payout).status).toBe('pending');
  });
});

describe('startOfCurrentMonthUtc', () => {
  it('returns UTC midnight on the 1st of the current month', () => {
    const d = startOfCurrentMonthUtc();
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });
});
