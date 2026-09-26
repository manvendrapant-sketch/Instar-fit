// getDb() must stay lazy for the same reason as getStripe() (see lib/stripe/client.test.ts and
// CLAUDE.md's "Important gotcha") — and additionally must never import 'server-only', since
// scripts/seed-commerce.ts and drizzle-kit both load this file directly via tsx, outside Next's
// own bundler.

export {}; // Forces module scope — see the identical comment in lib/stripe/client.test.ts.

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  process.env = originalEnv;
});

describe('getDb', () => {
  it('does not throw merely from being imported, even with DATABASE_URL unset', async () => {
    await expect(import('@/lib/commerce/db')).resolves.toBeDefined();
  });

  it('throws only when actually called, and only if DATABASE_URL is unset', async () => {
    const { getDb } = await import('@/lib/commerce/db');
    expect(() => getDb()).toThrow(/DATABASE_URL is not set/);
  });

  it('constructs a client once DATABASE_URL is set (no live connection is made just by calling this)', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    const { getDb } = await import('@/lib/commerce/db');
    expect(() => getDb()).not.toThrow();
  });

  it('caches the client across calls instead of constructing a new one each time', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    const { getDb } = await import('@/lib/commerce/db');
    expect(getDb()).toBe(getDb());
  });
});
