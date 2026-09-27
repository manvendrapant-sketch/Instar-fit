// getResend() must stay lazy (read process.env inside the function, not at module scope) — same
// gotcha as lib/stripe/client.ts and lib/commerce/db.ts. These tests guard that contract directly.

export {}; // Forces module scope — see lib/stripe/client.test.ts for why this matters.

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  process.env = originalEnv;
});

describe('getResend', () => {
  it('does not throw merely from being imported, even with RESEND_API_KEY unset', async () => {
    await expect(import('@/lib/email/resend')).resolves.toBeDefined();
  });

  it('throws only when actually called, and only if RESEND_API_KEY is unset', async () => {
    const { getResend } = await import('@/lib/email/resend');
    expect(() => getResend()).toThrow(/RESEND_API_KEY is not set/);
  });

  it('constructs a client once RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    const { getResend } = await import('@/lib/email/resend');
    expect(() => getResend()).not.toThrow();
  });

  it('caches the client across calls instead of constructing a new one each time', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    const { getResend } = await import('@/lib/email/resend');
    expect(getResend()).toBe(getResend());
  });
});
