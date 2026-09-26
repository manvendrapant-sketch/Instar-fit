// getStripe() must stay lazy (read process.env inside the function, not at module scope) — see
// its own source comment. A regression there breaks `next build` whenever STRIPE_SECRET_KEY isn't
// set, even for routes never invoked during the build. These tests guard that contract directly.

export {}; // Forces module scope — without any static import/export, `originalEnv` below would
// otherwise collide (as a global script declaration) with the same-named const in
// lib/commerce/db.test.ts's near-identical suite.

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  delete process.env.STRIPE_SECRET_KEY;
});

afterEach(() => {
  process.env = originalEnv;
});

describe('getStripe', () => {
  it('does not throw merely from being imported, even with STRIPE_SECRET_KEY unset', async () => {
    await expect(import('@/lib/stripe/client')).resolves.toBeDefined();
  });

  it('throws only when actually called, and only if STRIPE_SECRET_KEY is unset', async () => {
    const { getStripe } = await import('@/lib/stripe/client');
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY is not set/);
  });

  it('constructs a client once STRIPE_SECRET_KEY is set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const { getStripe } = await import('@/lib/stripe/client');
    expect(() => getStripe()).not.toThrow();
  });

  it('caches the client across calls instead of constructing a new one each time', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const { getStripe } = await import('@/lib/stripe/client');
    expect(getStripe()).toBe(getStripe());
  });
});
