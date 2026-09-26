import { computeCheckoutBreakdown, formatCents, PLATFORM_TAKE_RATE_BPS, SERVICE_FEE_RATE_BPS } from '@/lib/commerce/money';

describe('computeCheckoutBreakdown', () => {
  it('defaults to a 3% service fee and 2% platform take rate', () => {
    // Locks in the documented defaults (see Decisions.md) — a change here should be deliberate.
    expect(SERVICE_FEE_RATE_BPS).toBe(300);
    expect(PLATFORM_TAKE_RATE_BPS).toBe(200);
  });

  it('adds the service fee on top of the base amount', () => {
    const result = computeCheckoutBreakdown(10_000, 'usd');
    expect(result.baseAmountCents).toBe(10_000);
    expect(result.serviceFeeCents).toBe(Math.round((10_000 * SERVICE_FEE_RATE_BPS) / 10_000));
    expect(result.platformFeeCents).toBe(Math.round((10_000 * PLATFORM_TAKE_RATE_BPS) / 10_000));
  });

  it('totalAmountCents is always baseAmountCents + serviceFeeCents', () => {
    const result = computeCheckoutBreakdown(19_900);
    expect(result.totalAmountCents).toBe(result.baseAmountCents + result.serviceFeeCents);
  });

  it('platformFeeCents is a share of baseAmountCents, never added on top of what the client pays', () => {
    const result = computeCheckoutBreakdown(19_900);
    // The client is charged totalAmountCents; platformFeeCents must not inflate that number.
    expect(result.platformFeeCents).toBeLessThan(result.totalAmountCents);
  });

  it('always returns integer cents, even for odd base amounts', () => {
    const result = computeCheckoutBreakdown(3_333);
    expect(Number.isInteger(result.serviceFeeCents)).toBe(true);
    expect(Number.isInteger(result.platformFeeCents)).toBe(true);
    expect(Number.isInteger(result.totalAmountCents)).toBe(true);
  });

  it('defaults currency to usd', () => {
    expect(computeCheckoutBreakdown(1_000).currency).toBe('usd');
  });

  it('preserves an explicit currency', () => {
    expect(computeCheckoutBreakdown(5_000, 'eur').currency).toBe('eur');
  });

  it('rejects a negative amount', () => {
    expect(() => computeCheckoutBreakdown(-1)).toThrow(/non-negative integer/);
  });

  it('rejects a non-integer amount (never a fractional-cent price)', () => {
    expect(() => computeCheckoutBreakdown(19.99)).toThrow(/non-negative integer/);
  });
});

describe('formatCents', () => {
  it('formats whole-dollar amounts', () => {
    expect(formatCents(19_900)).toBe('$199.00');
  });

  it('formats sub-dollar amounts', () => {
    expect(formatCents(75)).toBe('$0.75');
  });
});

describe('rate env overrides', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('honors a valid SERVICE_FEE_RATE_BPS override at import time', async () => {
    jest.resetModules();
    process.env = { ...originalEnv, SERVICE_FEE_RATE_BPS: '500', PLATFORM_TAKE_RATE_BPS: '200' };
    const money = await import('@/lib/commerce/money');
    expect(money.SERVICE_FEE_RATE_BPS).toBe(500);
    expect(money.computeCheckoutBreakdown(10_000).serviceFeeCents).toBe(500);
  });

  it('throws at import time if a rate override is not a non-negative integer', async () => {
    jest.resetModules();
    process.env = { ...originalEnv, SERVICE_FEE_RATE_BPS: 'not-a-number' };
    await expect(import('@/lib/commerce/money')).rejects.toThrow(/non-negative integer/);
  });
});
