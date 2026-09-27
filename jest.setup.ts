// Runs before each test file's module registry is set up (jest.config.ts `setupFiles`).
// Only sets what nearly every suite needs; DATABASE_URL/STRIPE_SECRET_KEY are deliberately left
// unset here since lib/commerce/db.test.ts and lib/stripe/client.test.ts test the
// missing-env-var behavior themselves and manage those two vars locally.
process.env.AUTH_JWT_SECRET = 'test-only-secret-do-not-use-in-production';
process.env.CLIENT_SESSION_JWT_SECRET = 'test-only-client-secret-do-not-use-in-production';
