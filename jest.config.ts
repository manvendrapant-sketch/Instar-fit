import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Loads next.config.ts and .env files into the test environment.
  dir: './',
});

// Route Handlers and lib/ code run under Node, never the DOM, so 'node' fits this repo far
// better than the jsdom default most Next.js Jest guides assume for component tests. Add a
// per-suite `/** @jest-environment jsdom */` docblock if a future test needs the DOM instead.
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // next/jest's SWC transform resolves the `@/*` alias (from tsconfig.json) inside ordinary
    // `import` statements at compile time, so those never need a moduleNameMapper entry — but a
    // runtime string like `jest.mock('@/lib/commerce/db')` is just a value, never transformed,
    // and needs this mapping to resolve at all. Mirrors tsconfig.json's `"@/*": ["./*"]`.
    '^@/(.*)$': '<rootDir>/$1',
  },
};

// next/jest APPENDS whatever `transformIgnorePatterns` is passed into `config` above to its own
// defaults — it never lets one of its own default patterns be overridden, only added to. jose 6
// ships pure ESM with no CJS build at all, so it needs SWC to actually transform it; but next's
// own first two default patterns already match (and thus ignore/skip-transforming) anything under
// node_modules except a hardcoded allowlist (geist, next/dist/client, ...) that doesn't include
// jose, and no amount of appending more patterns can undo an earlier pattern's match. So this
// rewrites the two `node_modules` patterns in place (same allowlist shape, "jose" added) after
// next/jest has built its config, instead of fighting the merge via `config` above.
async function resolveConfig() {
  const resolved = await createJestConfig(config)();
  resolved.transformIgnorePatterns = (resolved.transformIgnorePatterns ?? []).map((pattern) =>
    typeof pattern === 'string' && pattern.includes('node_modules') ? pattern.replace('(geist|', '(geist|jose|') : pattern,
  );
  return resolved;
}

export default resolveConfig;
